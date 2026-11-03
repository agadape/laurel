source "$HOME/.cargo/env" 2>/dev/null
echo "rustc: $(rustc --version 2>&1)"; echo "cargo-near: $(cargo near --version 2>&1 | head -1)"
echo "targets: $(rustup target list --installed 2>&1 | tr '\n' ' ')"
echo "wasmtime: $(which wasmtime 2>&1) $(wasmtime --version 2>&1 | head -1)"
echo "python: $(python3 --version 2>&1)"; python3 -c "import sklearn,numpy;print('sklearn',sklearn.__version__)" 2>&1 | tail -1
echo "pip: $(python3 -m pip --version 2>&1 | head -1)"
echo "node: $(node --version 2>&1)"
