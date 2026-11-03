# Run the evaluator locally (no host feature) under wasmtime against a task's private splits.
#   (WSL) bash tools/eval_local.sh <slug> <model.hex>
source "$HOME/.cargo/env"; export PATH="$HOME/.cargo/bin:$HOME/.wasmtime/bin:$PATH"; set -e
cd "$(dirname "$0")/.."; export CARGO_TARGET_DIR="$HOME/nh-target-bursa"
slug="${1:?slug}"; hex="${2:?model.hex}"
cargo build -p evaluator --release --target wasm32-wasip2 --no-default-features 2>&1 | grep -E "Finished|error" | tail -2
printf '{"submission_id":1,"task_slug":"%s","model_hex":"%s"}' "$slug" "$(cat "$hex")" \
  | wasmtime run --env TEST_SET_A="$(cat tasks/$slug/private_a.json)" --env TEST_SET_B="$(cat tasks/$slug/private_b.json)" \
    "$CARGO_TARGET_DIR/wasm32-wasip2/release/evaluator.wasm"; echo
