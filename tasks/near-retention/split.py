"""Same entry point as tasks/german-credit/split.py, for the site's generic snippet: builds the public and private
files of the NEAR retention task from sample_raw.csv. The raw sample itself comes from BigQuery (fetch.py), which
needs a Google Cloud login, so the two steps are separate:

    python tasks/near-retention/fetch.py --project <gcp project>   # once: sample_raw.csv + population.csv
    python tasks/near-retention/split.py                            # = build.py: splits, secrets, manifest
"""
import os, runpy, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(os.path.join(HERE, "sample_raw.csv")):
    sys.exit("sample_raw.csv missing: run fetch.py first (BigQuery), see the docstring")
runpy.run_path(os.path.join(HERE, "build.py"), run_name="__main__")
