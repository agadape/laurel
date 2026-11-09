#!/usr/bin/env bash
# Laurel quickstart for macOS / Linux: installs what the one-command entry needs, asks for your testnet account once,
# rehearses without sending anything, then (if you say yes) enters the competition for real.
#
#   bash quickstart.sh                 # task 5 (default)
#   bash quickstart.sh --task 4
#   bash quickstart.sh --trees 40 --depth 3
#
# Nothing here costs real money: everything runs on NEAR testnet.
set -euo pipefail
cd "$(dirname "$0")"

TASK=5; EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --task) TASK="$2"; shift 2 ;;
    --trees|--depth|--lr|--model) EXTRA+=("$1" "$2"); shift 2 ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
done

say()  { printf '\n\033[36m== %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mXX %s\033[0m\n' "$1"; exit 1; }

say "1/5  Checking Node.js and Python"
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Get the LTS installer at https://nodejs.org"
NODE_MAJOR=$(node --version | sed 's/^v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js $(node --version) is too old; version 18 or newer is needed: https://nodejs.org"
PY=""
for c in python3 python; do   # on Windows, python3 may be a Store stub that only prints a message: test that it really runs
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys' >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -n "$PY" ] || fail "Python is not installed. Get 3.10 or newer at https://www.python.org/downloads/"
PYV=$("$PY" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' || fail "Python $PYV is too old; 3.10 or newer is needed"
echo "   node $(node --version), $PY $PYV"

say "2/5  Installing the Node packages (tools/) and the Python packages"
(cd tools && npm install --no-fund --no-audit --loglevel=error) || fail "npm install failed (see above)"
"$PY" -m pip install --quiet --disable-pip-version-check scikit-learn pandas numpy \
  || "$PY" -m pip install --quiet --disable-pip-version-check --user scikit-learn pandas numpy \
  || fail "pip install failed (see above). Try: $PY -m pip install scikit-learn pandas numpy"
echo "   done"

say "3/5  Your NEAR testnet account"
if [ -f .env ] && grep -qE '^NEAR_ACCOUNT_ID=\S+' .env && grep -qE '^NEAR_PRIVATE_KEY=ed25519:\S+' .env; then
  echo "   using $(grep -E '^NEAR_ACCOUNT_ID=' .env | cut -d= -f2) from .env"
else
  echo "   You need a free NEAR *testnet* account and its private key (starts with ed25519:)."
  echo "   Easiest: Meteor Wallet (https://wallet.meteorwallet.app) > create wallet > switch network to TESTNET"
  echo "   > Settings > Security > Export private key. Full steps with pictures: docs/QUICKSTART.md, step 1."
  echo
  read -r -p "   Account id (something.testnet): " ID
  [[ "$ID" =~ ^[a-z0-9._-]+\.testnet$ ]] || fail "that does not look like a testnet account id (expected something.testnet)"
  read -r -p "   Private key (ed25519:...): " KEY
  [[ "$KEY" =~ ^ed25519:[1-9A-HJ-NP-Za-km-z]{80,100}$ ]] || fail "that does not look like a NEAR private key (expected ed25519: followed by about 88 characters)"
  if [ -f .env ]; then grep -vE '^NEAR_(ACCOUNT_ID|PRIVATE_KEY)=' .env > .env.tmp || true; mv .env.tmp .env; fi
  printf 'NEAR_ACCOUNT_ID=%s\nNEAR_PRIVATE_KEY=%s\n' "$ID" "$KEY" >> .env
  echo "   saved to .env (this file is ignored by git; never share it)"
fi

say "4/5  Rehearsal: train, export, let the contract validate and quote the cost (nothing is sent)"
node tools/quickstart.mjs --task "$TASK" "${EXTRA[@]}" --dry || fail "the rehearsal stopped (the message above says why)"

say "5/5  Enter for real?"
echo "   This stores your model on the contract, pays the task fee and asks the TEE to score it (testnet NEAR only)."
read -r -p "   Type yes to enter, anything else to stop: " GO || GO=""
[ "$GO" = "yes" ] || { echo "   stopped; nothing was sent. Run the script again when ready."; exit 0; }
node tools/quickstart.mjs --task "$TASK" "${EXTRA[@]}" || fail "the entry did not complete (the message above says why)"
printf '\n\033[32mDone. Open https://laurel-near.vercel.app, connect the same testnet wallet, and find your model on exhibit %s.\033[0m\n' "$TASK"
