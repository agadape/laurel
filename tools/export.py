"""Bursa exporter (ML-1): sklearn GradientBoostingClassifier -> integer borsh model for `gbdt-core`.

    python tools/export.py --task german-credit --model tasks/german-credit/model_baseline.pkl --out tasks/german-credit/out/baseline
    python tools/export.py --task german-credit --model ... --bias-shift -0.2      # shift decision threshold (log-odds)
    python tools/export.py --synthetic --trees 50 --depth 4 --out tools/out/gasprobe  # gas-probe model (no task)

Outputs (in --out): model.bin (borsh), model.hex, vectors.json (every row of the task's public_holdout, raw
scores computed by the Python re-implementation of the integer model), report.json. The Rust unit test
`gbdt-core::matches_python_vectors` reads tasks/german-credit/vectors.json (copy it there, or set GBDT_VECTORS).

Format (borsh, little-endian): u8 version=1, u16 n_features, i64 feature_scale, i64 out_scale, i64 bias,
u32 n_trees, then per tree u32 n_nodes and per node (u16 feature, i64 threshold, u16 left, u16 right, i64 value);
leaf: left == right == 0xFFFF. Walk: x[feature] <= threshold -> left else right. Children indices always
exceed the parent index (sklearn's preorder layout), which is what the contract's validate() requires.
"""
import argparse, json, os, pickle, struct, sys
import numpy as np

LEAF = 0xFFFF
OUT_SCALE = 1_000_000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def quantize_model(gbc, n_features, feature_scale, bias_shift=0.0):
    lr = gbc.learning_rate
    prior = float(gbc.init_.class_prior_[1])
    bias = float(np.log(prior / (1 - prior))) + bias_shift
    trees = []
    for est in gbc.estimators_[:, 0]:
        t = est.tree_
        nodes = []
        for i in range(t.node_count):
            if t.children_left[i] == -1:
                nodes.append((0, 0, LEAF, LEAF, int(np.rint(t.value[i][0][0] * lr * OUT_SCALE))))
            else:
                # x_q <= floor(thr*S)  <=>  x <= thr  for quantized/integer x (thr is a float midpoint)
                thr = int(np.floor(t.threshold[i] * feature_scale))
                nodes.append((int(t.feature[i]), thr, int(t.children_left[i]), int(t.children_right[i]), 0))
        trees.append(nodes)
    return {"version": 1, "n_features": n_features, "feature_scale": feature_scale, "out_scale": OUT_SCALE,
            "bias": int(np.rint(bias * OUT_SCALE)), "trees": trees}


def to_borsh(m):
    b = bytearray()
    b += struct.pack("<BHqqqI", m["version"], m["n_features"], m["feature_scale"], m["out_scale"], m["bias"], len(m["trees"]))
    for nodes in m["trees"]:
        b += struct.pack("<I", len(nodes))
        for (f, thr, l, r, v) in nodes:
            b += struct.pack("<HqHHq", f, thr, l, r, v)
    return bytes(b)


def raw_score(m, xq):
    acc = m["bias"]
    for nodes in m["trees"]:
        i = 0
        while True:
            f, thr, l, r, v = nodes[i]
            if l == LEAF:
                acc += v
                break
            i = l if xq[f] <= thr else r
    return acc


def metrics(labels, y):
    labels, y = np.asarray(labels), np.asarray(y)
    tp = int(((labels == 1) & (y == 1)).sum()); tn = int(((labels == 0) & (y == 0)).sum())
    fp = int(((labels == 1) & (y == 0)).sum()); fn = int(((labels == 0) & (y == 1)).sum())
    bps = lambda a, b: (a * 10000 // b) if b else 0
    bal = (bps(tp, tp + fn) + bps(tn, tn + fp)) // 2
    return {"tp": tp, "tn": tn, "fp": fp, "fn": fn, "bal_acc_bps": bal, "f1_bps": bps(2 * tp, 2 * tp + fp + fn), "accuracy_bps": bps(tp + tn, len(y))}


def write_outputs(out, m, blob, Xq, y, extra):
    os.makedirs(out, exist_ok=True)
    open(f"{out}/model.bin", "wb").write(blob)
    open(f"{out}/model.hex", "w").write(blob.hex())
    raw = np.array([raw_score(m, x) for x in Xq])
    labels = (raw > 0).astype(int)
    n = len(Xq)  # every evaluation row (100 for german-credit, 150 for near-retention)
    vectors = {"model_hex": blob.hex(), "rows": [{"x": [int(v) for v in Xq[i]], "raw": int(raw[i]), "label": int(labels[i])} for i in range(n)]}
    json.dump(vectors, open(f"{out}/vectors.json", "w"))
    report = {**extra, "nodes": sum(len(t) for t in m["trees"]), "trees": len(m["trees"]), "model_bytes": len(blob),
              "within_60kb": len(blob) <= 61440, "integer_model_on_eval_rows": metrics(labels, y) if y is not None else None}
    json.dump(report, open(f"{out}/report.json", "w"), indent=2)
    print(json.dumps(report, indent=2))
    return raw, labels


def export_task(a):
    import pandas as pd
    tdir = os.path.join(ROOT, "tasks", a.task)
    spec = json.load(open(os.path.join(tdir, "features.json"), encoding="utf-8"))
    gbc = pickle.load(open(a.model, "rb"))
    assert gbc.n_features_in_ == spec["n_features"], f"model has {gbc.n_features_in_} features, task {spec['n_features']}"
    m = quantize_model(gbc, spec["n_features"], spec["feature_scale"], a.bias_shift)
    blob = to_borsh(m)
    df = pd.read_csv(os.path.join(tdir, "public_holdout.csv"))
    X = df.drop(columns=["label"]).to_numpy(dtype=np.int64); y = df["label"].to_numpy()
    Xq = (X * spec["feature_scale"]).astype(np.int64)
    raw, labels = write_outputs(a.out, m, blob, Xq, y, {"task": a.task, "model": a.model, "bias_shift": a.bias_shift})
    sk = gbc.predict(X)
    if a.bias_shift == 0:
        agree = float((labels == sk).mean())
        print(f"label agreement integer vs sklearn float on holdout: {agree:.4f}")
        assert agree >= 0.995, "integer model drifted from sklearn"


def export_synthetic(a):
    from sklearn.datasets import make_classification
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import train_test_split
    X, y = make_classification(n_samples=6000, n_features=8, n_informative=5, n_redundant=1, random_state=31, flip_y=0.05)
    X = np.round(X, 4)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.5, random_state=31)
    gbc = GradientBoostingClassifier(n_estimators=a.trees, max_depth=a.depth, learning_rate=0.1, random_state=31).fit(Xtr, ytr)
    m = quantize_model(gbc, 8, 1_000_000)
    Xq = np.rint(Xte * 1_000_000).astype(np.int64)
    write_outputs(a.out, m, to_borsh(m), Xq[:300], yte[:300], {"synthetic": True, "trees": a.trees, "depth": a.depth})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task"); ap.add_argument("--model"); ap.add_argument("--bias-shift", type=float, default=0.0)
    ap.add_argument("--synthetic", action="store_true"); ap.add_argument("--trees", type=int, default=50); ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.synthetic:
        export_synthetic(a)
    elif a.task and a.model:
        export_task(a)
    else:
        sys.exit("need --task + --model, or --synthetic")


if __name__ == "__main__":
    main()
