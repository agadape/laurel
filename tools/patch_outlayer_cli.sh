#!/usr/bin/env bash
# Build a local outlayer-cli whose `secrets set` attaches 0.5 NEAR of storage deposit.
# Upstream hard-codes 0.1 NEAR (≈ 7 KB of secrets); our task secrets are ≈ 15 KB. Approved by the team 3 Nov.
#   (WSL) bash tools/patch_outlayer_cli.sh
source "$HOME/.cargo/env"; set -e
cd "$HOME"
[ -d outlayer-cli ] || git clone --depth 1 https://github.com/out-layer/outlayer-cli.git
cd outlayer-cli
echo "before:"; grep -n "100_000_000_000_000_000_000_000u128" src/commands/secrets.rs | head
sed -i 's/100_000_000_000_000_000_000_000u128; \/\/ 0.1 NEAR/500_000_000_000_000_000_000_000u128; \/\/ 0.5 NEAR (local patch: large task secrets)/' src/commands/secrets.rs
echo "after:"; grep -n "500_000_000_000_000_000_000_000u128" src/commands/secrets.rs | head
cargo install --path . --force 2>&1 | grep -vE "^\s+(Compiling|Downloaded|Downloading|Checking|Fresh|Locking|Adding|Updating)" | tail -3
outlayer --version
