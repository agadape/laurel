#!/usr/bin/env bash
# Put your NEAR MAINNET account and its private key into .env without the key ever being shown or logged.
#   bash tools/mainnet_key.sh
# The key is read with echo off, passed to node in an environment variable (not the command line), checked against
# mainnet (read-only), and written to .env, which git ignores.
set -euo pipefail
cd "$(dirname "$0")/.."
echo
echo "Laurel: save a NEAR MAINNET key to .env"
echo "Never paste this key into a chat, an issue or a screenshot. It stays in .env on this computer."
read -r -p "   Mainnet account (for example yourname.near): " ACCOUNT
read -r -s -p "   Private key (ed25519:...) or 12/24-word seed phrase (hidden): " KEY; echo
LAUREL_KEY_IN="$KEY" node tools/mainnet_key.mjs "$ACCOUNT"
unset KEY
echo
echo "To share the result, send only the lines above that start with 'saved', 'key' and 'balance'. Never send .env."
