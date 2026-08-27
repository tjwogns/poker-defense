SELECT
  COUNT(*) AS events_7d,
  COUNT(DISTINCT session_id) AS sessions_7d,
  COUNT(DISTINCT CASE WHEN name = 'run_started' THEN run_id END) AS runs_started_7d,
  COUNT(DISTINCT CASE WHEN name = 'run_finished' THEN run_id END) AS runs_finished_7d
FROM analytics_events
WHERE received_at >= datetime('now', '-7 days');

SELECT
  name,
  COUNT(*) AS events
FROM analytics_events
WHERE received_at >= datetime('now', '-7 days')
GROUP BY name
ORDER BY events DESC, name ASC;

SELECT
  CAST(json_extract(properties_json, '$.round') AS INTEGER) AS round,
  COUNT(*) AS reached
FROM analytics_events
WHERE name = 'round_reached'
  AND received_at >= datetime('now', '-7 days')
GROUP BY round
ORDER BY round;

SELECT
  json_extract(properties_json, '$.level') AS upgrade_level,
  COUNT(*) AS purchases
FROM analytics_events
WHERE name = 'upgrade_bought'
  AND received_at >= datetime('now', '-7 days')
GROUP BY upgrade_level
ORDER BY CAST(upgrade_level AS INTEGER);

SELECT
  json_extract(properties_json, '$.relic') AS relic,
  COUNT(*) AS selections
FROM analytics_events
WHERE name = 'relic_selected'
  AND received_at >= datetime('now', '-7 days')
GROUP BY relic
ORDER BY selections DESC;
