"""Baseline GBDT for the NEAR account retention task. Trains on public_train.csv ONLY.

    python tasks/near-retention/train.py                       # 50 trees, depth 4 -> model_baseline.pkl
    python tasks/near-retention/train.py --trees 10 --depth 2 --out model_weak.pkl
    python tasks/near-retention/train.py --trees 80 --depth 4 --lr 0.08

Prints balanced accuracy / F1 on public_holdout.csv (float sklearn). Convert with tools/export.py.
"""
import argparse, json, os, pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import balanced_accuracy_score, f1_score

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name):
    df = pd.read_csv(os.path.join(HERE, name))
    return df.drop(columns=["label"]).to_numpy(dtype=np.int64), df["label"].to_numpy(dtype=np.int64)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trees", type=int, default=50)
    ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--lr", type=float, default=0.1)
    ap.add_argument("--pos-weight", type=float, default=None, help="sample weight of class 1 (retained); default n_neg/n_pos")
    ap.add_argument("--out", default="model_baseline.pkl")
    a = ap.parse_args()
    Xtr, ytr = load("public_train.csv")
    Xho, yho = load("public_holdout.csv")
    w_pos = a.pos_weight if a.pos_weight else (ytr == 0).sum() / (ytr == 1).sum()
    sw = np.where(ytr == 1, w_pos, 1.0)
    clf = GradientBoostingClassifier(n_estimators=a.trees, max_depth=a.depth, learning_rate=a.lr, random_state=90)
    clf.fit(Xtr, ytr, sample_weight=sw)
    pred = clf.predict(Xho)
    report = {
        "trees": a.trees, "depth": a.depth, "lr": a.lr, "pos_weight": round(float(w_pos), 3),
        "nodes": int(sum(e[0].tree_.node_count for e in clf.estimators_)),
        "holdout_balanced_accuracy": round(float(balanced_accuracy_score(yho, pred)), 4),
        "holdout_f1_retained": round(float(f1_score(yho, pred)), 4),
        "holdout_accuracy": round(float((pred == yho).mean()), 4),
        "train_balanced_accuracy": round(float(balanced_accuracy_score(ytr, clf.predict(Xtr))), 4),
    }
    out = os.path.join(HERE, a.out)
    pickle.dump(clf, open(out, "wb"))
    json.dump(report, open(out.replace(".pkl", ".report.json"), "w"), indent=2)
    print(json.dumps(report, indent=2))
    print("saved", out)


if __name__ == "__main__":
    main()
