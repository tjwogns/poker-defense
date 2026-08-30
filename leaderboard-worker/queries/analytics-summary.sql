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

SELECT
  CAST(json_extract(properties_json, '$.handRank') AS INTEGER) AS hand_rank,
  COUNT(*) AS purchases,
  ROUND(AVG(CAST(json_extract(properties_json, '$.level') AS REAL)), 1) AS avg_level,
  ROUND(AVG(CAST(json_extract(properties_json, '$.cost') AS REAL)), 1) AS avg_cost
FROM analytics_events
WHERE name = 'maintenance_mastery_purchase'
  AND received_at >= datetime('now', '-7 days')
GROUP BY hand_rank
ORDER BY purchases DESC, hand_rank;

SELECT
  CAST(json_extract(properties_json, '$.damageRanks[0]') AS INTEGER) AS main_damage_rank,
  COUNT(*) AS finished_runs,
  ROUND(AVG(CAST(json_extract(properties_json, '$.round') AS REAL)), 1) AS avg_round,
  ROUND(100.0 * AVG(CASE WHEN json_extract(properties_json, '$.result') = 'victory' THEN 1.0 ELSE 0.0 END), 1) AS victory_percent
FROM analytics_events
WHERE name = 'run_finished'
  AND received_at >= datetime('now', '-7 days')
  AND json_array_length(json_extract(properties_json, '$.damageRanks')) > 0
GROUP BY main_damage_rank
ORDER BY finished_runs DESC, main_damage_rank;

SELECT
  COUNT(DISTINCT CASE WHEN name = 'run_started' THEN run_id END) AS run_started,
  COUNT(DISTINCT CASE WHEN name = 'combat_started' THEN run_id END) AS first_combat,
  COUNT(DISTINCT CASE
    WHEN name = 'boss_encountered'
      AND CAST(json_extract(properties_json, '$.bossRound') AS INTEGER) = 10 THEN run_id
  END) AS round_10,
  COUNT(DISTINCT CASE
    WHEN name = 'boss_encountered'
      AND CAST(json_extract(properties_json, '$.bossRound') AS INTEGER) = 30 THEN run_id
  END) AS round_30,
  COUNT(DISTINCT CASE
    WHEN name = 'boss_encountered'
      AND CAST(json_extract(properties_json, '$.bossRound') AS INTEGER) = 60 THEN run_id
  END) AS round_60,
  COUNT(DISTINCT CASE WHEN name = 'run_finished' THEN run_id END) AS run_finished,
  COUNT(DISTINCT CASE WHEN name = 'retry_clicked' THEN run_id END) AS retry_clicked
FROM analytics_events
WHERE received_at >= datetime('now', '-7 days');

WITH encounters AS (
  SELECT
    CAST(json_extract(properties_json, '$.bossRound') AS INTEGER) AS boss_round,
    COUNT(DISTINCT run_id) AS encountered
  FROM analytics_events
  WHERE name = 'boss_encountered' AND received_at >= datetime('now', '-7 days')
  GROUP BY boss_round
), defeats AS (
  SELECT
    CAST(json_extract(properties_json, '$.bossRound') AS INTEGER) AS boss_round,
    COUNT(DISTINCT run_id) AS defeated,
    COUNT(DISTINCT CASE
      WHEN CAST(json_extract(properties_json, '$.roundsLate') AS INTEGER) = 0 THEN run_id
    END) AS defeated_same_round,
    ROUND(AVG(CAST(json_extract(properties_json, '$.combatSecondsSinceSpawn') AS REAL)), 1) AS avg_kill_seconds
  FROM analytics_events
  WHERE name = 'boss_defeated' AND received_at >= datetime('now', '-7 days')
  GROUP BY boss_round
), survived AS (
  SELECT
    CAST(json_extract(properties_json, '$.bossRound') AS INTEGER) AS boss_round,
    COUNT(DISTINCT run_id) AS survived,
    ROUND(AVG(CAST(json_extract(properties_json, '$.hpPercent') AS REAL)), 1) AS avg_hp_percent
  FROM analytics_events
  WHERE name = 'boss_survived' AND received_at >= datetime('now', '-7 days')
  GROUP BY boss_round
)
SELECT
  encounters.boss_round,
  encounters.encountered,
  COALESCE(defeats.defeated_same_round, 0) AS defeated_same_round,
  COALESCE(defeats.defeated, 0) AS defeated_eventually,
  COALESCE(survived.survived, 0) AS survived_round,
  defeats.avg_kill_seconds,
  survived.avg_hp_percent
FROM encounters
LEFT JOIN defeats USING (boss_round)
LEFT JOIN survived USING (boss_round)
ORDER BY encounters.boss_round;

SELECT
  json_extract(properties_json, '$.outcome') AS boss_outcome,
  COUNT(*) AS events
FROM analytics_events
WHERE name = 'boss_survived'
  AND received_at >= datetime('now', '-7 days')
GROUP BY boss_outcome
ORDER BY events DESC;

WITH visitor_days AS (
  SELECT DISTINCT visitor_hash, date(received_at) AS active_day
  FROM analytics_events
  WHERE visitor_hash IS NOT NULL
), cohorts AS (
  SELECT visitor_hash, MIN(active_day) AS first_day
  FROM visitor_days
  GROUP BY visitor_hash
), eligible AS (
  SELECT visitor_hash, first_day
  FROM cohorts
  WHERE first_day >= date('now', '-30 days')
    AND first_day < date('now')
)
SELECT
  COUNT(*) AS eligible_visitors_30d,
  SUM(CASE WHEN EXISTS (
    SELECT 1 FROM visitor_days
    WHERE visitor_days.visitor_hash = eligible.visitor_hash
      AND visitor_days.active_day = date(eligible.first_day, '+1 day')
  ) THEN 1 ELSE 0 END) AS returned_d1,
  ROUND(100.0 * SUM(CASE WHEN EXISTS (
    SELECT 1 FROM visitor_days
    WHERE visitor_days.visitor_hash = eligible.visitor_hash
      AND visitor_days.active_day = date(eligible.first_day, '+1 day')
  ) THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS d1_retention_percent
FROM eligible;
