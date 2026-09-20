export function canChangeTeamCount(hasSubmittedScores: boolean, currentActiveTeamCount: number, requestedActiveTeamCount: number) {
  return !hasSubmittedScores || currentActiveTeamCount === requestedActiveTeamCount;
}
