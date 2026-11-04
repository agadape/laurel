# Agent dengan function-call key (I-1) — 2026-11-04T09:37:35.567Z

Kontrak `laurel.laurel-team-mw0x0c8g.testnet`, tugas 3 (`credit-risk`), pemenang submission 4. Agent `agent.laurel-team-mw0x0c8g.testnet`.

**Kunci yang dipegang proses agent:** `ed25519:QBy4d6eVYonkZxWjtyfULKYjPsW29MhpXXqSDfMFwpQ` dengan izin
```json
{
  "FunctionCall": {
    "allowance": "997677934748424300000000",
    "method_names": [
      "predict_task",
      "predict"
    ],
    "receiver_id": "laurel.laurel-team-mw0x0c8g.testnet"
  }
}
```
Pemilik menyetor kredit sekali dengan full-access key (`deposit_credit`); agent tidak pernah memegang kunci itu.

## 10 pemohon dari `public_holdout.csv` lewat `predict_task`

| # | skor mentah | label | label asli | keputusan simulasi | Tgas fungsi | tx |
|---|---|---|---|---|---|---|
| 0 | 811014 | 1 | 1 | minta uang muka | 4.34 | `B9cHP7YV9qBbBKNjnZSn5ZfB8szyU4rj7TVJdrhSkDN2` |
| 1 | -2218985 | 0 | 0 | tempo bayar 30 hari | 4.341 | `CYcEhECbVAeA3yQivKLML5fcetFRLb2DTsf5dFkPMZWj` |
| 2 | -1107494 | 0 | 0 | tempo bayar 30 hari | 4.341 | `HKQWGCwc93FShkdH1hvfMHjmW9o6bRKE3gzpgA3vJbmL` |
| 3 | 2240879 | 1 | 1 | minta uang muka | 4.341 | `EpZ8T7hX3xZVRq8mWDEjeWDbxpwpjx4WYYQDBVa16ANa` |
| 4 | -436822 | 0 | 1 | tempo bayar 30 hari | 4.341 | `8ZmWtByXLVDP7aW7NeZTnUnUcoy7XFZF4chBb3jsmF2M` |
| 5 | -398029 | 0 | 0 | tempo bayar 30 hari | 4.341 | `J1HzpmJfrvxS7UrQWJx4iuGJLSouAovq5aAYpnqgs5FA` |
| 6 | -2626387 | 0 | 0 | tempo bayar 30 hari | 4.341 | `HcmJmRF77cht1LRA7d6jPmy3sfMobfvM5xYRBJkRCkMM` |
| 7 | 208102 | 1 | 0 | minta uang muka | 4.34 | `5e3DEh3e3NP3LCr3aEXY7XrVU889QrKCkwDK1RZj87qR` |
| 8 | 972159 | 1 | 1 | minta uang muka | 4.341 | `GXHUAWNqqbnDYf3vfqNck5qE2t9griNZqi2bC4hfYLGU` |
| 9 | -632874 | 0 | 1 | tempo bayar 30 hari | 4.341 | `4EgWGe2LMpqWgwRwb9v7iEQ8tTqmCUesKXbqUK2UC4kb` |

Benar 7/10 · rata-rata **4.341 Tgas** per panggilan · fee total 0.01 NEAR dipotong dari kredit agent · pemilik model menerima 0.01 NEAR (`withdraw_earnings`).

## Yang ditolak protokol untuk kunci yang sama (sebelum kode kontrak berjalan)

| Percobaan | Hasil |
|---|---|
| FC key calls withdraw_credit (method not in key) | ditolak: `AccessKeyMethodNameMismatchActionError` |
| FC key attaches a deposit to predict_task | ditolak: `AccessKeyDepositWithFunctionCallActionError` |
| FC key calls another contract (wrap.testnet) | ditolak: `AccessKeyReceiverMismatchActionError` |
| FC key transfers NEAR | ditolak: `AccessKeyRequiresFullAccessActionError` |

Keputusan "tempo bayar" / "uang muka" hanya ilustrasi dalam simulasi (lihat `tasks/german-credit/README.md`, batasan dataset).
