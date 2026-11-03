#!/usr/bin/env bash
# S30 — OutLayer side, run inside WSL (Ubuntu-24.04). Reads NEAR creds from ../../.env (never prints them).
#   bash s30_outlayer.sh login      -> write ~/.outlayer/testnet/credentials.json + whoami
#   bash s30_outlayer.sh upload     -> outlayer upload wasm/evaluator.wasm  (prints FastFS URL + sha256) -> out/s30_upload.txt
#   bash s30_outlayer.sh secrets    -> store TEST_SET_A/B under the evaluator's wasm hash row (allow-all)
#   bash s30_outlayer.sh list       -> outlayer secrets list
set -uo pipefail
source "$HOME/.cargo/env"; export PATH="$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")"
ENV_FILE="../../.env"
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'; }
case "${1:-}" in
  login)
    mkdir -p "$HOME/.outlayer/testnet"
    ACC="$(val NEAR_ACCOUNT_ID)"; PK="$(val NEAR_PRIVATE_KEY)"; PUB="${2:?public key arg required}"
    printf '{"account_id":"%s","public_key":"%s","private_key":"%s","contract_id":"outlayer.testnet","auth_type":"near_key"}\n' "$ACC" "$PUB" "$PK" > "$HOME/.outlayer/testnet/credentials.json"
    chmod 600 "$HOME/.outlayer/testnet/credentials.json"; echo testnet > "$HOME/.outlayer/default-network"
    outlayer whoami 2>&1 | sed -E 's/(ed25519:)[A-Za-z0-9]{20,}/\1<hidden>/g' ;;
  upload)
    outlayer upload wasm/evaluator.wasm 2>&1 | tee out/s30_upload.txt ;;
  secrets)
    HASH="${2:?wasm sha256 arg required}"
    SECRETS=$(python3 -c 'import json;print(json.dumps({"TEST_SET_A":open("out/test_set.json").read(),"TEST_SET_B":open("out/test_set_b.json").read()}))')
    echo "secrets payload bytes: ${#SECRETS}"
    outlayer secrets set "$SECRETS" --wasm-hash "$HASH" --access allow-all 2>&1 | tee out/s30_secrets.txt ;;
  list) outlayer secrets list 2>&1 ;;
  *) echo "usage: $0 login <pubkey> | upload | secrets <hash> | list"; exit 2 ;;
esac
