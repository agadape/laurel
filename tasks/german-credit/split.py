"""German Credit — download, encode 18 integer features, stratified split, private manifest (ML-2).

    python tasks/german-credit/split.py            # writes into tasks/german-credit/
    python tasks/german-credit/split.py --rows 150 # rows per private split (default 150)

Outputs (same folder):
  public_train.csv      600 rows   (committed)
  public_holdout.csv    100 rows   (committed)
  private_a.json        150 rows   (GITIGNORED; OutLayer secret TEST_SET_A, compact format)
  private_b.json        150 rows   (GITIGNORED; OutLayer secret TEST_SET_B)
  private_manifest.json sha256 + class counts of the private files (committed, the commitment)
Reproducible: stratified two-stage train_test_split with random_state=144 (UCI dataset id).
"""
import argparse, base64, csv, hashlib, io, json, os, struct, sys, urllib.request, zipfile
import numpy as np
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "features.json"), encoding="utf-8"))
SEED = SPEC["split"]["random_state"]
URLS = [
    "https://archive.ics.uci.edu/ml/machine-learning-databases/statlog/german/german.data",
    "https://archive.ics.uci.edu/static/public/144/statlog+german+credit+data.zip",
]


def download():
    cache = os.path.join(HERE, "german.data")
    if os.path.exists(cache):
        return open(cache, encoding="utf-8").read()
    last = None
    for url in URLS:
        try:
            data = urllib.request.urlopen(url, timeout=60).read()
            if url.endswith(".zip"):
                data = zipfile.ZipFile(io.BytesIO(data)).read("german.data")
            txt = data.decode("utf-8")
            open(cache, "w", encoding="utf-8").write(txt)
            print("downloaded", url, len(txt.splitlines()), "lines")
            return txt
        except Exception as e:  # noqa: BLE001
            last = e
            print("failed", url, e, file=sys.stderr)
    raise SystemExit(f"could not download german.data: {last}")


def encode(txt):
    feats = SPEC["features"]
    names = [f["name"] for f in feats]
    X, y = [], []
    for ln, line in enumerate(txt.strip().splitlines(), 1):
        cols = line.split()
        assert len(cols) == 21, f"line {ln}: {len(cols)} columns"
        row = []
        for f in feats:
            raw = cols[f["index_in_german_data"]]
            if "codes" in f:
                assert raw in f["codes"], f"line {ln}: unknown code {raw} for {f['name']}"
                row.append(int(f["codes"][raw]))
            else:
                row.append(int(raw))
        X.append(row)
        y.append(SPEC["label"]["mapping"][cols[20]])
    X, y = np.array(X, dtype=np.int64), np.array(y, dtype=np.int64)
    assert X.shape == (1000, SPEC["n_features"]), X.shape
    assert (y == 1).sum() == 300 and (y == 0).sum() == 700, "label counts differ from UCI"
    assert X.min() >= -32768 and X.max() <= 32767, "features must fit i16 for the compact secret format"
    return names, X, y


def compact(X, y):
    """{"n":18,"b64":<i16 LE rows of n+1>} — the OutLayer secret format the evaluator reads."""
    buf = bytearray()
    for row, lab in zip(X, y):
        buf += struct.pack("<%dh" % (len(row) + 1), *row.tolist(), int(lab))
    return {"n": int(X.shape[1]), "b64": base64.b64encode(bytes(buf)).decode()}


def sha256_file(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=SPEC["split"]["private_a"])
    a = ap.parse_args()
    names, X, y = encode(download())
    idx = np.arange(1000)
    # stage 1: public (700) vs private (300); stage 2: train 600 / holdout 100 and private A/B
    pub, priv = train_test_split(idx, test_size=300, stratify=y, random_state=SEED)
    train, hold = train_test_split(pub, test_size=100, stratify=y[pub], random_state=SEED)
    pa, pb = train_test_split(priv, test_size=150, stratify=y[priv], random_state=SEED)
    pa, pb = np.sort(pa)[: a.rows], np.sort(pb)[: a.rows]
    assert not (set(train) | set(hold)) & (set(pa) | set(pb)), "leak: private row in public split"

    def write_csv(path, rows):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(names + ["label"])
            for i in rows:
                w.writerow(X[i].tolist() + [int(y[i])])

    write_csv(os.path.join(HERE, "public_train.csv"), np.sort(train))
    write_csv(os.path.join(HERE, "public_holdout.csv"), np.sort(hold))
    for name, rows in (("private_a.json", pa), ("private_b.json", pb)):
        json.dump(compact(X[rows], y[rows]), open(os.path.join(HERE, name), "w"), separators=(",", ":"))
    # row-hash leakage check (feature vector + label)
    rowhash = lambda i: hashlib.sha256(",".join(map(str, X[i].tolist() + [int(y[i])])).encode()).hexdigest()
    pub_hashes = {rowhash(i) for i in np.concatenate([train, hold])}
    dup = [i for i in np.concatenate([pa, pb]) if rowhash(i) in pub_hashes]
    manifest = {
        "dataset": SPEC["source"]["url"],
        "random_state": SEED,
        "sizes": {"public_train": len(train), "public_holdout": len(hold), "private_a": len(pa), "private_b": len(pb)},
        "class_counts": {k: {"good": int((y[v] == 0).sum()), "bad": int((y[v] == 1).sum())} for k, v in
                         (("public_train", train), ("public_holdout", hold), ("private_a", pa), ("private_b", pb))},
        "private_sha256": {n: sha256_file(os.path.join(HERE, n)) for n in ("private_a.json", "private_b.json")},
        "private_bytes": {n: os.path.getsize(os.path.join(HERE, n)) for n in ("private_a.json", "private_b.json")},
        "identical_rows_between_private_and_public": len(dup),
        "note": "duplicates (if any) are identical feature+label rows that exist twice in UCI data, not index leaks",
    }
    json.dump(manifest, open(os.path.join(HERE, "private_manifest.json"), "w"), indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
