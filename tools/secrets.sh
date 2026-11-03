#!/usr/bin/env bash
# ML-2b — store a task's private splits as OutLayer secrets, bound to the pinned evaluator hash.
#   (WSL)  bash tools/secrets.sh <slug> [profile=<slug>] [hash=wasm/evaluator.wasm.sha256]
# Uses the outlayer CLI login of the *task creator* (see spikes/s31/s30_outlayer.sh login). The row is
# keyed by (wasm_hash, profile, owner): only a run of exactly that evaluator build can read it.
set -euo pipefail
source "$HOME/.cargo/env"; export PATH="$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")/.."
slug="${1:?slug}"; profile="${2:-$slug}"; hash="${3:-$(cut -c1-64 wasm/evaluator.wasm.sha256)}"
A="tasks/$slug/private_a.json"; B="tasks/$slug/private_b.json"
[ -f "$A" ] && [ -f "$B" ] || { echo "run tasks/$slug/split.py first"; exit 1; }
payload=$(python3 -c 'import json,sys;print(json.dumps({"TEST_SET_A":open(sys.argv[1]).read(),"TEST_SET_B":open(sys.argv[2]).read()}))' "$A" "$B")
echo "profile=$profile hash=$hash payload_bytes=${#payload} (CLI deposit must cover storage; upstream CLI attaches 0.1 NEAR ≈ 7 KB)"
outlayer whoami | head -2
outlayer secrets set "$payload" --wasm-hash "$hash" --profile "$profile" --access allow-all
echo; echo "stored. verify with: outlayer secrets list"
