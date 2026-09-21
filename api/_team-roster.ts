export function canChangeTeamCount(hasSubmittedScores: boolean, currentActiveTeamCount: number, requestedActiveTeamCount: number) {
  return !hasSubmittedScores || currentActiveTeamCount === requestedActiveTeamCount;
}

export function canRetireTeam(activeTeamCount: number) {
  return activeTeamCount > 2;
}

export function matchesActiveRoster(activeTeamIds: string[], requestedTeamIds: Array<string | undefined>) {
  const ids = requestedTeamIds.filter((id): id is string => Boolean(id));
  return ids.length === activeTeamIds.length
    && new Set(ids).size === ids.length
    && ids.every((id) => activeTeamIds.includes(id));
}
