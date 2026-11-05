-- Population summary for population.json: registrar creations, activated accounts, retention rate, top creators.
SELECT 'created_total' AS kind, CAST(NULL AS STRING) AS creator, COUNT(*) AS n, CAST(NULL AS FLOAT64) AS retained_rate FROM `__DS__.pop_all`
UNION ALL
SELECT 'total', NULL, COUNT(*), ROUND(AVG(IF(l.n_30_90 >= 1, 1, 0)), 4)
FROM `__DS__.pop` p JOIN `__DS__.labels` l USING (account_id)
UNION ALL
SELECT * FROM (
  SELECT 'creator_all' AS kind, creator, COUNT(*) AS n, CAST(NULL AS FLOAT64) AS retained_rate
  FROM `__DS__.pop_all` GROUP BY creator ORDER BY n DESC LIMIT 10
)
UNION ALL
SELECT * FROM (
  SELECT 'creator' AS kind, p.creator, COUNT(*) AS n, ROUND(AVG(IF(l.n_30_90 >= 1, 1, 0)), 4) AS retained_rate
  FROM `__DS__.pop` p JOIN `__DS__.labels` l USING (account_id)
  GROUP BY p.creator ORDER BY n DESC LIMIT 25
)
ORDER BY kind, n DESC;
