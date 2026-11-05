"""NEAR account retention — turn sample_raw.csv (from fetch.py) into the task's public and private files.

    python tasks/near-retention/build.py

Outputs (same folder):
  public_train.csv       800 rows  features + label only                      (committed)
  public_holdout.csv     150 rows  features + label only                      (committed)
  public_accounts.csv    950 rows  split, row, account_id, created_at_utc     (committed: lets anyone recheck a public row on-chain)
  private_a.json         150 rows  {"n":22,"b64":...} i16 rows, OutLayer secret TEST_SET_A   (GITIGNORED)
  private_b.json         150 rows  same, TEST_SET_B                                             (GITIGNORED)
  private_manifest.json  sha256 + sizes + class counts of the private files (the commitment)   (committed)
  population.json        population size, retention rate, creator_class codes                   (committed)
Deterministic: rows arrive ordered by FARM_FINGERPRINT(account_id); splits are stratified train_test_split with
random_state = features.json split.random_state.
"""
import base64, csv, hashlib, json, os, struct
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "features.json"), encoding="utf-8"))
NAMES = [f["name"] for f in SPEC["features"]]
SEED = SPEC["split"]["random_state"]
N_CREATOR_CODES = 5  # codes 0..3 = the four wallet relayers that create nearly every activated account, 4 = any other


def compact(X, y):
    buf = bytearray()
    for row, lab in zip(X, y):
        buf += struct.pack("<%dh" % (len(row) + 1), *[int(v) for v in row], int(lab))
    return {"n": int(X.shape[1]), "b64": base64.b64encode(bytes(buf)).decode()}


def main():
    raw = pd.read_csv(os.path.join(HERE, "sample_raw.csv"))
    pop = pd.read_csv(os.path.join(HERE, "population.csv"))
    total = pop[pop.kind == "total"].iloc[0]
    creators = pop[pop.kind == "creator"].sort_values("n", ascending=False).reset_index(drop=True)
    codes = {c: i for i, c in enumerate(creators.creator.head(N_CREATOR_CODES - 1))}
    raw["creator_class"] = raw["creator"].map(lambda c: codes.get(c, N_CREATOR_CODES - 1)).astype(int)
    X = raw[NAMES].to_numpy(dtype=np.int64)
    y = raw["label"].to_numpy(dtype=np.int64)
    assert X.shape[1] == SPEC["n_features"], X.shape
    assert X.min() >= -32768 and X.max() <= 32767, "features must fit i16"
    sz = SPEC["split"]
    idx = np.arange(len(raw))
    n_priv = sz["private_a"] + sz["private_b"]
    pub, priv = train_test_split(idx, test_size=n_priv, stratify=y, random_state=SEED)
    train, hold = train_test_split(pub, test_size=sz["public_holdout"], stratify=y[pub], random_state=SEED)
    pa, pb = train_test_split(priv, test_size=sz["private_b"], stratify=y[priv], random_state=SEED)
    train, hold, pa, pb = (np.sort(v) for v in (train, hold, pa, pb))
    assert not (set(train) | set(hold)) & (set(pa) | set(pb))
    assert len(train) == sz["public_train"], len(train)

    def write_csv(path, rows):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(NAMES + ["label"])
            for i in rows:
                w.writerow(X[i].tolist() + [int(y[i])])

    write_csv(os.path.join(HERE, "public_train.csv"), train)
    write_csv(os.path.join(HERE, "public_holdout.csv"), hold)
    with open(os.path.join(HERE, "public_accounts.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["split", "row", "account_id", "created_at_utc", "creator"])
        for name, rows in (("public_train", train), ("public_holdout", hold)):
            for r, i in enumerate(rows):
                w.writerow([name, r, raw.account_id[i], raw.t0[i], raw.creator[i]])
    for name, rows in (("private_a.json", pa), ("private_b.json", pb)):
        json.dump(compact(X[rows], y[rows]), open(os.path.join(HERE, name), "w"), separators=(",", ":"))
    rowhash = lambda i: hashlib.sha256(",".join(map(str, X[i].tolist() + [int(y[i])])).encode()).hexdigest()
    pub_hashes = {rowhash(i) for i in np.concatenate([train, hold])}
    dup = [int(i) for i in np.concatenate([pa, pb]) if rowhash(i) in pub_hashes]
    sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
    counts = lambda v: {"churned": int((y[v] == 0).sum()), "retained": int((y[v] == 1).sum())}
    manifest = {
        "dataset": SPEC["source"]["dataset"], "creation_window": SPEC["source"]["creation_window"], "random_state": SEED,
        "sizes": {"public_train": len(train), "public_holdout": len(hold), "private_a": len(pa), "private_b": len(pb)},
        "class_counts": {k: counts(v) for k, v in (("public_train", train), ("public_holdout", hold), ("private_a", pa), ("private_b", pb))},
        "private_sha256": {n: sha(os.path.join(HERE, n)) for n in ("private_a.json", "private_b.json")},
        "private_bytes": {n: os.path.getsize(os.path.join(HERE, n)) for n in ("private_a.json", "private_b.json")},
        "identical_feature_rows_between_private_and_public": len(dup),
        "note": "identical rows are different accounts with the same 22 features and label (many accounts act exactly once in week 1), not shared accounts: every account appears in exactly one split",
    }
    json.dump(manifest, open(os.path.join(HERE, "private_manifest.json"), "w"), indent=2)
    created_total = int(pop[pop.kind == "created_total"].iloc[0].n)
    creators_all = pop[pop.kind == "creator_all"].sort_values("n", ascending=False)
    population = {
        "creation_window": SPEC["source"]["creation_window"],
        "registrar_creations": created_total,
        "registrar_creations_by_creator": [{"creator": r.creator, "accounts": int(r.n)} for r in creators_all.itertuples()],
        "population_accounts": int(total.n), "population_note": "accounts that initiated at least one action in their first 7 days",
        "population_retained_rate": float(total.retained_rate),
        "sample_accounts": int(len(raw)), "sample_retained_rate": round(float(y.mean()), 4),
        "creator_codes": {**{c: i for c, i in codes.items()}, "other": N_CREATOR_CODES - 1},
        "creators": [{"creator": r.creator, "accounts": int(r.n), "retained_rate": float(r.retained_rate), "code": codes.get(r.creator, N_CREATOR_CODES - 1)} for r in creators.itertuples()],
    }
    json.dump(population, open(os.path.join(HERE, "population.json"), "w"), indent=2)
    print(json.dumps(manifest, indent=2))
    print(json.dumps({k: population[k] for k in ("population_accounts", "population_retained_rate", "sample_accounts", "sample_retained_rate")}, indent=2))


if __name__ == "__main__":
    main()
