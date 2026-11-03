source "$HOME/.cargo/env"; cd "$(dirname "$0")"; export CARGO_TARGET_DIR="$HOME/nh-target-s31"
EVAL_BUILD_TAG=negative-test cargo build -p evaluator --release --target wasm32-wasip2 2>&1 | grep -E "Finished|error" | tail -3
cp "$CARGO_TARGET_DIR/wasm32-wasip2/release/evaluator.wasm" wasm/evaluator_negative.wasm; sha256sum wasm/evaluator_negative.wasm
