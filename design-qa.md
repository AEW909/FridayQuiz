**Source visual truth**

- Source: `design_idea.png`.
- Intended viewport: desktop, 1440 x 1024 CSS pixels.
- Intended state: League tab, standings and chart visible, score-entry modal closed.

**Implementation evidence**

- Production URL: `https://friday-quiz-league.vercel.app`.
- Browser-tested on desktop on 2026-09-20 against the production deployment.
- A fresh anonymous page loaded the persisted seven-team roster, one published Friday, and the corrected score from Neon. Keyboard navigation reached the League tab and showed the new high-contrast focus treatment. The strict UI pass was visually inspected against the supplied reference after deployment.
- `npm run typecheck` and `npm run test:standings` passed (2/2); the Vercel production build passed.

**Findings**

- [P1] The stage treatment, trophy-led masthead, luminous rank/score treatment, and structured lower band now match the intended game-show direction. Team-specific emblems remain absent; rank, name, and accessible text still provide the required non-colour-only identification.
- [P2] The compact desktop-height mode now keeps all seven teams, the full momentum panel, and the beginning of the winner/latest-result band within the verified short projector-style viewport. The complete lower band still scrolls when seven teams are configured; this is an acceptable density trade-off until a dedicated display mode is selected.

**Resolved blocker**

- The previous cloud-preview bridge issue is resolved through the public Vercel deployment. The Vercel project uses `dist/client` as the explicit Vite output directory and public access is enabled for this display-only app.

**Required fidelity surfaces**

1. Add team-specific emblems only if they can be introduced without reducing text/rank legibility.
2. Run a real projector/laptop and mobile visual check; desktop and keyboard-flow verification are complete.

final result: blocked
