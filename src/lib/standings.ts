import type { LeagueData, QuizWeekId, Team, TeamId } from "../types";

export interface Standing extends Team {
  total: number;
  scores: number[];
}

export interface WeekWinner extends Team {
  score: number;
}

export function getScoresByWeek(league: LeagueData, teamId: TeamId): number[] {
  const scoresByWeek = new Map(
    league.weeklyScores
      .filter((score) => score.teamId === teamId)
      .map((score) => [score.quizWeekId, score.score]),
  );

  return [...league.quizWeeks]
    .sort((left, right) => left.weekNumber - right.weekNumber)
    .map((week) => scoresByWeek.get(week.id) ?? 0);
}

export function getScoreForWeek(league: LeagueData, teamId: TeamId, quizWeekId: QuizWeekId): number | undefined {
  return league.weeklyScores.find((score) => score.teamId === teamId && score.quizWeekId === quizWeekId)?.score;
}

export function getStandings(league: LeagueData): Standing[] {
  return league.teams
    .map((team) => {
      const scores = getScoresByWeek(league, team.id);
      return { ...team, scores, total: scores.reduce((sum, score) => sum + score, 0) };
    })
    .sort((left, right) => right.total - left.total || left.displayOrder - right.displayOrder);
}

export function getCumulativeScores(scores: number[]): number[] {
  return scores.reduce<number[]>((cumulative, score) => {
    cumulative.push((cumulative.at(-1) ?? 0) + score);
    return cumulative;
  }, []);
}

export function getTermLeaders(standings: Standing[]): Standing[] {
  const leadingScore = standings[0]?.total;
  return leadingScore === undefined ? [] : standings.filter((team) => team.total === leadingScore);
}

export function getWeekWinners(league: LeagueData, quizWeekId: QuizWeekId): WeekWinner[] {
  const scoredTeams = league.teams.flatMap((team) => {
    const score = getScoreForWeek(league, team.id, quizWeekId);
    return score === undefined ? [] : [{ ...team, score }];
  });
  const leadingScore = Math.max(...scoredTeams.map((team) => team.score));
  return scoredTeams.filter((team) => team.score === leadingScore);
}
