// Who paid for predictions on the mainnet contract, read from the chain only (no key).
//   node tools/mainnet_payers.mjs [--contract laurel.ikantongkolmangut.near]
// Lists every successful predict / predict_task transaction and its paying account (the `caller` of the contract's
// `prediction` event), and separates the team's own accounts (sub-accounts of ikantongkolmangut.near and the root)
// from everyone else. Only the second group is outside demand.
const args = process.argv.slice(2);
const CONTRACT = args.includes("--contract") ? args[args.indexOf("--contract") + 1] : "laurel.ikantongkolmangut.near";
const ROOT = CONTRACT.split(".").slice(1).join(".");   // ikantongkolmangut.near
const TXAPI = "https://tx.main.fastnear.com/v0";
const post = async (url, body) => (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const isTeam = (a) => a === ROOT || a.endsWith("." + ROOT);

const acc = await post(`${TXAPI}/account`, { account_id: CONTRACT });
const hashes = acc.account_txs.filter((t) => t.is_success).map((t) => t.transaction_hash);
const rows = [];
for (let i = 0; i < hashes.length; i += 20) {
  const j = await post(`${TXAPI}/transactions`, { tx_hashes: hashes.slice(i, i + 20) });
  for (const t of j.transactions || []) {
    const m = t.transaction.actions.map((a) => a.FunctionCall?.method_name).filter(Boolean);
    if (!m.some((x) => x === "predict_task" || x === "predict")) continue;
    let caller = null;
    for (const r of t.receipts || []) for (const l of r.execution_outcome?.outcome?.logs || []) {
      if (!l.startsWith("EVENT_JSON:")) continue;
      try { const e = JSON.parse(l.slice(11)); if (e.event === "prediction") caller = e.data?.[0]?.caller; } catch {}
    }
    if (caller) rows.push({ tx: t.transaction.hash, caller, team: isTeam(caller), block: t.execution_outcome?.block_height });
  }
}
rows.sort((a, b) => (a.block ?? 0) - (b.block ?? 0));
const outside = [...new Set(rows.filter((r) => !r.team).map((r) => r.caller))];
const team = [...new Set(rows.filter((r) => r.team).map((r) => r.caller))];
console.log(`${CONTRACT}: ${rows.length} paid prediction(s)`);
for (const r of rows) console.log(`  ${r.team ? "team   " : "OUTSIDE"} ${r.caller.padEnd(40)} ${r.tx}`);
console.log(`\nteam accounts: ${team.length} (${team.join(", ")})`);
console.log(`outside accounts that paid from their own wallet: ${outside.length}${outside.length ? ` (${outside.join(", ")})` : ""}`);
