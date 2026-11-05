"""NEAR account retention — pull the sample from BigQuery (public dataset crypto_near_mainnet_us).

    python tasks/near-retention/fetch.py --project <gcp project> [--dataset laurel_near] [--n-pos 500 --n-neg 750]
    python tasks/near-retention/fetch.py --project <gcp project> --dry-run      # only estimate bytes scanned

Needs the Google Cloud SDK (`bq`) logged in (`gcloud auth login`). Writes, in this folder:
  sample_raw.csv       1 row per sampled account: account_id, creator, t0, label, 22 features   (GITIGNORED: names private rows)
  population.csv       total + top creators with counts and retention rate                      (committed)
The creation window and sample sizes come from features.json (source.creation_window) and the flags above.
"""
import argparse, csv, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "features.json"), encoding="utf-8"))
BQ = shutil.which("bq") or shutil.which("bq.cmd") or "bq"
LOCATION = "us-east1"  # the public dataset is regional (us-east1); our scratch dataset must be there too


def ensure_dataset(project, ds):
    r = subprocess.run([BQ, f"--project_id={project}", f"--location={LOCATION}", "--quiet", "mk", "--dataset", "--default_table_expiration=5184000", ds.replace(".", ":", 1)],
                       capture_output=True, text=True, shell=(os.name == "nt"))
    if r.returncode != 0 and "already exists" not in (r.stdout + r.stderr):
        print(r.stdout, r.stderr, file=sys.stderr)
        raise SystemExit("bq mk failed")


def bq(args, sql, project, dry=False, fmt=None):
    cmd = [BQ, f"--project_id={project}", f"--location={LOCATION}", "query", "--use_legacy_sql=false", "--quiet", "--max_rows=5000"]
    if dry:
        cmd.append("--dry_run")
    if fmt:
        cmd.append(f"--format={fmt}")
    cmd += args
    print("+", " ".join(c for c in cmd if not c.startswith("--parameter")), f"({len(sql)} chars of SQL)", file=sys.stderr)
    r = subprocess.run(cmd, input=sql, capture_output=True, text=True, encoding="utf-8", shell=(os.name == "nt"))
    if r.returncode != 0:
        print(r.stdout, r.stderr, file=sys.stderr)
        raise SystemExit(f"bq failed ({r.returncode})")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--dataset", default="laurel_near")
    ap.add_argument("--n-pos", type=int, default=500)
    ap.add_argument("--n-neg", type=int, default=750)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-build", action="store_true", help="tables already exist: only export")
    ap.add_argument("--stages", default="1,2,3,4", help="which numbered stages of build_tables.sql to run (earlier tables must exist)")
    ap.add_argument("--sql", help="ad hoc: run this SQL file (with __DS__ replaced) and print CSV")
    a = ap.parse_args()
    win = SPEC["source"]["creation_window"]
    ds = f"{a.project}.{a.dataset}"
    if a.sql:
        print(bq([], open(a.sql, encoding="utf-8").read().replace("__DS__", ds), a.project, fmt="csv"))
        return
    build = open(os.path.join(HERE, "sql", "build_tables.sql"), encoding="utf-8").read().replace("__DS__", ds)
    import re
    parts = re.split(r"^(?=-- \d\. )", build, flags=re.M)  # [header with DECLAREs, stage 1, stage 2, ...]
    wanted = {int(s) for s in a.stages.split(",")}
    build = parts[0] + "".join(p for p in parts[1:] if int(p[3]) in wanted)
    stats = open(os.path.join(HERE, "sql", "population_stats.sql"), encoding="utf-8").read().replace("__DS__", ds)
    params = [f"--parameter=win_from:DATE:{win['from']}", f"--parameter=win_to:DATE:{win['to']}",
              f"--parameter=n_pos:INT64:{a.n_pos}", f"--parameter=n_neg:INT64:{a.n_neg}"]
    ensure_dataset(a.project, ds)
    if a.dry_run:
        print(bq(params, build, a.project, dry=True))
        return
    if not a.skip_build:
        print(bq(params, build, a.project))
    rows = bq([], f"SELECT * EXCEPT(h) FROM `{ds}.feats` ORDER BY h", a.project, fmt="csv")
    open(os.path.join(HERE, "sample_raw.csv"), "w", encoding="utf-8", newline="").write(rows)
    pop = bq([], stats, a.project, fmt="csv")
    open(os.path.join(HERE, "population.csv"), "w", encoding="utf-8", newline="").write(pop)
    n = sum(1 for _ in csv.DictReader(rows.splitlines()))
    print(f"sample_raw.csv: {n} rows; population.csv written. Next: python tasks/near-retention/build.py")


if __name__ == "__main__":
    main()
