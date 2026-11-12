// Pin a new evaluator build on the contract (owner only).
//   node tools/set_evaluator.mjs <url> <sha256> [--as FT|TEAM|MAIN]
import { accountFromEnv, call, view, summary, errMsg } from "./lib.mjs";
const [url, hash] = process.argv.slice(2);
if (!url || !hash) { console.log("usage: node tools/set_evaluator.mjs <url> <sha256> [--as FT|TEAM|MAIN]"); process.exit(2); }
const i = process.argv.indexOf("--as"); const who = i >= 0 ? process.argv[i + 1] : (process.env.TEAM_ACCOUNT_ID ? "TEAM" : "FT");
const signers = { TEAM: ["TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY"], FT: ["NEAR_FT_CONTRACT_ID", "NEAR_FT_CONTRACT_PRIVATE_KEY"], MAIN: ["NEAR_ACCOUNT_ID", "NEAR_PRIVATE_KEY"] };
const signer = accountFromEnv(...signers[who]);
const C = process.env.BURSA_CONTRACT_ID || "laurel.laurel-team-mw0x0c8g.testnet";   // the final contract unless .env names another
try { summary("set_evaluator", await call(signer, C, "set_evaluator", { url, hash }, { gas: "20" })); console.log("get_evaluator ->", await view(C, "get_evaluator")); }
catch (e) { console.log("[ERR]", errMsg(e)); process.exit(1); }
