# Friday Quiz League — implementation plan

## Recommended stack

- Vite + React + TypeScript for the responsive web app.
- Neon Postgres for the source of truth.
- A small server/API layer (Vercel Functions or Neon Functions) for writes and admin authentication.
- Recharts or a canvas chart component for the cumulative-points graph.

Neon is the better fit than Airtable. Scores, weekly rounds and teams are naturally relational; it avoids exposing an Airtable token to a browser and gives reliable history, validation and future term roll-over. Airtable could still be used as an optional manual reporting view, not as the app database.

## Minimum viable product

1. **League screen** — six-team leaderboard, current leader, latest scores and cumulative-points graph.
2. **Add weekly results modal** — one score per team, validation, confirmation and automatic recalculation.
3. **Admin screen** — team names, colours and term settings.
4. **History** — every saved weekly result remains editable by an admin; previous weeks are never overwritten.

## Data model

| Table | Key fields | Purpose |
| --- | --- | --- |
| `academic_periods` | id, name, starts_on, ends_on | Optional school-calendar labels such as a term or academic year. |
| `teachers` | id, auth_subject, email, display_name | Teacher identity records, wired to authentication in V1 Slice 4 / V2. |
| `classes` | id, teacher_id, name, year_group | A teacher-owned form/class. |
| `teams` | id, class_id, name, colour, display_order, active | Teams belong to a class, not permanently to one league. |
| `quiz_series` | id, name, organiser_teacher_id, starts_on, ends_on | The centrally issued weekly school quiz programme. |
| `quiz_weeks` | id, quiz_series_id, week_number, quiz_date, published_at | One shared Friday quiz event. |
| `weekly_scores` | id, quiz_week_id, team_id, score | One raw score per team per shared quiz event. |
| `leagues` | id, quiz_series_id, name, scope, starts_on, ends_on | A class, year-group or whole-school table with its own date range. |
| `league_enrolments` | id, league_id, class_id, enrolled_on, withdrawn_on | Lets a teacher enrol a class; all of its active teams appear in that league. |
| `score_audits` | id, weekly_score_id, previous_score, next_score, changed_by_teacher_id | The correction history required for trustworthy results. |

League standings join enrolled classes to their active teams and then to shared quiz scores inside the league’s date range. No score is copied into a league, and no class-level aggregation is used.

## Rules worth deciding before the production build

- Teams use raw quiz scores, cumulatively summed within each league's date range; they do not earn placement points.
- Corrected scores retain an audit record; the teacher-only correction UI belongs in V1 Slice 4.
- Pupils see the public League page without sign-in while only staff can enter results.
- A new term or yearly competition is a new date-bounded league drawing from the same centrally issued quiz series.

## Delivery order

1. Approve the visual direction and refine the prototype.
2. Create the Neon schema and seed the six teams.
3. Add public read API plus protected admin write API.
4. Replace prototype data with live term data and add publish/edit behaviour.
5. Deploy, then use it live on a Friday with a fallback spreadsheet for week one.
