source "$HOME/.cargo/env"
rustup target add wasm32-wasip2 2>&1 | tail -1
command -v outlayer >/dev/null || cargo install outlayer-cli 2>&1 | grep -vE "^\s+(Compiling|Downloaded|Downloading|Checking|Fresh|Locking|Adding)" | tail -8
echo "outlayer: $(outlayer --version 2>&1 | head -1)"
command -v wasmtime >/dev/null || cargo install wasmtime-cli 2>&1 | grep -vE "^\s+(Compiling|Downloaded|Downloading|Checking|Fresh|Locking|Adding)" | tail -5
echo "wasmtime: $(wasmtime --version 2>&1 | head -1)"
