"""S31 exporter: train a small GBDT in sklearn, quantize to integers, write borsh model bytes,
test vectors (Python reimplementation on the quantized model) and a secret test set.

Usage: python export.py [--trees 100] [--depth 6] [--out out]
Outputs (in --out):
  model.bin          borsh Model (consumed by gbdt-core)
  model.hex          same, hex (for JSON args)
  vectors.json       {model_hex, rows:[{x, raw, label}]}  -> gbdt-core unit test
  test_set.json      {"rows":[[x..., label], ...]}         -> OutLayer secret (split A)
  test_set_b.json    second split                           -> OutLayer secret (split B)
  summary.json       sizes, accuracies
"""
import argparse, json, os, struct
import numpy as np
from sklearn.datasets import make_classification
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split

LEAF = 0xFFFF
FEATURE_SCALE = 1_000_000
OUT_SCALE = 1_000_000


def q(x):  # quantize a float to i64 with round-half-even like numpy
    return int(np.rint(x * FEATURE_SCALE))


def export(gbc, n_features):
    """Return (model_dict, bytes). sklearn: go left if x <= threshold."""
    lr = gbc.learning_rate
    # init raw score (log-odds prior) for binary classification
    prior = gbc.init_.class_prior_[1]
    bias = float(np.log(prior / (1 - prior)))
    trees = []
    for est in gbc.estimators_[:, 0]:
        t = est.tree_
        nodes = []
        for i in range(t.node_count):
            if t.children_left[i] == -1:
                nodes.append((0, 0, LEAF, LEAF, int(np.rint(t.value[i][0][0] * lr * OUT_SCALE))))
            else:
                # x_q <= floor(thr*S)  <=>  x <= thr for quantized x (thr is a float midpoint)
                thr = int(np.floor(t.threshold[i] * FEATURE_SCALE))
                nodes.append((int(t.feature[i]), thr, int(t.children_left[i]), int(t.children_right[i]), 0))
        trees.append(nodes)
    model = {
        "version": 1,
        "n_features": n_features,
        "feature_scale": FEATURE_SCALE,
        "out_scale": OUT_SCALE,
        "bias": int(np.rint(bias * OUT_SCALE)),
        "trees": trees,
    }
    return model, to_borsh(model)


def to_borsh(m):
    b = bytearray()
    b += struct.pack("<B", m["version"])
    b += struct.pack("<H", m["n_features"])
    b += struct.pack("<q", m["feature_scale"])
    b += struct.pack("<q", m["out_scale"])
    b += struct.pack("<q", m["bias"])
    b += struct.pack("<I", len(m["trees"]))
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trees", type=int, default=100)
    ap.add_argument("--depth", type=int, default=6)
    ap.add_argument("--features", type=int, default=8)
    ap.add_argument("--out", default="out")
    ap.add_argument("--split-rows", type=int, default=500)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    X, y = make_classification(n_samples=6000, n_features=a.features, n_informative=5, n_redundant=1,
                               random_state=31, flip_y=0.05)
    X = np.round(X, 4)  # pretend these are real measured features
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.5, random_state=31)
    gbc = GradientBoostingClassifier(n_estimators=a.trees, max_depth=a.depth, learning_rate=0.1, random_state=31)
    gbc.fit(Xtr, ytr)

    model, blob = export(gbc, a.features)
    open(f"{a.out}/model.bin", "wb").write(blob)
    open(f"{a.out}/model.hex", "w").write(blob.hex())

    # Agreement between float sklearn and the integer model
    Xq = [[q(v) for v in row] for row in Xte]
    raw = np.array([raw_score(model, xq) for xq in Xq])
    int_labels = (raw > 0).astype(int)
    sk_labels = gbc.predict(Xte)
    agree = float((int_labels == sk_labels).mean())
    acc_int = float((int_labels == yte).mean())
    acc_sk = float((sk_labels == yte).mean())

    # Test vectors for the Rust unit test (first 200 rows)
    vectors = {"model_hex": blob.hex(),
               "rows": [{"x": Xq[i], "raw": int(raw[i]), "label": int(int_labels[i])} for i in range(200)]}
    json.dump(vectors, open(f"{a.out}/vectors.json", "w"))

    # Secret test sets: split A (rows 200..700) and split B (rows 700..1200)
    def split(lo, hi):
        return {"rows": [Xq[i] + [int(yte[i])] for i in range(lo, hi)]}
    R = a.split_rows
    json.dump(split(200, 200 + R), open(f"{a.out}/test_set.json", "w"), separators=(",", ":"))
    json.dump(split(200 + R, 200 + 2 * R), open(f"{a.out}/test_set_b.json", "w"), separators=(",", ":"))

    summary = {
        "trees": a.trees, "depth": a.depth, "features": a.features,
        "nodes": sum(len(t) for t in model["trees"]),
        "model_bytes": len(blob),
        "acc_sklearn_float": acc_sk, "acc_integer_model": acc_int, "label_agreement": agree,
        "test_set_a_bytes": os.path.getsize(f"{a.out}/test_set.json"),
        "test_set_b_bytes": os.path.getsize(f"{a.out}/test_set_b.json"),
        "expected_score_a_bps": int(sum(int(int_labels[i] == yte[i]) for i in range(200, 200 + R)) * 10000 / R),
        "expected_score_b_bps": int(sum(int(int_labels[i] == yte[i]) for i in range(200 + R, 200 + 2 * R)) * 10000 / R),
    }
    json.dump(summary, open(f"{a.out}/summary.json", "w"), indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
