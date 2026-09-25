# Friday Quiz League roadmap

This file is the authoritative delivery record. Codex must stage V1 as thin vertical slices and update the relevant item after each slice with: **status**, **what changed**, **tests/verification**, and **decisions or blockers**.

## V1 — one Friday Quiz League, seeded with six teams

### Slice 1 — establish the real app shell

- [x] Convert the prototype to TypeScript and retain the chosen dark game-show visual direction.
- [x] Define shared types for `Term`, `Team`, `QuizWeek` and `WeeklyScore`.
- [x] Seed a local development league with six teams and representative history.
- [x] Make the League/Admin navigation and responsive layout work against the typed data.

**Done when:** the app is a clean, typed and browser-verified local shell using a single data source.

**Status:** Complete (2026-09-19).

**What changed:** Promoted the runnable Vite app from `Prototype/` to the repository root, while retaining the original folder as a backup. Replaced JSX source with TypeScript, introduced shared league models and seeded term/team/week/score data, and moved standings and cumulative-momentum calculations into typed helpers. League and Admin now operate on that one local league state.

**Tests/verification:** `npm run typecheck`, `npm run build`, and `npm run test:sites` passed (4/4). Browser verification confirmed the League renders, the six-team score-entry modal opens, and an Admin name edit is reflected across the League before the seeded state is restored.

**Decisions:** Local development standings use cumulative raw quiz scores; ties sort by configured team display order. Persistence, score publishing validation, authentication, and audit history remain intentionally deferred to later V1 slices. Full visual QA remains blocked until the reference and implementation can be compared at the intended desktop viewport.

### Slice 2 — persist the league foundation and team settings

- [x] Provision Neon and add Drizzle configuration.
- [x] Create the V2-ready migration foundation for academic periods, shared quiz weeks, teachers, classes, teams, leagues, class enrolments, scores and score audits.
- [x] Build the Admin flow to edit team names and colours, persist changes, and reload them on the League screen.
- [x] Validate unique team names within a class and allow an admin to configure the active team count; retain six teams as the seeded/default V1 setup and score-entry speed target.

**Done when:** an admin can change a team name, refresh the browser and see it retained on the public League screen.

**Status:** Complete (2026-09-19).

**What changed:** Created and linked the `friday-quiz-league` Neon project in the EU region, added Drizzle configuration and applied the initial migration. The schema models one centrally issued `quiz_series` and `quiz_weeks`, class-owned teams, class-level `league_enrolments`, and one raw `weekly_scores` record per team per quiz. A league therefore derives its visible team table from enrolled classes without copying or aggregating results. Added a Microsoft Entra browser client boundary and configured the supplied school Entra client and tenant identifiers for local development and the Vercel production build. Public League viewers cannot see teacher score controls; Admin now offers Microsoft sign-in. Seeded the initial V1 organiser, term, quiz series, class, league enrolment and six teams into Neon with `npm run db:seed`.

**Tests/verification:** `npm run typecheck`, `npm run build`, and `npm run db:seed` passed. Drizzle generated and applied `drizzle/0000_melodic_wild_pack.sql`; a read-only Neon query confirmed all ten expected tables exist. Browser verification confirmed that a Microsoft-authenticated Admin team-name change persisted through the protected Vercel API to Neon and remained after refresh. The authenticated browser flow was retested after adding configurable team-count and colour controls; the public API returned the saved roster.

**Decisions:** Academic periods are optional calendar labels, not mandatory competition boundaries. A league has its own date range and may be class, year-group or whole-school. V2 enrols classes, then displays every active team from those classes; classes can have different team counts. V1 begins with six seeded teams, but the Admin flow permits 2–24 active teams. The database deliberately has no inflexible six-team constraint. Microsoft Entra uses a public SPA client with PKCE and only identity scopes, avoiding a browser-held client secret. Protected API writes verify a signed Entra access token from the configured tenant, audience, and `LRGS-STAFF` group. Both Entra v1 and v2 issuer formats are accepted because the custom API scope currently returns a valid v1-form access token.

### Slice 3 — save one week’s results end to end

- [x] Create migrations for `quiz_weeks` and `weekly_scores`.
- [x] Connect the results modal to a protected write endpoint.
- [x] Validate one non-negative whole-number score for every active team before publish.
- [x] On save, update standings, latest scores and cumulative momentum without a stale screen.

**Done when:** a teacher can enter all six scores for a Friday and the public league view immediately reflects the saved week.

**Status:** Complete (2026-09-19).

**What changed:** Added public read and staff-protected write endpoints for published results. A publish creates one `quiz_week` and one `weekly_score` for every active team in a single transaction. The client validates whole, non-negative values, disables repeat submission while publishing, and replaces prototype history with the persisted result response as soon as it is saved.

**Tests/verification:** `npm run typecheck` passed. Vercel's production build passed after compiling the API route. A teacher completed the browser score-entry flow with seven configured teams. A public read-only request to `/api/results` returned the saved week and all seven submitted scores.

**Decisions:** The V1 score-entry dialog uses the current calendar date as the quiz date. The server serializes publishes per quiz series and rejects a second result for the same date; corrections are explicitly deferred to Slice 4. Validation applies to the configured active roster, so V1 retains its six-team default without making it an artificial constraint.

### Slice 4 — protect editing and make results trustworthy

- [x] Add teacher/admin authentication suitable for the intended deployment.
- [x] Restrict creation and editing of teams and results to authenticated teachers.
- [x] Allow an admin to correct a previously published week with a clear confirmation and audit metadata.
- [x] Add tests for totals, ranking, ties and corrected results.

**Done when:** the public page is read-only, teacher changes are authenticated, and score calculations are covered by tests.

**Status:** Complete (2026-09-20).

**What changed:** Microsoft Entra access tokens are verified server-side against the school tenant, registered application audience, signed issuer, and `LRGS-STAFF` group before any team or result write. The public League remains anonymous and read-only. Admin now lists published Fridays and provides a correction form that requires a reason and an explicit confirmation. Corrections update the score, recalculate the visible scoreboard immediately, and create `score_audits` records only for values that changed.

**Tests/verification:** `npm run typecheck` passed. `npm run test:standings` passed (2/2): configured-order tie handling and corrected-total/cumulative-momentum behaviour. The production Vercel build passed. A teacher completed a browser correction; the public `/api/results` response reflected the updated score, and a read-only Neon query confirmed the `corrected` audit entry with previous score, new score, reason, and affected team order.

**Decisions:** The public leaderboard deliberately does not require sign-in, so it remains suitable for pupils and projector display; the teacher-only Admin and protected score APIs enforce staff access. Entra's existing staff group is the role source rather than inferred email formats. The current V1 staff group grants shared league-edit access; per-class teacher ownership is reserved for V2.

### Slice 5 — launch readiness

- [x] Add empty, loading and error states.
- [ ] Check contrast, keyboard flow and responsive display at projector/laptop/mobile sizes.
- [ ] Run full browser visual QA against the selected scoreboard design and resolve P0–P2 issues.
- [ ] Deploy to the agreed host and run one real Friday with a simple fallback plan.

**Done when:** the app has been used successfully for a live quiz and can be relied on the following week.

**Status:** In progress (2026-09-20).

**What changed:** Deployed the Vite app to Vercel at `https://friday-quiz-league.vercel.app` and connected the GitHub repository for future deployments. Replaced the seeded-demo fallback on the public screen with one atomic live-data load for teams and results. The League now shows explicit loading and read-error states, plus an honest no-results state before the first Friday is published. Publish and correction flows re-query the canonical live data before reporting success, preventing a stale League view in the current tab. Added visible keyboard focus treatment for controls. A strict League UI pass introduced a generated physical quiz-stage backdrop, LRGS gold crest masthead, brighter hierarchy, team-colour light treatments, and a structured winner/latest-score/action lower band. A height-aware desktop mode compresses the board for short projector-style screens while retaining every configured team. Shared-league standings now retain the designed six-row panel height; longer tables use a themed, keyboard-focusable scroll region rather than stretching the scoreboard, and each shared-board team now carries a compact form label. The momentum axis scales around the actual plotted totals. The winner panel now treats one, two, and three-or-more-way ties distinctly; the full-screen control supports projector display; publishing now closes score entry immediately, returns to the League board, and then animates the updated chart and reordered standings; and a teacher can retire a team without deleting its source score data. Added an installable PWA manifest, LRGS crest app icon, Chrome/Apple Home Screen metadata, and a service worker that caches only the static app shell and visual assets, never authenticated or live leaderboard APIs.

**Tests/verification:** `npm run typecheck`, `npm run test:standings` (10/10), `npm run test:sites` (6/6, including PWA manifest and service-worker API-cache guard), and `npm run build` passed. Vercel ran `npm run build` and reported the latest production deployment `READY`. A fresh desktop browser loaded the persisted roster and corrected score from public endpoints; keyboard navigation reached the League control with visible focus. The updated stage-led League screen was visually inspected in the browser. The shared-standings scroll update passed `npm run typecheck` and `npm run build`. The staff sign-in screen was checked at desktop and 375px mobile widths with no clipping or overflow. The live deployment was rechecked after the LRGS crest and results-reveal update; the crest asset renders correctly from the production URL. Anonymous live requests to the class-team endpoint correctly return `401`. The new publish transition, shared-board form labels, and installed-app flow await an interactive staff-session/device check. The current-tab refresh behaviour needs one final interactive correction check.

**Decisions:** The deployment now includes server-side Neon access through protected Vercel functions; no database credential is exposed to the browser. Visual QA is verified but not approved against the supplied reference: projector/laptop/mobile checks and the P1 theatrical art-direction gap remain. The live-quiz fallback is to retain the paper score sheet, retry the protected publish once connectivity returns, and check `Published results` before any retry so a completed first request is never duplicated. A real Friday run is still required before V1 can be called launch-ready.

## V2 — multiple classes, teacher registration and shared leagues

V2 expands the app from a single competition into a school-wide platform around one shared Friday quiz. It is a staff-only tool: every session begins with Microsoft sign-in, and pupil accounts/public leaderboards are deferred as a deliberate later decision. Each teacher owns their class setup; a form always has its private leaderboard and can independently opt into its year-group, phase (Lower School Years 7-9, Middle School Years 10-11, Upper School Years 12-13), and whole-school leaderboards. Each participating class contributes its individual teams directly to each selected table; scores are never aggregated or copied. Missing class results remain visibly not entered, distinct from a genuinely recorded score of zero.

### Slice 1 — first-login teacher and form registration

- [x] On a teacher’s first authenticated login, require a short registration flow before they can use the app.
- [x] Collect: teacher display name, form/class name, year group, and the names of that form’s teams.
- [x] Create the teacher, class/form and team records together, with clear validation and an editable confirmation screen.
- [x] Existing teachers should land on their class dashboard rather than see registration again.

**Done when:** a newly authenticated teacher can register a form and arrive at a populated class competition without manual database setup.

**Status:** Complete (2026-09-20).

**What changed:** Added `class_teachers` with lead/editor roles, backfilled every pre-existing class owner as its lead teacher, and added a database uniqueness constraint preventing duplicate league enrolments for the same class. Added the protected `/api/teacher-profile` API: a first signed-in staff member is upserted from their verified Entra identity, then can create a Year 7-13 class and 2-24 uniquely named, colour-validated teams in one transaction. The app now opens on a staff-only Microsoft sign-in screen; a new teacher is sent straight to first-class registration, a teacher with one class opens it automatically, and a teacher with several classes chooses one from a class-selection modal. Teachers can add further classes from their workspace. First-time and additional-class setup now share the same form, including optional eligible Year, phase and Whole School enrolments, saved atomically with the class and roster. An additional-class setup can be dismissed with an X without losing the active workspace.

**Tests/verification:** `npm run typecheck`, `npm run test:standings` (10/10), and `npm run build` passed. Drizzle migration `0001_silent_the_hunter.sql` was applied successfully to Neon. An authenticated LRGS teacher completed the live registration flow, creating `L6AEW` in Year 13 with six teams. The teacher’s subsequent sign-in now resolves to that class workspace rather than the first-login form. A browser check confirmed the unauthenticated staff sign-in landing screen. The updated signed-out local screen was also browser-checked; the authenticated create-class interface awaits an interactive staff-session check. Deployment `dpl_pruayosWZicJk9zKWwxSWCTwkJtH` is ready; unauthenticated requests to both class-team and class-result endpoints return `401`.

**Decisions:** The current user becomes the class lead on creation. Co-teachers are represented as explicit class memberships; a future add-colleague flow will accept an LRGS staff email and activate it when that colleague first signs in, without requiring Microsoft Graph. Team name and colour changes remain allowed during a series, but adding/removing teams is server-locked after that class submits its first result. The standard school hierarchy is a form board plus optional year, phase, and whole-school participation, with eligibility enforced from the class year group.

### Slice 2 — teacher-owned class leagues

- [x] Give each teacher a private management view for their own form’s league.
- [x] Retain the V1 fast weekly score-entry workflow for each form.
- [x] Allow a teacher to run a self-contained class competition only.
- [x] Ensure teachers cannot edit another teacher’s form, teams or scores.

**Done when:** multiple teachers can independently run their own form leagues without seeing or modifying each other’s management data.

**Status:** Complete (2026-09-20).

**What changed:** Replaced the V1 result-write assumption that one class owns a whole quiz week. A class-scoped submission now resolves or creates the single shared `quiz_week` for its Friday, then inserts that class’s complete score set only. The database’s unique `(quiz_week_id, team_id)` constraint and an explicit class-week check prevent repeat entries, while another class can submit to the same Friday. The teacher dashboard loads its own class roster, private form standings, and complete-score entry modal. It now includes an edit mode for class team names, preserving each team record and its score history. Score entry and correction now use explicit, styled `- / +` steppers instead of native browser spinners. A `Correct results` dashboard action opens a Friday picker and then the existing reason-and-confirmation correction modal. Team updates and score corrections require a `class_teachers` membership whenever a V2 class id is supplied; legacy V1 requests retain the existing shared-staff transition path. The server also rejects any attempt to add or remove teams after the class has submitted results, while retaining name and colour edits.

**Tests/verification:** Strict server API typecheck, `npm run typecheck`, `npm run test:standings` (7/7), and `npm run build` passed. The live authenticated `L6AEW` class submitted all six team scores; a read-only database check confirmed the complete score set. The class-membership test confirms an editor/lead membership is accepted and an unrelated teacher is rejected. Class-scoped team and result GET/PUT/POST/PATCH routes all invoke that same guard. Deployment `dpl_9AxpbgPCiPzVJBDRXcrq2ngX1nk7` is `Ready`.

**Decisions:** A V2 class result must reference a Friday, but it may be entered later; the teacher dashboard defaults to the most recent Friday, so a Monday run contributes to that prior Friday. Each class submits all active team scores atomically. An unsubmitted class has no score record for that Friday, allowing future coordinator/public views to show `Not entered` separately from an actual score of `0`.

### Slice 3 — year, phase and whole-school league enrolment

- [x] Let a teacher enrol or withdraw their form from year-group, phase and whole-school leagues.
- [x] Make each enrolment explicit, editable and visible before that class's first shared result is published.
- [x] Derive each league table from every active team belonging to enrolled classes, using the shared weekly quiz score recorded for that team.
- [x] Provide separate staff-only views for class, year-group, phase and whole-school leaderboards.

**Done when:** forms can compete privately, at year-group, phase, and/or whole-school level with every enrolled team visible in the relevant table.

**Status:** Complete (2026-09-20).

**What changed:** Applied `0002_fresh_reptil.sql` and `0003_school_league_definitions.sql`, adding the phase scope and standard Year 7-13, Lower, Middle, Upper, and Whole School league definitions for the existing shared quiz series. The teacher dashboard now exposes an explicit participation switch for the selected class's eligible Year, phase, and Whole School boards. Those same choices appear during first-class and additional-class setup, with server-side year/phase eligibility validation before the new enrolments are committed. The League screen has a staff-only board selector: it opens the teacher's class by default and can view every standard school board. Shared standings derive directly from the enrolled classes' active teams and existing weekly score rows; no aggregate score or duplicated result is stored.

**Tests/verification:** `npm run typecheck` passed. `npm run test:standings` passed (2/2) and `npm run build` passed. The one Neon `main` branch and its `friday_quiz_league` database were checked directly: the `phase` schema addition, all 11 standard league definitions, and 4 Drizzle migration records are present. The authenticated live-browser enrolment toggle remains for the teacher to exercise.

**Decisions:** A class becomes eligible for exactly one year board and one phase board from its Year 7-13 value, plus Whole School. Only class members can change that class's participation. The League selector shows the class board and its active shared enrolments, keeping inactive boards out of the daily workflow. Joining applies to the current shared quiz series so an already-entered Friday appears immediately; withdrawing retains qualifying historic results up to the withdrawal date. A shared board without enrolments intentionally has an empty scoreboard rather than synthetic test results.

### Slice 4 — quality controls

- [x] Provide a way to correct a class result while preserving audit history and recalculating affected leaderboards.
- [x] Add safeguards for incomplete weeks, late entries and duplicate submissions.
- [x] Review public display data to ensure it identifies forms/teams only, not individual pupils.

**Done when:** teachers can correct and submit trusted class results without exposing pupil data or adding unnecessary coordinator setup.

**Status:** Complete (2026-09-21).

**What changed:** Class-result corrections update the source score rows and preserve `score_audits`; shared leaderboards recalculate from those source rows on their next read, so no separate aggregate is left stale. An explicit raw-score helper keeps `Not entered` distinct from a genuine `0`. Each class submits a complete Friday score set atomically; late Monday entry targets the previous Friday and duplicate submission uses the correction flow. Retiring a team now preserves its stored scores but removes it from active score entry, tables, and momentum graphs.

**Scaling follow-up (2026-09-25):** Removed the legacy seeded `Friday Quiz League` class, its teams, scores, class-teacher membership and shared-league enrolment from the live database with migration `0004_remove_legacy_seed_class.sql`, after confirming it was demo/V1 data leaking into Whole School. Updated the seed script so future seeds create the quiz-series and standard school boards without recreating that demo class. Capped the momentum chart and legend to the current top 20 teams while leaving the full standings table visible and scrollable.

**Shared-board regression fix (2026-09-25):** Backfilled missing phase and whole-school enrolments for classes already participating in their year-group league with migration `0005_backfill_shared_league_enrolments.sql`. New class registration now starts with every eligible shared board selected by default, while still allowing a teacher to opt out before saving.

**Tests/verification:** `npm run typecheck`, `npm run test:standings` (11/11), `npm run test:sites` (6/6), and `npm run build` passed. `npm run db:migrate` applied successfully to Neon; a direct read confirmed no remaining seed class rows and, after the regression fix, Year 13, Upper School and Whole School each include `L6AEW`, `U6LMC`, and `U6SM` for 15 active teams. The local browser loaded the staff sign-in gate without render errors; authenticated shared-board visual verification still requires a teacher session. The test suite covers ties, corrected momentum, missing-versus-zero result state, class membership rejection, post-submission roster-count locking, retirement minimums, protection against retired-team resurrection during a later roster edit, and top-20 chart series selection.

**Decisions:** Results remain atomic per class and Friday, so partial submissions cannot exist. A later Monday entry is valid because it attaches to the previous Friday, while a duplicate class-week submission is rejected and must use the correction flow. A separate school-admin overview and dedicated Entra admin group are deliberately deferred: they add coordination overhead without improving the weekly teacher workflow. The retained score audit is intentionally lightweight and only supports corrections. The old seeded class had no operational reason to remain once real forms were live, so it was deleted rather than retained as withdrawn history. Shared-board charts prioritise readability by plotting the top 20 placed teams; standings remain the complete source of truth.

## Later ideas — do not start without a deliberate decision

- Public display mode for a projector or digital signage.
- Term archive and previous-winners hall of fame.
- QR code link for pupils to view the current public table.
- Configurable scoring formats and bonus rounds.
- School coordinator overview and a dedicated Entra administrator role, if that becomes a real operational need.
