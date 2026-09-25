WITH active_year_enrolments AS (
  SELECT
    le.class_id,
    le.enrolled_on,
    c.year_group,
    CASE
      WHEN c.year_group <= 9 THEN 'lower'
      WHEN c.year_group <= 11 THEN 'middle'
      ELSE 'upper'
    END AS phase,
    year_league.quiz_series_id
  FROM league_enrolments le
  JOIN leagues year_league ON year_league.id = le.league_id
  JOIN classes c ON c.id = le.class_id
  WHERE le.status = 'active'
    AND year_league.scope = 'year_group'
    AND year_league.year_group = c.year_group
),
eligible_rollups AS (
  SELECT l.id AS league_id, aye.class_id, aye.enrolled_on
  FROM active_year_enrolments aye
  JOIN leagues l ON l.quiz_series_id = aye.quiz_series_id
    AND (
      (l.scope = 'phase' AND l.phase = aye.phase)
      OR l.scope = 'whole_school'
    )
)
INSERT INTO league_enrolments (league_id, class_id, status, enrolled_on, withdrawn_on)
SELECT league_id, class_id, 'active', enrolled_on, NULL
FROM eligible_rollups
ON CONFLICT (league_id, class_id) DO NOTHING;
