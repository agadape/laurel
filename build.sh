#!/usr/bin/env bash
# Build/test inside WSL (Ubuntu-24.04). From Git Bash on Windows:
#   MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec /bin/bash /mnt/c/Project_Dave/NEAR_Hackathon_2/build.sh <what>
#   what: test | contract | evaluator | local | all   (default: all)
set -uo pipefail
source "$HOME/.cargo/env"
export PATH="$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")"
export CARGO_TARGET_DIR="$HOME/nh-target-bursa"
mkdir -p wasm
filt() { grep -vE '^\s+(Compiling|Downloaded|Downloading|Checking|Fresh|Locking|Adding|Updating)'; }
what="${1:-all}"
s=$(date +%s)
if [[ "$what" == "test" || "$what" == "all" ]]; then
  echo "===== cargo test (gbdt-core, bursa)"
  cargo test -p gbdt-core -p bursa -p credit-desk --release 2>&1 | filt | grep -E "Running|test result|panicked|error(\[|:)|FAILED"; echo "exit=${PIPESTATUS[0]}"
  echo "===== cargo test evaluator (no host feature)"
  cargo test -p evaluator --release --no-default-features 2>&1 | filt | grep -E "Running|test result|panicked|error(\[|:)|FAILED"; echo "exit=${PIPESTATUS[0]}"
fi
if [[ "$what" == "contract" || "$what" == "all" ]]; then
  echo "===== cargo near build contracts/bursa"
  cargo near build non-reproducible-wasm --manifest-path contracts/bursa/Cargo.toml --out-dir wasm 2>&1 | filt | tail -8; echo "exit=${PIPESTATUS[0]}"
  echo "===== cargo near build contracts/consumer-example"
  cargo near build non-reproducible-wasm --manifest-path contracts/consumer-example/Cargo.toml --out-dir wasm 2>&1 | filt | tail -4; echo "exit=${PIPESTATUS[0]}"
fi
if [[ "$what" == "evaluator" || "$what" == "all" ]]; then
  echo "===== cargo build evaluator (wasm32-wasip2, host)"
  cargo build -p evaluator --release --target wasm32-wasip2 2>&1 | filt | tail -5; echo "exit=${PIPESTATUS[0]}"
  cp "$CARGO_TARGET_DIR/wasm32-wasip2/release/evaluator.wasm" wasm/evaluator.wasm && sha256sum wasm/evaluator.wasm | tee wasm/evaluator.wasm.sha256
fi
if [[ "$what" == "local" ]]; then
  echo "===== evaluator without host feature + wasmtime (needs tasks/<slug>/private_*.json and a model.hex)"
  cargo build -p evaluator --release --target wasm32-wasip2 --no-default-features 2>&1 | filt | tail -3
  cp "$CARGO_TARGET_DIR/wasm32-wasip2/release/evaluator.wasm" wasm/evaluator_local.wasm
  echo "run: printf '{\"submission_id\":1,\"model_hex\":\"...\"}' | wasmtime run --env TEST_SET_A=\"\$(cat A)\" --env TEST_SET_B=\"\$(cat B)\" wasm/evaluator_local.wasm"
fi
echo "took=$(( $(date +%s) - s ))s"; ls -la wasm 2>/dev/null
