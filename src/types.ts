export type TeamId = string;
export type TermId = string;
export type QuizWeekId = string;

export interface Term {
  id: TermId;
  name: string;
  startsOn: string;
  endsOn: string;
  active: boolean;
}

export interface Team {
  id: TeamId;
  termId: TermId;
  name: string;
  colour: string;
  displayOrder: number;
  className?: string;
}

export interface QuizWeek {
  id: QuizWeekId;
  termId: TermId;
  weekNumber: number;
  quizDate: string;
  publishedAt: string;
}

export interface WeeklyScore {
  id: string;
  quizWeekId: QuizWeekId;
  teamId: TeamId;
  score: number;
}

export interface LeagueData {
  term: Term;
  teams: Team[];
  quizWeeks: QuizWeek[];
  weeklyScores: WeeklyScore[];
}
