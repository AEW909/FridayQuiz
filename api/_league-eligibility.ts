export type StandardLeague = {
  scope: "year_group" | "phase" | "whole_school";
  yearGroup: number | null;
  phase: string | null;
};

export function phaseForYearGroup(yearGroup: number) {
  if (yearGroup <= 9) return "lower";
  if (yearGroup <= 11) return "middle";
  return "upper";
}

export function isEligibleForYearGroup(league: StandardLeague, yearGroup: number) {
  return (league.scope === "year_group" && league.yearGroup === yearGroup)
    || (league.scope === "phase" && league.phase === phaseForYearGroup(yearGroup))
    || league.scope === "whole_school";
}
