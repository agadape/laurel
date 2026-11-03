# Biaya gas terukur (C-6) — 2026-11-02T12:08:19.216Z

Kontrak: `bursa-dev.nh-ft-mvp6pidf.testnet` (wasm 286680 B, storage akun 287184 B ≈ 2.87 NEAR terkunci). Evaluator: spike S30 (`dcc4aa66…`). Model probe **sintetis** (`make_classification`), hanya untuk mengukur gas; bukan model demo.

| Langkah | Model | Tgas total | Tgas receipt fungsi | Tx |
|---|---|---|---|---|
| `create_task` | — | 3.281 | 2.508 | `GgQru3CVqMXWifEUm3W1PZjtcWuFEaGotaec4RWisVxh` |
| `submit_model` | 50×4, 33319 B | 13.295 | 10.197 | `14BSwbzAViKnu7esMQTf9bN1L3vQiywjMQGqAEX5Tcmv` |
| `submit_model` | 100×6, 197551 B | 57.785 | 44.246 | `5g8ZfGnrnoAucweZyxKdyi6eQvXSjXEeHPHJ8uxcaKc1` |
| `request_score` (+OutLayer+callback) | 50×4 | 12.549 | — | `593SvaUAZLXjrQ2f5XkCnpKTnW8EkYT7h1o1Xmski3oq` (9652 ms, status "Scored", A 8400 / B 8650) |
| `request_score` (+OutLayer+callback) | 100×6 | 12.549 | — | `4XcQ7u89bCw5qbj7PXPzsra2fGSdaHXcEaKbCV9R6gci` (9984 ms, A 8850 / B 9100) |
| `predict` | 50×4 | 4.573 | **4.26** | `6vgSqsuWWorm7MoSZwhLfeXJ35srxYWUWQ3XZncddSj5` (skor -1865183, Python -1865183) |
| `predict` | 100×6 | 13.515 | **13.202** | `F8Az4MKFdqRYHRw6Pq4RZDrSUs7RJ4nuZZ9qv46Tuqd8` |
| `close_task` | — | 2.534 | 2.225 | `2SfSafHD1myEY8jfZFSTJ3sQ4VKWxCrgUw7jq9ee78W8` |
| `predict_task` ×3 | pemenang | 13.536 / 13.537 / 13.536 | 13.224 / 13.224 / 13.224 | `DbnJZTAGD3MHnkE8pvzD6iNN5aUTFQZ7k93KPRes9qCN` … |

Biaya storage: 1 NEAR per 100 KB model (dipotong presisi dari deposit pengirim). Kriteria C-6 (`predict` ≤ 8 Tgas untuk model ≤ 60 KB): **lolos** (4.26 Tgas).
