import type { LeagueData, QuizWeek, Team, WeeklyScore } from "../types";

const termId = "autumn-2026";

const teams: Team[] = [
  { id: "lions", termId, name: "Lions", colour: "#f7c948", displayOrder: 1 },
  { id: "hawks", termId, name: "Hawks", colour: "#47d990", displayOrder: 2 },
  { id: "phoenixes", termId, name: "Phoenixes", colour: "#ff626f", displayOrder: 3 },
  { id: "wolves", termId, name: "Wolves", colour: "#42a8ff", displayOrder: 4 },
  { id: "unicorns", termId, name: "Unicorns", colour: "#b68cff", displayOrder: 5 },
  { id: "krakens", termId, name: "Krakens", colour: "#35d7df", displayOrder: 6 },
];

const scoreHistory: Record<string, number[]> = {
  lions: [48, 61, 72, 59, 64, 66, 70, 47],
  hawks: [40, 56, 62, 61, 61, 58, 63, 61],
  phoenixes: [37, 49, 52, 60, 53, 58, 54, 65],
  wolves: [34, 45, 51, 53, 49, 55, 61, 48],
  unicorns: [29, 42, 48, 54, 59, 53, 56, 31],
  krakens: [24, 35, 41, 49, 47, 52, 45, 47],
};

const quizDates = [
  "2026-09-04",
  "2026-09-11",
  "2026-09-18",
  "2026-09-25",
  "2026-10-02",
  "2026-10-09",
  "2026-10-16",
  "2026-10-23",
];

const quizWeeks: QuizWeek[] = quizDates.map((quizDate, index) => ({
  id: `autumn-2026-week-${index + 1}`,
  termId,
  weekNumber: index + 1,
  quizDate,
  publishedAt: `${quizDate}T15:30:00.000Z`,
}));

const weeklyScores: WeeklyScore[] = teams.flatMap((team) =>
  scoreHistory[team.id].map((score, index) => ({
    id: `${team.id}-${index + 1}`,
    quizWeekId: quizWeeks[index].id,
    teamId: team.id,
    score,
  })),
);

export const seedLeague: LeagueData = {
  term: {
    id: termId,
    name: "Autumn Term 2026",
    startsOn: "2026-09-01",
    endsOn: "2026-12-18",
    active: true,
  },
  teams,
  quizWeeks,
  weeklyScores,
};
