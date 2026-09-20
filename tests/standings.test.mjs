import assert from "node:assert/strict";
import test from "node:test";
import { getCumulativeScores, getStandings } from "../src/lib/standings.ts";

const league = {
  term: { id: "term", name: "Term", startsOn: "2026-09-01", endsOn: "2026-12-18", active: true },
  teams: [
    { id: "first", termId: "term", name: "First", colour: "#ffffff", displayOrder: 1 },
    { id: "second", termId: "term", name: "Second", colour: "#000000", displayOrder: 2 },
  ],
  quizWeeks: [
    { id: "week-1", termId: "term", weekNumber: 1, quizDate: "2026-09-05", publishedAt: "2026-09-05T15:00:00.000Z" },
    { id: "week-2", termId: "term", weekNumber: 2, quizDate: "2026-09-12", publishedAt: "2026-09-12T15:00:00.000Z" },
  ],
  weeklyScores: [
    { id: "first-1", quizWeekId: "week-1", teamId: "first", score: 5 },
    { id: "first-2", quizWeekId: "week-2", teamId: "first", score: 4 },
    { id: "second-1", quizWeekId: "week-1", teamId: "second", score: 4 },
    { id: "second-2", quizWeekId: "week-2", teamId: "second", score: 5 },
  ],
};

test("ties retain configured display order", () => {
  assert.deepEqual(getStandings(league).map((team) => team.id), ["first", "second"]);
});

test("corrected scores recalculate totals and momentum", () => {
  const corrected = { ...league, weeklyScores: league.weeklyScores.map((score) => score.id === "second-2" ? { ...score, score: 7 } : score) };
  const standings = getStandings(corrected);
  assert.equal(standings[0].id, "second");
  assert.equal(standings[0].total, 11);
  assert.deepEqual(getCumulativeScores(standings[0].scores), [4, 11]);
});
