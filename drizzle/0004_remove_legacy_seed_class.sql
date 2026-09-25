WITH seed_class AS (
  SELECT id
  FROM classes
  WHERE id = '10000000-0000-4000-8000-000000000004'
    AND name = 'Friday Quiz League'
)
DELETE FROM score_audits
WHERE weekly_score_id IN (
  SELECT ws.id
  FROM weekly_scores ws
  JOIN teams t ON t.id = ws.team_id
  JOIN seed_class sc ON sc.id = t.class_id
);--> statement-breakpoint

WITH seed_class AS (
  SELECT id
  FROM classes
  WHERE id = '10000000-0000-4000-8000-000000000004'
    AND name = 'Friday Quiz League'
)
DELETE FROM weekly_scores
WHERE team_id IN (
  SELECT t.id
  FROM teams t
  JOIN seed_class sc ON sc.id = t.class_id
);--> statement-breakpoint

WITH seed_class AS (
  SELECT id
  FROM classes
  WHERE id = '10000000-0000-4000-8000-000000000004'
    AND name = 'Friday Quiz League'
)
DELETE FROM class_teachers
WHERE class_id IN (SELECT id FROM seed_class);--> statement-breakpoint

WITH seed_class AS (
  SELECT id
  FROM classes
  WHERE id = '10000000-0000-4000-8000-000000000004'
    AND name = 'Friday Quiz League'
)
DELETE FROM league_enrolments
WHERE class_id IN (SELECT id FROM seed_class);--> statement-breakpoint

WITH seed_class AS (
  SELECT id
  FROM classes
  WHERE id = '10000000-0000-4000-8000-000000000004'
    AND name = 'Friday Quiz League'
)
DELETE FROM teams
WHERE class_id IN (SELECT id FROM seed_class);--> statement-breakpoint

DELETE FROM classes
WHERE id = '10000000-0000-4000-8000-000000000004'
  AND name = 'Friday Quiz League';
