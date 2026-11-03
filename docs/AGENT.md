# Agent dengan function-call key (I-1) — 2026-11-03T16:58:18.828Z

Kontrak `bursa-dev.nh-ft-mvp6pidf.testnet`, tugas 2 (`german-credit`), pemenang submission 3. Agent `agent.nh-ft-mvp6pidf.testnet`.

**Kunci yang dipegang proses agent:** `ed25519:96oxgbsnuNhJcdT2VDynuVHgMbAcdjxPhZhckM6U3zTQ` dengan izin
```json
{
  "FunctionCall": {
    "allowance": "95380552035401200000000",
    "method_names": [
      "predict_task",
      "predict"
    ],
    "receiver_id": "bursa-dev.nh-ft-mvp6pidf.testnet"
  }
}
```
Pemilik menyetor kredit sekali dengan full-access key (`deposit_credit`, tx `vtwkytCRcm43xP47M38J8xdaRCCu8jFxjkyLUYQCRXh`); agent tidak pernah memegang kunci itu.

## 10 pemohon dari `public_holdout.csv` lewat `predict_task`

| # | skor mentah | label | label asli | keputusan simulasi | Tgas fungsi | tx |
|---|---|---|---|---|---|---|
| 0 | 811014 | 1 | 1 | minta uang muka | 4.307 | `8tTi9dbVnZfwMZkmqgMVG1FfXyihUs8MssCXraNELFMS` |
| 1 | -2218985 | 0 | 0 | tempo bayar 30 hari | 4.308 | `DLqFLgikpHc7bSHtiHiBUaH1xudavBoqqu2AwFhoGphQ` |
| 2 | -1107494 | 0 | 0 | tempo bayar 30 hari | 4.308 | `22NCTXyYLGWA8tkhAiRCKxgy6bJeAU39ynQpGH1gUYA9` |
| 3 | 2240879 | 1 | 1 | minta uang muka | 4.307 | `5om2gMJanTeiMjwznU9HatcEtrjzZzWKZkkJiuBnRTS4` |
| 4 | -436822 | 0 | 1 | tempo bayar 30 hari | 4.308 | `AsDsRsPs19ZD2KQuMfw4wZwsUt8N18FDjH2DQuWA1Vti` |
| 5 | -398029 | 0 | 0 | tempo bayar 30 hari | 4.308 | `HZkNkzSUCyxd4Qu9Rhbzdxsqs6mSw896p7SJYNC93eg` |
| 6 | -2626387 | 0 | 0 | tempo bayar 30 hari | 4.308 | `EfkBnvyN99QveLHdpgQpGyZfrZs9njiVa53LNVMnSrKn` |
| 7 | 208102 | 1 | 0 | minta uang muka | 4.307 | `HRbBav2x65nAMCGTWmCw69vkZNmWK9T7fbvuhrfjxGez` |
| 8 | 972159 | 1 | 1 | minta uang muka | 4.308 | `5fAp4HDmzYsmBZm5A5jYGZFgQ7fZnDoy62419dP7dpuK` |
| 9 | -632874 | 0 | 1 | tempo bayar 30 hari | 4.308 | `3GdcxwPN2Vf2sAxuHkAeF3KUNc8f9mKjv5BytFt69o96` |

Benar 7/10 · rata-rata **4.308 Tgas** per panggilan · fee total 0.01 NEAR dipotong dari kredit agent · pemilik model menerima 0.01 NEAR (`withdraw_earnings`).

## Yang ditolak protokol untuk kunci yang sama (sebelum kode kontrak berjalan)

| Percobaan | Hasil |
|---|---|
| FC key calls withdraw_credit (method not in key) | ditolak: `AccessKeyMethodNameMismatchActionError` |
| FC key attaches a deposit to predict_task | ditolak: `AccessKeyDepositWithFunctionCallActionError` |
| FC key calls another contract (wrap.testnet) | ditolak: `AccessKeyReceiverMismatchActionError` |
| FC key transfers NEAR | ditolak: `AccessKeyRequiresFullAccessActionError` |

Keputusan "tempo bayar" / "uang muka" hanya ilustrasi dalam simulasi (lihat `tasks/german-credit/README.md`, batasan dataset).
