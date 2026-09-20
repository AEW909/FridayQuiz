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
| `terms` | id, name, starts_on, ends_on, active | Separates each term’s league. |
| `teams` | id, term_id, name, colour, display_order | The six teams for a term. |
| `quiz_weeks` | id, term_id, week_number, quiz_date, published_at | One record per Friday quiz. |
| `weekly_scores` | id, quiz_week_id, team_id, score | One score per team for that week. |
| `admins` | id, email, role | Controls who can edit results. |

## Rules worth deciding before the production build

- Is the winner simply the highest quiz score each Friday, or do teams earn league points based on finishing position?
- Can scores be edited after publishing, and should edits be visibly logged?
- Will pupils see the public League page without sign-in while only staff can enter results? This is the sensible setup.
- Will a new term keep the same team names/colours or start from scratch?

## Delivery order

1. Approve the visual direction and refine the prototype.
2. Create the Neon schema and seed the six teams.
3. Add public read API plus protected admin write API.
4. Replace prototype data with live term data and add publish/edit behaviour.
5. Deploy, then use it live on a Friday with a fallback spreadsheet for week one.
