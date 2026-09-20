# AGENTS.md

## Product intent

Friday Quiz League must be simple enough to run in a busy school corridor on a Friday, but look good enough that pupils care who is ahead. Optimise for fast score entry, legible public display and an obvious sense of drama.

## Stack and architecture

- Use Vite, React and TypeScript for the client.
- Use Neon Postgres and Drizzle for persisted application data.
- Keep all secrets and database access server-side. Never expose a Neon connection string or admin credential to the client.
- Keep public reads separate from authenticated teacher writes.
- Preserve a complete history of weekly results. Editing a result must update a record; do not overwrite or discard historical context without an audit trail.

## UX guardrails

- The League screen is the hero: standings, this-week result and momentum should be understandable at a glance.
- The score-entry workflow must take under a minute for six teams.
- Team colours are part of the identity system; enforce accessible contrast and avoid relying on colour alone for rank or meaning.
- Do not add features to the main screen merely because the data model supports them.
- Keep the public screen display-safe: no personal pupil data, email addresses or teacher-only controls.

## Delivery discipline

- Treat `ROADMAP.md` as the delivery record. Before starting work, identify the current unchecked slice. After work, update that slice with status, tests run and decisions made.
- Build V1 in thin vertical slices: each slice must work end to end through UI, validation, persistence and visible feedback. Do not build a large backend or a set of disconnected screens first.
- Keep migrations small and committed with the code that uses them.
- Add test coverage for scoring and standings logic, especially tie behaviour and edited results.
- Verify the app in a real browser before handoff. A successful build is not visual verification.

## Scope boundaries

- V1 is one league with six configurable teams and one admin/teacher workflow.
- V2 is the multi-class, teacher-registration and year/whole-school league expansion. Do not start V2 work until V1 is stable and in use.
