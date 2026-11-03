import React, { useEffect, useState } from "react";
import { view, contractId, yoctoToNear, bps, nsToDate, short, statusText, statusDetail, EXPLORER_ACCOUNT, EXPLORER_TX } from "./rpc.js";

// ---------- tiny hash router: #/ , #/task/2 , #/model/3 , #/biaya ----------
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const f = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("/");
  return { page: parts[0] || "tasks", id: Number(parts[1]) || null };
}

function useView(method, args, deps) {
  const [state, set] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    set({ loading: true });
    view(method, args).then((data) => alive && set({ data })).catch((e) => alive && set({ error: String(e.message || e) }));
    return () => { alive = false; };
  }, deps); // eslint-disable-line
  return state;
}

function Cmd({ children }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="cmd">
      <pre>{children}</pre>
      <button onClick={() => { navigator.clipboard?.writeText(children); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? "disalin" : "salin"}</button>
    </div>
  );
}

const Countdown = ({ ns }) => {
  const d = nsToDate(ns); const ms = d - Date.now();
  if (ms <= 0) return <span>lewat ({d.toLocaleString()})</span>;
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return <span>{h} j {m} m lagi ({d.toLocaleString()})</span>;
};

// ---------- screens ----------
function Tasks() {
  const { data, error, loading } = useView("list_tasks", { from: 0, limit: 50 }, []);
  return (
    <>
      <h2>Tugas</h2>
      <p className="sub">Tantangan model keputusan. Peserta melatih di data publik; evaluator di TEE (OutLayer) menilai pada test set privat yang terikat ke hash evaluator. Pemenang menjadi <code>predict_task</code> yang bisa dipanggil kontrak dan agent.</p>
      {loading && <p className="muted">memuat…</p>}
      {error && <p className="err">RPC: {error}</p>}
      <div className="grid">
        {(data || []).slice().reverse().map((t) => (
          <div className="card" key={t.task_id}>
            <h3><a href={`#/task/${t.task_id}`}>#{t.task_id} · {t.title}</a></h3>
            <p className="sub">{t.closed ? <span className="badge closed">ditutup · pemenang #{t.winner}</span> : <span className="badge open">terbuka</span>} <span className="badge">{t.n_features} fitur</span> <span className="badge">{t.submission_count} submission</span></p>
            <dl className="kv">
              <dt>slug</dt><dd className="mono">{t.slug}</dd>
              <dt>deadline</dt><dd><Countdown ns={t.deadline_ns} /></dd>
              <dt>fee per panggilan</dt><dd>{yoctoToNear(t.fee_per_call, 4)} NEAR</dd>
              <dt>biaya submit</dt><dd>{yoctoToNear(t.submission_fee, 2)} NEAR + storage model</dd>
              <dt>pembuat</dt><dd className="mono">{t.creator}</dd>
            </dl>
          </div>
        ))}
      </div>
      {data && data.length === 0 && <p className="muted">Belum ada tugas di kontrak ini.</p>}
    </>
  );
}

function Task({ id }) {
  const t = useView("get_task", { task_id: id }, [id]);
  const lb = useView("leaderboard", { task_id: id }, [id]);
  const task = t.data;
  if (t.loading) return <p className="muted">memuat…</p>;
  if (t.error || !task) return <p className="err">Tugas {id} tidak ditemukan. {t.error}</p>;
  const rows = lb.data || [];
  const best = Math.max(1, ...rows.map((r) => (task.closed ? r.score_b_bps : r.score_a_bps) || 0));
  return (
    <>
      <p className="sub"><a href="#/">← semua tugas</a></p>
      <h2>#{task.task_id} · {task.title} {task.closed ? <span className="badge closed">ditutup</span> : <span className="badge open">terbuka</span>}</h2>
      <dl className="kv card">
        <dt>slug</dt><dd className="mono">{task.slug}</dd>
        <dt>fitur ({task.n_features})</dt><dd className="mono">{task.feature_names.join(", ")}</dd>
        <dt>deadline</dt><dd><Countdown ns={task.deadline_ns} /></dd>
        <dt>metrik</dt><dd>balanced accuracy (bps) · peringkat sementara = split A, final = split B (dibuka saat tutup)</dd>
        <dt>secret test set</dt><dd className="mono">{task.secrets_account} / profil {task.secrets_profile} (hanya evaluator dengan hash terpin yang bisa membaca)</dd>
        <dt>fee per panggilan</dt><dd>{yoctoToNear(task.fee_per_call, 4)} NEAR · kuota {task.max_per_account} submission per akun</dd>
        {task.closed && <><dt>pemenang</dt><dd><a href={`#/model/${task.winner}`}>submission #{task.winner}</a> → <code>predict_task({task.task_id}, features)</code></dd></>}
      </dl>
      <h3>Leaderboard {task.closed ? "final (split B)" : "sementara (split A)"}</h3>
      {lb.error && <p className="err">{lb.error}</p>}
      <table>
        <thead><tr><th>#</th><th>submission</th><th>pemilik</th><th className="num">bal. acc. A</th><th className="num">F1 A</th>{task.closed && <th className="num">bal. acc. B</th>}<th className="num">byte</th><th className="num">pohon</th><th>status</th><th className="num">panggilan</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const score = task.closed ? r.score_b_bps : r.score_a_bps;
            return (
              <tr key={r.submission_id}>
                <td>{i + 1} {task.closed && r.submission_id === task.winner && <span className="badge win">pemenang</span>}</td>
                <td><a href={`#/model/${r.submission_id}`}>#{r.submission_id}</a></td>
                <td className="mono">{short(r.owner, 14)}</td>
                <td className="num">{bps(r.score_a_bps)}</td>
                <td className="num">{bps(r.f1_a_bps)}</td>
                {task.closed && <td className="num">{bps(r.score_b_bps)}</td>}
                <td className="num">{r.bytes.toLocaleString()}</td>
                <td className="num">{r.trees}</td>
                <td><span className={`badge ${statusText(r.status) === "Failed" ? "fail" : ""}`}>{statusText(r.status)}</span>{score != null && <div className="bar" title={bps(score)}><i style={{ width: `${(score / best) * 100}%` }} /></div>}</td>
                <td className="num">{r.calls}</td>
              </tr>
            );
          })}
          {rows.length === 0 && !lb.loading && <tr><td colSpan={10} className="muted">belum ada submission</td></tr>}
        </tbody>
      </table>
      <h3>Buat tugas seperti ini (CLI, pembuat tugas)</h3>
      <Cmd>{`python tasks/${task.slug}/split.py                                   # data publik + split privat + manifest sha256
bash tools/secrets.sh ${task.slug} ${task.secrets_profile} <hash evaluator>   # (WSL) simpan test set privat, terikat ke hash evaluator
node tools/create_task.mjs ${task.slug} --minutes 1440 --as TEAM`}</Cmd>
      <h3>Ikut (CLI, peserta)</h3>
      <p className="sub">Semua aksi tulis lewat skrip di repo (tanpa wallet di browser). Latih di <code>tasks/{task.slug}/public_train.csv</code>, ekspor, lalu kirim:</p>
      <Cmd>{`python tasks/${task.slug}/train.py --trees 50 --depth 4
python tools/export.py --task ${task.slug} --model tasks/${task.slug}/model_baseline.pkl --out tasks/${task.slug}/out/mine
node tools/submit.mjs ${task.task_id} tasks/${task.slug}/out/mine/model.bin --as P1      # kontrak: ${contractId()}`}</Cmd>
      {task.closed && (<>
        <h3>Panggil model pemenang dari agent</h3>
        <Cmd>{`node tools/predict.mjs ${task.task_id} --row 0 --as AGENT --deposit 0.02     # prabayar sekali, lalu panggilan berikutnya hanya memakai function-call key
node tools/agent.mjs ${task.task_id} --rows 10                                 # 10 pemohon + bukti kunci terbatas ditolak protokol`}</Cmd>
      </>)}
    </>
  );
}

function Model({ id }) {
  const s = useView("get_submission", { submission_id: id }, [id]);
  const e = useView("get_earnings", { submission_id: id }, [id]);
  const cfg = useView("get_config", {}, []);
  const sub = s.data;
  if (s.loading) return <p className="muted">memuat…</p>;
  if (s.error || !sub) return <p className="err">Submission {id} tidak ditemukan. {s.error}</p>;
  let raw = null; try { raw = sub.last_outlayer_raw ? JSON.parse(sub.last_outlayer_raw) : null; } catch { raw = null; }
  return (
    <>
      <p className="sub"><a href={`#/task/${sub.task_id}`}>← tugas #{sub.task_id}</a></p>
      <h2>Model #{sub.submission_id} <span className={`badge ${statusText(sub.status) === "Failed" ? "fail" : ""}`}>{statusText(sub.status)}</span></h2>
      <dl className="kv card">
        <dt>pemilik</dt><dd className="mono"><a href={EXPLORER_ACCOUNT(sub.owner)} target="_blank" rel="noreferrer">{sub.owner}</a></dd>
        <dt>ukuran</dt><dd>{sub.bytes.toLocaleString()} byte · {sub.trees} pohon · {sub.nodes.toLocaleString()} node</dd>
        <dt>sha256 model</dt><dd className="mono">{sub.model_hash}</dd>
        <dt>dikirim</dt><dd>{nsToDate(sub.submitted_at_ns).toLocaleString()}</dd>
        <dt>split A</dt><dd>bal. acc. {bps(sub.score_a_bps)} · F1 {bps(sub.f1_a_bps)}</dd>
        <dt>split B</dt><dd>{sub.score_b_bps != null ? <>bal. acc. {bps(sub.score_b_bps)} · F1 {bps(sub.f1_b_bps)}</> : <span className="muted">disembunyikan sampai tugas ditutup</span>}</dd>
        <dt>panggilan</dt><dd>{sub.calls} · earnings {e.data ? yoctoToNear(e.data, 4) : "…"} NEAR (ditarik pemilik lewat <code>withdraw_earnings</code>)</dd>
        <dt>evaluator terpin</dt><dd className="mono">{cfg.data ? <>{short(cfg.data.evaluator_hash, 12)} · <a href={cfg.data.evaluator_url} target="_blank" rel="noreferrer">wasm</a></> : "…"}</dd>
        {statusDetail(sub.status) && <><dt>detail status</dt><dd className="mono">{statusDetail(sub.status)}</dd></>}
      </dl>
      <h3>Output evaluator (disimpan on-chain, ≤ 900 B)</h3>
      <pre>{raw ? JSON.stringify(raw, null, 2) : (sub.last_outlayer_raw || "belum diskor")}</pre>
      <h3>Panggil model ini</h3>
      <p className="sub">Change method bermeter: fee dipotong dari kredit prabayar pemanggil. Fitur = integer sesuai urutan fitur tugas (German Credit: 18 integer, skala 1). Skor mentah &gt; 0 ⇒ kelas positif.</p>
      <Cmd>{`node tools/predict.mjs ${sub.task_id} --submission ${sub.submission_id} --row 0 --as AGENT`}</Cmd>
      <Cmd>{`near contract call-function as-transaction ${contractId()} predict json-args '{"submission_id":${sub.submission_id},"features":[0,24,2,3,2500,0,2,3,0,2,1,35,2,1,1,2,1,0]}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' sign-as <agent> network-config testnet`}</Cmd>
    </>
  );
}

function Costs() {
  const cfg = useView("get_config", {}, []);
  return (
    <>
      <h2>Biaya dan cara kerja</h2>
      <p className="sub">Angka di bawah diukur di testnet pada 2–3 Nov 2026 (tx di <code>docs/GAS.md</code> dan <code>docs/AGENT.md</code> di repo). Gas 1 Tgas ≈ 0,0001 NEAR pada harga gas dasar.</p>
      <table>
        <thead><tr><th>Operasi</th><th>Model</th><th className="num">Tgas (receipt fungsi)</th><th>Bukti</th></tr></thead>
        <tbody>
          <tr><td><code>predict_task</code> (agent, FC key)</td><td>German Credit 50×4, 33 KB</td><td className="num">4,31</td><td><a href={EXPLORER_TX("8tTi9dbVnZfwMZkmqgMVG1FfXyihUs8MssCXraNELFMS")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>predict</code></td><td>sintetis 100×6, 197 KB</td><td className="num">13,20</td><td><a href={EXPLORER_TX("F8Az4MKFdqRYHRw6Pq4RZDrSUs7RJ4nuZZ9qv46Tuqd8")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>submit_model</code> (validasi + storage)</td><td>33 KB</td><td className="num">10,20</td><td><a href={EXPLORER_TX("14BSwbzAViKnu7esMQTf9bN1L3vQiywjMQGqAEX5Tcmv")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>request_score</code> → OutLayer → callback</td><td>33 KB, 2×150 baris</td><td className="num">12,5 total · ~10 s</td><td><a href={EXPLORER_TX("593SvaUAZLXjrQ2f5XkCnpKTnW8EkYT7h1o1Xmski3oq")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td><code>close_task</code></td><td>—</td><td className="num">2,23</td><td><a href={EXPLORER_TX("2VLWMbGvyKTJgtekf5Bd4q1F73oSyFpbsM61LAum2cZP")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td>kontrak lain → <code>predict_task</code> → callback (<code>credit-desk</code>)</td><td>German Credit 50×4</td><td className="num">8,85 total</td><td><a href={EXPLORER_TX("BNR63PPUcD6RgjQyN8nQ1i2iP9uJQfGPcLrozsHAcGz6")} target="_blank" rel="noreferrer">tx</a></td></tr>
          <tr><td>e2e dari nol (23 langkah, 17 uji negatif)</td><td>—</td><td className="num">228 s</td><td><a href="https://github.com/" target="_blank" rel="noreferrer">docs/E2E.md</a></td></tr>
        </tbody>
      </table>
      <h3>Alur</h3>
      <pre>{`pembuat tugas  ─ outlayer secrets set --wasm-hash <EVALUATOR> ─►  OutLayer (test set privat, terenkripsi)
               ─ create_task ──────────────────────────────────►  bursa (kontrak registry)
peserta        ─ export.py → model.bin ─ submit_model ─────────►  bursa menyimpan model sebagai DATA (borsh), validasi struktur
               ─ request_score ────────────────────────────────►  bursa → OutLayer.request_execution(evaluator terpin, secrets_ref tugas)
                                                                  worker TEE: evaluator view(get_model_bytes) → skor A/B → on_score callback
siapa pun      ─ close_task (setelah deadline) ─────────────────►  pemenang = skor split B tertinggi
agent/kontrak  ─ predict_task(task_id, features) ───────────────►  inferensi di dalam konsensus; fee dari kredit prabayar → earnings pemilik`}</pre>
      <h3>Yang dijamin dan yang tidak</h3>
      <ul>
        <li>Evaluator yang menilai ditentukan kontrak (hash dipin oleh owner), bukan oleh peserta. Secret hanya terbuka untuk hash itu: build lain mendapat <code>TEST_SET_A missing</code> (diuji 2 Nov).</li>
        <li>Model berjalan di dalam konsensus NEAR: hasil <code>predict</code> identik dengan evaluator dan Python (diuji per vektor).</li>
        <li>Agent memakai function-call key: protokol menolak <code>withdraw_credit</code>, deposit, kontrak lain, dan transfer dari kunci itu (lihat <code>docs/AGENT.md</code>).</li>
        <li><b>Tidak dijamin:</b> anti-Sybil (hanya kuota 3/akun + biaya submit), kerahasiaan skor B dari log OutLayer, dan kerahasiaan dataset yang memang publik (German Credit: split privat melindungi dari overfitting lewat umpan balik, bukan dari pengunduhan data asli).</li>
        <li>Dataset German Credit (1994, Jerman) dipakai sebagai <b>simulasi</b>; bukan alat penilaian kredit manusia.</li>
      </ul>
      {cfg.data && <p className="muted mono">kontrak {contractId()} · evaluator {cfg.data.evaluator_hash} · batas model {cfg.data.max_model_bytes.toLocaleString()} B / {cfg.data.max_trees} pohon</p>}
    </>
  );
}

export default function App() {
  const { page, id } = useRoute();
  return (
    <>
      <header>
        <div className="wrap">
          <h1><a href="#/">Laurel</a></h1>
          <nav><a href="#/">Tugas</a><a href="#/biaya">Biaya &amp; cara kerja</a></nav>
          <span className="contract"><a href={EXPLORER_ACCOUNT(contractId())} target="_blank" rel="noreferrer">{contractId()}</a> · testnet · baca-saja</span>
        </div>
      </header>
      <main className="wrap">
        {page === "tasks" && <Tasks />}
        {page === "task" && <Task id={id} />}
        {page === "model" && <Model id={id} />}
        {page === "biaya" && <Costs />}
      </main>
      <footer>Dibangun di NEAR HACKATHON 2026 · semua angka berasal dari view RPC kontrak, tidak ada data tiruan · project saudara: Undo</footer>
    </>
  );
}
