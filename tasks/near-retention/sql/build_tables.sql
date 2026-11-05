-- NEAR account retention: population, labels, stratified sample and 22 integer features, all from the public
-- BigQuery dataset `bigquery-public-data.crypto_near_mainnet_us` (NEAR Public Lakehouse). Run by fetch.py with
-- `bq query --use_legacy_sql=false --parameter=...`; writes tables into the dataset named by @ds (default laurel_near).
-- Every stage filters on block_date (the partition column) so the scan stays in the free tier.
DECLARE win_from DATE DEFAULT @win_from;   -- first creation day (UTC), inclusive
DECLARE win_to   DATE DEFAULT @win_to;     -- last creation day (UTC), inclusive
DECLARE n_pos    INT64 DEFAULT @n_pos;     -- positives (retained) in the sample
DECLARE n_neg    INT64 DEFAULT @n_neg;     -- negatives (churned) in the sample

-- 1. Population: named top-level `.near` accounts whose CREATE_ACCOUNT receipt came from the `near` registrar and
--    succeeded, and that initiated at least one action in their first 7 days (see `activated`). t0 = creation block time; creator = signer of the create_account transaction; deposit = NEAR
--    transferred in the same receipt.
CREATE OR REPLACE TABLE `__DS__.pop_all` AS
WITH cre AS (
  SELECT receipt_id, receipt_receiver_account_id AS account_id, signer_account_id AS creator,
         block_timestamp_utc AS t0, block_date
  FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
  WHERE block_date BETWEEN win_from AND win_to
    AND action_kind = 'CREATE_ACCOUNT'
    AND receipt_predecessor_account_id = 'near'
    AND ENDS_WITH(receipt_receiver_account_id, '.near')
    AND ARRAY_LENGTH(SPLIT(receipt_receiver_account_id, '.')) = 2
),
ok AS (
  SELECT c.*
  FROM cre c
  JOIN `bigquery-public-data.crypto_near_mainnet_us.execution_outcomes` eo
    ON eo.receipt_id = c.receipt_id AND eo.block_date BETWEEN win_from AND DATE_ADD(win_to, INTERVAL 1 DAY)
  WHERE eo.status IN ('SUCCESS_VALUE', 'SUCCESS_RECEIPT_ID')
),
dep AS (
  SELECT receipt_id, SUM(SAFE_CAST(JSON_VALUE(args, '$.deposit') AS BIGNUMERIC)) AS deposit_yocto
  FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
  WHERE block_date BETWEEN win_from AND win_to AND action_kind = 'TRANSFER' AND receipt_predecessor_account_id = 'near'
  GROUP BY receipt_id
)
SELECT ok.account_id, ok.creator, ok.t0, ok.receipt_id AS creation_receipt, COALESCE(dep.deposit_yocto, 0) AS deposit_yocto
FROM ok LEFT JOIN dep USING (receipt_id)
QUALIFY ROW_NUMBER() OVER (PARTITION BY ok.account_id ORDER BY ok.t0) = 1;

-- 1b. In scope only if the account initiated at least one action in its first 7 days.
CREATE OR REPLACE TABLE `__DS__.pop` AS
SELECT b.*
FROM `__DS__.pop_all` b
WHERE EXISTS (
  SELECT 1 FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions` ra
  WHERE ra.receipt_predecessor_account_id = b.account_id
    AND ra.block_date BETWEEN win_from AND DATE_ADD(win_to, INTERVAL 8 DAY)
    AND ra.block_timestamp_utc >= b.t0 AND ra.block_timestamp_utc < TIMESTAMP_ADD(b.t0, INTERVAL 7 DAY)
);

-- 2. Label for the whole population: the account initiated at least one action in [t0+30d, t0+90d).
--    "Initiated" = receipt_predecessor_account_id = account. This counts transactions the account signed itself AND
--    actions it sent through a relayer as a meta-transaction (NEP-366), where the relayer is the transaction signer.
CREATE OR REPLACE TABLE `__DS__.labels` AS
SELECT p.account_id,
       COUNTIF(ra.block_timestamp_utc >= TIMESTAMP_ADD(p.t0, INTERVAL 30 DAY)
               AND ra.block_timestamp_utc < TIMESTAMP_ADD(p.t0, INTERVAL 90 DAY)) AS n_30_90
FROM `__DS__.pop` p
LEFT JOIN `bigquery-public-data.crypto_near_mainnet_us.receipt_actions` ra
  ON ra.receipt_predecessor_account_id = p.account_id
 AND ra.block_date BETWEEN DATE_ADD(win_from, INTERVAL 30 DAY) AND DATE_ADD(win_to, INTERVAL 91 DAY)
GROUP BY p.account_id;

-- 3. Deterministic stratified sample: n_pos retained + n_neg churned, ordered by a hash of the account id.
CREATE OR REPLACE TABLE `__DS__.sample` AS
WITH lab AS (
  SELECT p.*, IF(l.n_30_90 >= 1, 1, 0) AS label, FARM_FINGERPRINT(p.account_id) AS h
  FROM `__DS__.pop` p JOIN `__DS__.labels` l USING (account_id)
)
SELECT * FROM (SELECT * FROM lab WHERE label = 1 ORDER BY h LIMIT @n_pos)   -- LIMIT takes a literal or a query parameter, not a variable
UNION ALL
SELECT * FROM (SELECT * FROM lab WHERE label = 0 ORDER BY h LIMIT @n_neg);

-- 4. Features from the first 7 days after creation, for the sampled accounts only.
CREATE OR REPLACE TABLE `__DS__.feats` AS
WITH s AS (SELECT account_id, creator, t0, creation_receipt, deposit_yocto, label, h FROM `__DS__.sample`),
tx AS (  -- actions the account initiated in the window (as transaction signer or through a relayer)
  SELECT s.account_id, ra.block_timestamp_utc AS ts, ra.receipt_receiver_account_id AS receiver_account_id, ra.receipt_id
  FROM s JOIN `bigquery-public-data.crypto_near_mainnet_us.receipt_actions` ra
    ON ra.receipt_predecessor_account_id = s.account_id
   AND ra.block_date BETWEEN win_from AND DATE_ADD(win_to, INTERVAL 8 DAY)
   AND ra.block_timestamp_utc >= s.t0 AND ra.block_timestamp_utc < TIMESTAMP_ADD(s.t0, INTERVAL 7 DAY)
),
rx AS (  -- actions from other accounts whose receiver is the account (not refunds, not its own)
  SELECT s.account_id, COUNT(DISTINCT ra.receipt_id) AS tx_received_7d
  FROM s JOIN `bigquery-public-data.crypto_near_mainnet_us.receipt_actions` ra
    ON ra.receipt_receiver_account_id = s.account_id AND ra.receipt_predecessor_account_id NOT IN (s.account_id, 'system')
   AND ra.receipt_id != s.creation_receipt
   AND ra.block_date BETWEEN win_from AND DATE_ADD(win_to, INTERVAL 8 DAY)
   AND ra.block_timestamp_utc >= s.t0 AND ra.block_timestamp_utc < TIMESTAMP_ADD(s.t0, INTERVAL 7 DAY)
  GROUP BY s.account_id
),
act AS (  -- the actions themselves (kind, receiver, method, deposit), initiated by the account
  SELECT s.account_id, ra.action_kind, ra.receipt_receiver_account_id AS receiver,
         JSON_VALUE(ra.args, '$.method_name') AS method,
         SAFE_CAST(JSON_VALUE(ra.args, '$.deposit') AS BIGNUMERIC) AS deposit_yocto
  FROM s JOIN `bigquery-public-data.crypto_near_mainnet_us.receipt_actions` ra
    ON ra.receipt_predecessor_account_id = s.account_id
   AND ra.block_date BETWEEN win_from AND DATE_ADD(win_to, INTERVAL 8 DAY)
   AND ra.block_timestamp_utc >= s.t0 AND ra.block_timestamp_utc < TIMESTAMP_ADD(s.t0, INTERVAL 7 DAY)
),
onacc AS (  -- actions executed on the account itself, after the creation receipt
  SELECT s.account_id, ra.action_kind, ra.receipt_predecessor_account_id AS predecessor,
         SAFE_CAST(JSON_VALUE(ra.args, '$.deposit') AS BIGNUMERIC) AS deposit_yocto
  FROM s JOIN `bigquery-public-data.crypto_near_mainnet_us.receipt_actions` ra
    ON ra.receipt_receiver_account_id = s.account_id AND ra.receipt_id != s.creation_receipt
   AND ra.block_date BETWEEN win_from AND DATE_ADD(win_to, INTERVAL 8 DAY)
   AND ra.block_timestamp_utc >= s.t0 AND ra.block_timestamp_utc < TIMESTAMP_ADD(s.t0, INTERVAL 7 DAY)
),
agg_tx AS (
  SELECT account_id, COUNT(DISTINCT receipt_id) AS tx_signed_7d, COUNT(DISTINCT DATE(ts)) AS active_days_7d,
         COUNT(DISTINCT receiver_account_id) AS unique_receivers_7d, MIN(ts) AS first_ts
  FROM tx GROUP BY account_id
),
agg_act AS (
  SELECT account_id,
         COUNTIF(action_kind = 'FUNCTION_CALL') AS fn_calls_7d,
         COUNT(DISTINCT IF(action_kind = 'FUNCTION_CALL', method, NULL)) AS distinct_methods_7d,
         COUNT(DISTINCT IF(action_kind = 'FUNCTION_CALL', receiver, NULL)) AS distinct_contracts_7d,
         COUNTIF(action_kind = 'TRANSFER') AS transfers_out_7d,
         SUM(IF(action_kind = 'TRANSFER', deposit_yocto, 0)) AS near_out_yocto,
         MAX(IF(action_kind = 'STAKE' OR (action_kind = 'FUNCTION_CALL' AND (ENDS_WITH(receiver, '.poolv1.near') OR ENDS_WITH(receiver, '.pool.near') OR receiver IN ('meta-pool.near', 'linear-protocol.near'))), 1, 0)) AS staked_7d,
         MAX(IF(action_kind = 'FUNCTION_CALL' AND receiver IN ('v2.ref-finance.near', 'dclv2.ref-labs.near', 'wrap.near', 'contract.main.burrow.near', 'intents.near', 'aurora'), 1, 0)) AS touched_defi_7d
  FROM act GROUP BY account_id
),
agg_on AS (
  SELECT account_id,
         SUM(IF(action_kind = 'TRANSFER' AND predecessor NOT IN (account_id, 'system'), deposit_yocto, 0)) AS near_in_yocto,
         COUNTIF(action_kind = 'ADD_KEY') AS keys_added_7d,
         MAX(IF(action_kind = 'DEPLOY_CONTRACT', 1, 0)) AS deployed_contract_7d
  FROM onacc GROUP BY account_id
)
SELECT s.account_id, s.creator, s.t0, s.label, s.h,
       EXTRACT(HOUR FROM s.t0) AS created_hour_utc,
       MOD(EXTRACT(DAYOFWEEK FROM s.t0) + 5, 7) AS created_weekday,          -- 0 = Monday
       LENGTH(REGEXP_REPLACE(s.account_id, r'\.near$', '')) AS name_len,
       LENGTH(REGEXP_REPLACE(REGEXP_REPLACE(s.account_id, r'\.near$', ''), r'[^0-9]', '')) AS name_digits,
       IF(REGEXP_CONTAINS(REGEXP_REPLACE(s.account_id, r'\.near$', ''), r'[-_]'), 1, 0) AS name_has_separator,
       CAST(LEAST(DIV(s.deposit_yocto, BIGNUMERIC "1000000000000000000000"), 32767) AS INT64) AS initial_deposit_mnear,
       LEAST(COALESCE(a.tx_signed_7d, 0), 32767) AS tx_signed_7d,
       COALESCE(a.active_days_7d, 0) AS active_days_7d,
       IF(a.first_ts IS NULL, 7, TIMESTAMP_DIFF(a.first_ts, s.t0, DAY)) AS days_to_first_tx,
       LEAST(COALESCE(a.unique_receivers_7d, 0), 32767) AS unique_receivers_7d,
       LEAST(COALESCE(b.fn_calls_7d, 0), 32767) AS fn_calls_7d,
       LEAST(COALESCE(b.distinct_methods_7d, 0), 32767) AS distinct_methods_7d,
       LEAST(COALESCE(b.distinct_contracts_7d, 0), 32767) AS distinct_contracts_7d,
       LEAST(COALESCE(b.transfers_out_7d, 0), 32767) AS transfers_out_7d,
       CAST(LEAST(DIV(COALESCE(b.near_out_yocto, 0), BIGNUMERIC "1000000000000000000000"), 32767) AS INT64) AS near_out_7d_mnear,
       CAST(LEAST(DIV(COALESCE(c.near_in_yocto, 0), BIGNUMERIC "1000000000000000000000"), 32767) AS INT64) AS near_in_7d_mnear,
       LEAST(COALESCE(r.tx_received_7d, 0), 32767) AS tx_received_7d,
       LEAST(COALESCE(c.keys_added_7d, 0), 32767) AS keys_added_7d,
       COALESCE(c.deployed_contract_7d, 0) AS deployed_contract_7d,
       COALESCE(b.staked_7d, 0) AS staked_7d,
       COALESCE(b.touched_defi_7d, 0) AS touched_defi_7d
FROM s
LEFT JOIN agg_tx a USING (account_id)
LEFT JOIN agg_act b USING (account_id)
LEFT JOIN agg_on c USING (account_id)
LEFT JOIN rx r USING (account_id);
