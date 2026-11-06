# Writes public/aset/snapshot.json: the contract state the page falls back to when RPC is slow.
# Uses `leaderboard`, never `list_submissions`, so split B of an open task is not stored.
import json, base64, urllib.request, os, datetime
C = "laurel.laurel-team-mw0x0c8g.testnet"
U = "https://rpc.testnet.fastnear.com"

def view(m, a={}):
    b = {"jsonrpc": "2.0", "id": "x", "method": "query", "params": {"request_type": "call_function", "finality": "optimistic", "account_id": C, "method_name": m, "args_base64": base64.b64encode(json.dumps(a).encode()).decode()}}
    r = urllib.request.Request(U, json.dumps(b).encode(), {"content-type": "application/json"})
    j = json.load(urllib.request.urlopen(r, timeout=30))
    return json.loads(bytes(j["result"]["result"]))

tasks = view("list_tasks", {"from": 0, "limit": 50})
out = {"taken_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "contract": C, "config": view("get_config"), "evaluator": view("get_evaluator"), "tasks": tasks, "boards": {}, "bytes": {}}
for t in tasks:
    rows = view("leaderboard", {"task_id": t["task_id"]})
    out["boards"][t["task_id"]] = rows
    for r in rows:
        out["bytes"][r["submission_id"]] = view("get_model_bytes", {"submission_id": r["submission_id"]})
for t in tasks:
    if t["closed"] and t["winner"] is not None:
        out["earned"] = {"id": t["winner"], "yocto": view("get_earnings", {"submission_id": t["winner"]})}
here = os.path.dirname(os.path.abspath(__file__))
json.dump(out, open(os.path.join(here, "..", "web", "public", "aset", "snapshot.json"), "w"), separators=(",", ":"))
print(len(tasks), "task", sum(len(v) for v in out["boards"].values()), "model", out["config"].keys())
