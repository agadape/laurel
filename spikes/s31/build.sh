#!/usr/bin/env bash
# S31/S30 build inside WSL (Ubuntu-24.04):
#   bash build.sh test       -> gbdt-core unit tests (native) incl. Python vectors
#   bash build.sh contract   -> cargo-near build -> wasm/s31_bursa_spike.wasm
#   bash build.sh evaluator  -> wasm32-wasip2 build (host feature) -> wasm/evaluator.wasm + sha256
#   bash build.sh local      -> wasip2 build without host feature, run under wasmtime with secrets from out/
#   bash build.sh all
set -uo pipefail
source "$HOME/.cargo/env"
export PATH="$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")"
export CARGO_TARGET_DIR="$HOME/nh-target-s31"
mkdir -p wasm
filt() { grep -vE '^\s+(Compiling|Downloaded|Downloading|Checking|Fresh|Locking|Adding|Updating)' ; }
what="${1:-all}"
s=$(date +%s)
if [[ "$what" == "test" || "$what" == "all" ]]; then
  echo "===== test gbdt-core"; cargo test -p gbdt-core --release -- --nocapture 2>&1 | filt | tail -15; echo "exit=${PIPESTATUS[0]}"
fi
if [[ "$what" == "contract" || "$what" == "all" ]]; then
  echo "===== build contract"; cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml --out-dir wasm 2>&1 | filt | tail -12; echo "exit=${PIPESTATUS[0]}"
fi
if [[ "$what" == "evaluator" || "$what" == "all" ]]; then
  echo "===== build evaluator (wasip2, host)"; cargo build -p evaluator --release --target wasm32-wasip2 2>&1 | filt | tail -12; echo "exit=${PIPESTATUS[0]}"
  cp "$CARGO_TARGET_DIR/wasm32-wasip2/release/evaluator.wasm" wasm/evaluator.wasm && sha256sum wasm/evaluator.wasm
fi
if [[ "$what" == "local" || "$what" == "all" ]]; then
  echo "===== build evaluator (wasip2, no host) + wasmtime run"
  cargo build -p evaluator --release --target wasm32-wasip2 --no-default-features 2>&1 | filt | tail -5; echo "exit=${PIPESTATUS[0]}"
  cp "$CARGO_TARGET_DIR/wasm32-wasip2/release/evaluator.wasm" wasm/evaluator_local.wasm
  if command -v wasmtime >/dev/null; then
    printf '{"model_id":1,"model_hex":"%s"}' "$(cat out/model.hex)" | wasmtime run --env TEST_SET_A="$(cat out/test_set.json)" --env TEST_SET_B="$(cat out/test_set_b.json)" wasm/evaluator_local.wasm; echo; echo "wasmtime exit=$?"
  else echo "wasmtime not installed yet"; fi
fi
echo "took=$(( $(date +%s) - s ))s"; ls -la wasm
