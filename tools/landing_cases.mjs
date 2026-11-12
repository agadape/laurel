// Writes web/public/aset/holdout.json: the public holdout rows the landing page's "Ask the champion" picks from.
//   node tools/landing_cases.mjs
// Every row of tasks/<dataset>/public_holdout.csv goes in, with its true label, so the page never cherry-picks.
// For NEAR account retention each row also carries the account's name, creation time and creator from
// public_accounts.csv (public mainnet data, already in this repository).
import fs from "node:fs";
import path from "node:path";
import { root } from "./lib.mjs";

const csv = (f) => fs.readFileSync(f, "utf8").trim().split(/\r?\n/).map((l) => l.split(","));
const out = { note: "public holdout rows of each Laurel dataset: features in contract order, then the true label", datasets: [] };

for (const key of ["near-retention", "german-credit"]) {
  const dir = path.join(root, "tasks", key);
  const spec = JSON.parse(fs.readFileSync(path.join(dir, "features.json"), "utf8"));
  const [head, ...lines] = csv(path.join(dir, "public_holdout.csv"));
  const ds = { key, feature_names: head.slice(0, -1), rows: lines.map((l) => l.map(Number)) };
  if (JSON.stringify(ds.feature_names) !== JSON.stringify(spec.features.map((f) => f.name))) throw new Error(`${key}: csv header differs from features.json`);
  const accounts = path.join(dir, "public_accounts.csv");
  if (fs.existsSync(accounts)) {
    const rows = csv(accounts).filter((r) => r[0] === "public_holdout").sort((a, b) => a[1] - b[1]);
    if (rows.length !== ds.rows.length) throw new Error(`${key}: ${rows.length} named accounts for ${ds.rows.length} rows`);
    ds.accounts = rows.map((r) => [r[2], r[3], r[4]]);
  }
  // code -> meaning for coded features, as an array indexed by code
  ds.codes = {};
  for (const f of spec.features) {
    if (!f.codes || !f.meaning || typeof f.meaning !== "object") continue;
    const arr = [];
    for (const [uci, code] of Object.entries(f.codes)) arr[code] = f.meaning[uci];
    ds.codes[f.name] = arr;
  }
  out.datasets.push(ds);
}
const dest = path.join(root, "web", "public", "aset", "holdout.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${path.relative(root, dest)}: ${out.datasets.map((d) => `${d.key} ${d.rows.length} rows`).join(", ")}, ${(fs.statSync(dest).size / 1024).toFixed(1)} KB`);
