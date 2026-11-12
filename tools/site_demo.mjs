// The account behind the site's "Ask the champion" button (web/api/ask.mjs).
//   node tools/site_demo.mjs [--fund 1.5] [--credit 0.6]
// Creates guest.<team account> once, prepays prediction credit, and adds a FUNCTION-CALL key that can only call
// predict_task/predict on the Laurel contract. That key (GUEST_FC_PRIVATE_KEY in .env, never printed) is the only
// secret the web server gets: if it leaks, it can buy predictions with the guest's credit and nothing else.
// Run again any time to top the credit back up to --credit.
import { accountFromEnv, saveEnv, provider, summary, errMsg, sleep, view, call, Account, KeyPair, actions, nearToYocto, yoctoToNear } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const C = process.env.BURSA_CONTRACT_ID;
if (!C) { console.log("BURSA_CONTRACT_ID missing in .env"); process.exit(2); }

try {
  let guest;
  if (process.env.GUEST_ACCOUNT_ID) guest = accountFromEnv("GUEST_ACCOUNT_ID", "GUEST_PRIVATE_KEY");
  else {
    const team = accountFromEnv("TEAM_ACCOUNT_ID", "TEAM_PRIVATE_KEY");
    const kp = KeyPair.fromRandom("ed25519");
    const id = `guest.${team.accountId}`;
    summary(`create ${id}`, await team.createSubAccount({ accountOrPrefix: "guest", publicKey: kp.getPublicKey(), nearToTransfer: nearToYocto(opt("fund", "1.5")) }));
    saveEnv({ GUEST_ACCOUNT_ID: id, GUEST_PRIVATE_KEY: kp.toString() });
    for (let i = 0; i < 10; i++) { try { await provider.viewAccount({ accountId: id }); break; } catch { await sleep(1500); } }
    guest = new Account(id, provider, kp.toString());
  }
  const G = guest.accountId;

  const want = BigInt(nearToYocto(opt("credit", "0.6")));
  const have = BigInt(await view(C, "get_credit", { account_id: G }));
  if (have < want) summary("deposit_credit", await call(guest, C, "deposit_credit", {}, { deposit: want - have, gas: "30" }));

  let fc = process.env.GUEST_FC_PRIVATE_KEY ? KeyPair.fromString(process.env.GUEST_FC_PRIVATE_KEY) : null;
  if (fc) {
    try {
      const info = await provider.viewAccessKey({ accountId: G, publicKey: fc.getPublicKey().toString() });
      if (info.permission?.FunctionCall?.receiver_id !== C) fc = null;
    } catch { fc = null; }
  }
  if (!fc) {
    fc = KeyPair.fromRandom("ed25519");
    saveEnv({ GUEST_FC_PRIVATE_KEY: fc.toString() });
    summary("add function-call key", await guest.signAndSendTransaction({ receiverId: G, actions: [actions.addFunctionCallAccessKey(fc.getPublicKey(), C, ["predict_task", "predict"], nearToYocto("0.8"))] }));
    await sleep(1500);
  }
  const key = await provider.viewAccessKey({ accountId: G, publicKey: fc.getPublicKey().toString() });
  const acc = await provider.viewAccount({ accountId: G });
  console.log(`\n${G}: balance ${yoctoToNear(BigInt(acc.amount), 3)} NEAR, credit ${yoctoToNear(BigInt(await view(C, "get_credit", { account_id: G })), 4)} NEAR`);
  console.log(`site key ${fc.getPublicKey().toString()}: ${JSON.stringify(key.permission)}`);
  console.log("Vercel env for web/api/ask.mjs: LAUREL_GUEST_ID = GUEST_ACCOUNT_ID, LAUREL_GUEST_KEY = GUEST_FC_PRIVATE_KEY (from .env)");
} catch (e) { console.log("[ERR]", errMsg(e)); process.exit(1); }
