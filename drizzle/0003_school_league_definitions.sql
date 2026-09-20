WITH definitions(scope, year_group, phase, name) AS (
  VALUES
    ('year_group'::"league_scope", 7, NULL::text, 'Year 7 League'),
    ('year_group'::"league_scope", 8, NULL::text, 'Year 8 League'),
    ('year_group'::"league_scope", 9, NULL::text, 'Year 9 League'),
    ('year_group'::"league_scope", 10, NULL::text, 'Year 10 League'),
    ('year_group'::"league_scope", 11, NULL::text, 'Year 11 League'),
    ('year_group'::"league_scope", 12, NULL::text, 'Year 12 League'),
    ('year_group'::"league_scope", 13, NULL::text, 'Year 13 League'),
    ('phase'::"league_scope", NULL::integer, 'lower', 'Lower School League'),
    ('phase'::"league_scope", NULL::integer, 'middle', 'Middle School League'),
    ('phase'::"league_scope", NULL::integer, 'upper', 'Upper School League')
)
INSERT INTO leagues (quiz_series_id, name, scope, year_group, phase, starts_on, ends_on)
SELECT qs.id, d.name, d.scope, d.year_group, d.phase, qs.starts_on, qs.ends_on
FROM quiz_series qs CROSS JOIN definitions d
WHERE NOT EXISTS (
  SELECT 1 FROM leagues l WHERE l.quiz_series_id = qs.id AND l.scope = d.scope
    AND l.year_group IS NOT DISTINCT FROM d.year_group AND l.phase IS NOT DISTINCT FROM d.phase
);--> statement-breakpoint

UPDATE leagues SET name = 'Whole School League' WHERE scope = 'whole_school';
