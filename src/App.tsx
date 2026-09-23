import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { seedLeague } from "./data/seedLeague";
import {
  getSignedInTeacher,
  isMicrosoftConfigured,
  signInWithMicrosoft,
  getTeacherAccessToken,
  signOutFromMicrosoft,
  type TeacherIdentity,
} from "./auth/microsoft";
import { getCumulativeScores, getScoreForWeek, getStandings, getTermLeaders, getWeekWinners, type Standing } from "./lib/standings";
import type { LeagueData, TeamId } from "./types";

type View = "league" | "admin";
type ScoreDraft = Record<TeamId, string>;
type PersistedTeam = { id: string; name: string; colour: string; displayOrder: number; active: boolean };
type PublishedWeek = { id: string; weekNumber: number; quizDate: string; publishedAt: string; scores: Array<{ id: string; score: number; teamId?: string; displayOrder?: number }> };
type ManagedClass = { id: string; name: string; yearGroup: number; role: "lead" | "editor"; teams: PersistedTeam[] };
type RegistrationTeam = { name: string; colour: string };
type LeagueOption = { id: string; name: string; scope: "year_group" | "phase" | "whole_school"; yearGroup: number | null; phase: string | null; eligible: boolean; enrolmentStatus: "active" | "withdrawn" | null };
type RegistrationLeagueOption = Pick<LeagueOption, "id" | "name" | "scope" | "yearGroup" | "phase">;
type TeacherProfile = { teacher: { id: string; displayName: string; email: string | null }; classes: ManagedClass[]; availableLeagues: RegistrationLeagueOption[]; needsRegistration: boolean };

const teamColours = ["#f7c948", "#47d990", "#ff626f", "#42a8ff", "#b68cff", "#35d7df", "#fb923c", "#d946ef", "#a3e635", "#f472b6"];

function createScoreDraft(league: LeagueData): ScoreDraft {
  return Object.fromEntries(league.teams.map((team) => [team.id, ""]));
}

function createRegistrationTeams(): RegistrationTeam[] {
  return Array.from({ length: 6 }, (_, index) => ({ name: `Team ${index + 1}`, colour: teamColours[index] }));
}

function phaseForYearGroup(yearGroup: number) {
  if (yearGroup <= 9) return "lower";
  if (yearGroup <= 11) return "middle";
  return "upper";
}

function toLeagueData(current: LeagueData, teams: PersistedTeam[], weeks: PublishedWeek[]): LeagueData {
  return {
    ...current,
    teams: teams.filter((team) => team.active).map((team) => ({
      id: team.id,
      termId: current.term.id,
      name: team.name,
      colour: team.colour,
      displayOrder: team.displayOrder,
    })),
    quizWeeks: weeks.map((week) => ({ id: week.id, termId: current.term.id, weekNumber: week.weekNumber, quizDate: week.quizDate, publishedAt: week.publishedAt })),
    weeklyScores: weeks.flatMap((week) => week.scores.flatMap((score) => {
      const team = score.teamId ? teams.find((candidate) => candidate.id === score.teamId && candidate.active) : teams.find((candidate) => candidate.displayOrder === score.displayOrder && candidate.active);
      return team ? [{ id: score.id, quizWeekId: week.id, teamId: team.id, score: score.score }] : [];
    })),
  };
}

function mostRecentFriday() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 2) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function MomentumChart({ teams, revealKey }: { teams: Standing[]; revealKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const chart = context;

    const { width, height } = canvas;
    const padding = { left: 48, right: 26, top: 18, bottom: 34 };
    const totals = teams.map((team) => getCumulativeScores(team.scores));
    const max = Math.max(100, Math.ceil(Math.max(...totals.flat()) / 100) * 100);
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;

    const weekCount = totals[0]?.length ?? 0;
    function draw(progress: number) {
      chart.clearRect(0, 0, width, height);
      chart.strokeStyle = "rgba(153, 183, 255, .16)";
      chart.lineWidth = 1;
      chart.font = "12px Inter, sans-serif";
      chart.fillStyle = "#9fb1d9";

      for (let index = 0; index <= 5; index += 1) {
        const y = padding.top + (usableHeight * index) / 5;
        chart.beginPath();
        chart.moveTo(padding.left, y);
        chart.lineTo(width - padding.right, y);
        chart.stroke();
        chart.fillText(String(max - (max * index) / 5), 2, y + 4);
      }

      teams.forEach((team, index) => {
        chart.beginPath();
        chart.strokeStyle = team.colour;
        chart.lineWidth = 3;
        totals[index].forEach((value, weekIndex) => {
          const x = padding.left + (usableWidth * weekIndex) / Math.max(totals[index].length - 1, 1);
          const y = padding.top + usableHeight - ((value * progress) / max) * usableHeight;
          if (weekIndex === 0) chart.moveTo(x, y);
          else chart.lineTo(x, y);
        });
        chart.stroke();

        totals[index].forEach((value, weekIndex) => {
          if (progress < (weekIndex + 1) / Math.max(totals[index].length, 1)) return;
          const x = padding.left + (usableWidth * weekIndex) / Math.max(totals[index].length - 1, 1);
          const y = padding.top + usableHeight - ((value * progress) / max) * usableHeight;
          chart.beginPath();
          chart.fillStyle = team.colour;
          chart.arc(x, y, 4, 0, Math.PI * 2);
          chart.fill();
        });
      });

      for (let index = 0; index < weekCount; index += 1) {
        const x = padding.left + (usableWidth * index) / Math.max(weekCount - 1, 1);
        chart.fillText(`W${index + 1}`, x - 9, height - 9);
      }
    }

    if (!revealKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(1);
      return;
    }
    const duration = 1100;
    let frame = 0;
    let startedAt = 0;
    const animate = (timestamp: number) => {
      startedAt ||= timestamp;
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      draw(1 - Math.pow(1 - progress, 3));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [teams, revealKey]);

  return <canvas ref={canvasRef} width="670" height="330" aria-label="Cumulative points by week for all teams" />;
}

export function App() {
  const [league, setLeague] = useState<LeagueData>(seedLeague);
  const [view, setView] = useState<View>("league");
  const [showEntry, setShowEntry] = useState(false);
  const [draftScores, setDraftScores] = useState<ScoreDraft>(() => createScoreDraft(seedLeague));
  const [saved, setSaved] = useState(false);
  const [savingResults, setSavingResults] = useState(false);
  const [scoreError, setScoreError] = useState<string>();
  const [correctionWeekId, setCorrectionWeekId] = useState<string>();
  const [correctionScores, setCorrectionScores] = useState<ScoreDraft>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionConfirmed, setCorrectionConfirmed] = useState(false);
  const [correctingResults, setCorrectingResults] = useState(false);
  const [correctionError, setCorrectionError] = useState<string>();
  const [correctionClassId, setCorrectionClassId] = useState<string>();
  const [showCorrectionPicker, setShowCorrectionPicker] = useState(false);
  const [teacher, setTeacher] = useState<TeacherIdentity>();
  const [authError, setAuthError] = useState<string>();
  const [adminStatus, setAdminStatus] = useState<string>();
  const [leagueLoadState, setLeagueLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [leagueLoadError, setLeagueLoadError] = useState<string>();
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>();
  const [profileState, setProfileState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [profileError, setProfileError] = useState<string>();
  const [className, setClassName] = useState("");
  const [yearGroup, setYearGroup] = useState(13);
  const [registrationTeams, setRegistrationTeams] = useState<RegistrationTeam[]>(createRegistrationTeams);
  const [registrationLeagueIds, setRegistrationLeagueIds] = useState<string[]>([]);
  const [registeringClass, setRegisteringClass] = useState(false);
  const [managedLeague, setManagedLeague] = useState<LeagueData>();
  const [managedLeagueError, setManagedLeagueError] = useState<string>();
  const [entryClassId, setEntryClassId] = useState<string>();
  const [selectedClassId, setSelectedClassId] = useState<string>();
  const [creatingClass, setCreatingClass] = useState(false);
  const [leagueOptions, setLeagueOptions] = useState<LeagueOption[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("class");
  const [sharedBoard, setSharedBoard] = useState<LeagueData>();
  const [sharedBoardError, setSharedBoardError] = useState<string>();
  const [editingRoster, setEditingRoster] = useState(false);
  const [classTeamNames, setClassTeamNames] = useState<Record<string, string>>({});
  const [savingRoster, setSavingRoster] = useState(false);
  const [resultsRevealKey, setResultsRevealKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retiringTeamId, setRetiringTeamId] = useState<string>();
  const [retiringTeam, setRetiringTeam] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    void getSignedInTeacher().then(setTeacher).catch(() => setAuthError("Microsoft sign-in could not be restored."));
  }, []);

  const loadTeacherProfile = useCallback(async () => {
    setProfileState("loading");
    try {
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/teacher-profile", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as TeacherProfile & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not load your class profile.");
      setTeacherProfile(payload);
      if (!payload.needsRegistration && payload.classes.length === 1) {
        setSelectedClassId(payload.classes[0].id);
        setView("league");
      } else if (payload.needsRegistration) {
        setView("admin");
      }
      setProfileState("ready");
      setProfileError(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load your class profile.";
      if (!message.startsWith("Redirecting to Microsoft")) {
        setProfileState("error");
        setProfileError(message);
      }
    }
  }, []);

  useEffect(() => {
    if (teacher) void loadTeacherProfile();
    else {
      setTeacherProfile(undefined);
      setProfileState("idle");
      setSelectedClassId(undefined);
      setManagedLeague(undefined);
    }
  }, [teacher, loadTeacherProfile]);

  const loadManagedLeague = useCallback(async (classroom: ManagedClass) => {
    try {
      const token = await getTeacherAccessToken();
      const [teamsResponse, resultsResponse, leaguesResponse] = await Promise.all([
        fetch(`/api/teams?classId=${encodeURIComponent(classroom.id)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/results?classId=${encodeURIComponent(classroom.id)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/leagues?classId=${encodeURIComponent(classroom.id)}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!teamsResponse.ok || !resultsResponse.ok || !leaguesResponse.ok) throw new Error("Could not load this class competition.");
      const [{ teams }, { weeks }, { leagues }] = await Promise.all([
        teamsResponse.json() as Promise<{ teams: PersistedTeam[] }>,
        resultsResponse.json() as Promise<{ weeks: PublishedWeek[] }>,
        leaguesResponse.json() as Promise<{ leagues: LeagueOption[] }>,
      ]);
      setManagedLeague(toLeagueData(league, teams, weeks));
      setLeagueOptions(leagues);
      setManagedLeagueError(undefined);
    } catch (error) {
      setManagedLeagueError(error instanceof Error ? error.message : "Could not load this class competition.");
    }
  }, [league]);

  useEffect(() => {
    const classroom = teacherProfile?.classes.find((candidate) => candidate.id === selectedClassId);
    if (classroom) void loadManagedLeague(classroom);
    else setManagedLeague(undefined);
  }, [teacherProfile, selectedClassId, loadManagedLeague]);

  useEffect(() => {
    if (selectedBoardId === "class") { setSharedBoard(undefined); setSharedBoardError(undefined); return; }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getTeacherAccessToken();
        const response = await fetch(`/api/leagues?leagueId=${encodeURIComponent(selectedBoardId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json() as { error?: string; teams?: Array<PersistedTeam & { className?: string }>; weeks?: PublishedWeek[] };
        if (!response.ok || !payload.teams || !payload.weeks) throw new Error(payload.error ?? "Could not load that league.");
        if (!cancelled) { setSharedBoard(toLeagueData(league, payload.teams, payload.weeks)); setSharedBoardError(undefined); }
      } catch (error) { if (!cancelled) setSharedBoardError(error instanceof Error ? error.message : "Could not load that league."); }
    })();
    return () => { cancelled = true; };
  }, [league, selectedBoardId]);

  const refreshLeague = useCallback(async (showLoading = false) => {
    if (showLoading) setLeagueLoadState("loading");
    try {
      const [teamsResponse, resultsResponse] = await Promise.all([fetch("/api/teams"), fetch("/api/results")]);
      if (!teamsResponse.ok || !resultsResponse.ok) throw new Error("Could not load the live league.");
      const [{ teams }, { weeks }] = await Promise.all([
        teamsResponse.json() as Promise<{ teams: PersistedTeam[] }>,
        resultsResponse.json() as Promise<{ weeks: PublishedWeek[] }>,
      ]);
      setLeague((current) => ({
          ...current,
          teams: teams
            .filter((team) => team.active)
            .map((savedTeam) => {
              const localTeam = current.teams.find((team) => team.displayOrder === savedTeam.displayOrder);
              return localTeam
                ? { ...localTeam, name: savedTeam.name, colour: savedTeam.colour }
                : { id: savedTeam.id, termId: current.term.id, name: savedTeam.name, colour: savedTeam.colour, displayOrder: savedTeam.displayOrder };
            }),
          quizWeeks: weeks.map((week) => ({ id: week.id, termId: current.term.id, weekNumber: week.weekNumber, quizDate: week.quizDate, publishedAt: week.publishedAt })),
          weeklyScores: weeks.flatMap((week) => week.scores.flatMap((score) => {
            const team = teams.find((candidate) => candidate.active && candidate.displayOrder === score.displayOrder);
            const localTeam = current.teams.find((candidate) => candidate.displayOrder === score.displayOrder);
            const teamId = localTeam?.id ?? team?.id;
            return teamId ? [{ id: score.id, quizWeekId: week.id, teamId, score: score.score }] : [];
          })),
      }));
      setLeagueLoadState("ready");
      setLeagueLoadError(undefined);
    } catch (error) {
      setLeagueLoadState("error");
      setLeagueLoadError(error instanceof Error ? error.message : "Could not load the live league.");
      throw error;
    }
  }, []);

  const selectedClass = teacherProfile?.classes.find((candidate) => candidate.id === selectedClassId);
  const registrationLeagueOptions = useMemo(() => teacherProfile?.availableLeagues.filter((option) => (
    (option.scope === "year_group" && option.yearGroup === yearGroup)
    || (option.scope === "phase" && option.phase === phaseForYearGroup(yearGroup))
    || option.scope === "whole_school"
  )) ?? [], [teacherProfile, yearGroup]);
  const showingManagedClass = Boolean(selectedClass);
  const displayedLeague = selectedBoardId !== "class" && sharedBoard ? sharedBoard : showingManagedClass && managedLeague ? managedLeague : league;
  const standings = useMemo(() => getStandings(displayedLeague), [displayedLeague]);
  const standingsScrolls = standings.length > 6;
  const winner = standings[0];
  const termLeaders = getTermLeaders(standings);
  const latestWeek = [...displayedLeague.quizWeeks].sort((left, right) => right.weekNumber - left.weekNumber)[0];
  const latestScores = standings
    .map((team) => ({ ...team, latestScore: latestWeek ? getScoreForWeek(displayedLeague, team.id, latestWeek.id) : undefined }))
    .sort((left, right) => (right.latestScore ?? -1) - (left.latestScore ?? -1) || left.displayOrder - right.displayOrder);
  const weeklyWinners = latestWeek ? getWeekWinners(displayedLeague, latestWeek.id) : [];
  const weeklyWinningScore = weeklyWinners[0]?.score;
  const hasPublishedResults = displayedLeague.quizWeeks.length > 0;
  const entryLeague = entryClassId ? managedLeague : league;
  const termLeadLabel = !hasPublishedResults || !winner ? "First Friday awaits"
    : termLeaders.length === 1 ? `${winner.name} lead by ${winner.total - (standings[1]?.total ?? 0)}`
      : termLeaders.length === 2 ? `${termLeaders.map((team) => team.name).join(" & ")} share the lead`
        : `${termLeaders.length} teams share the lead`;
  const weeklyWinnerLabel = weeklyWinners.length === 0 ? "No result yet"
    : weeklyWinners.length === 1 ? weeklyWinners[0].name
      : weeklyWinners.length === 2 ? weeklyWinners.map((team) => team.name).join(" & ")
        : "Too close to call";
  const weeklyWinnerDescription = weeklyWinners.length === 0 ? "Publish the first Friday scores to start the league."
    : weeklyWinners.length === 1 ? `${weeklyWinningScore} points. Another brilliant round.`
      : weeklyWinners.length === 2 ? `Joint winners on ${weeklyWinningScore} points.`
        : `${weeklyWinners.length} teams are tied on ${weeklyWinningScore} points.`;

  async function setLeagueParticipation(option: LeagueOption, participating: boolean) {
    if (!selectedClass) return;
    try {
      setAdminStatus(undefined);
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/leagues", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ classId: selectedClass.id, leagueId: option.id, participating }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update league participation.");
      setLeagueOptions((current) => current.map((item) => item.id === option.id ? { ...item, enrolmentStatus: participating ? "active" : "withdrawn" } : item));
      setAdminStatus(`${option.name} participation updated.`);
    } catch (error) { setAdminStatus(error instanceof Error ? error.message : "Could not update league participation."); }
  }

  function resetClassRegistration() {
    setClassName("");
    setYearGroup(13);
    setRegistrationTeams(createRegistrationTeams());
    setRegistrationLeagueIds([]);
    setProfileError(undefined);
  }

  function startClassCreation() {
    resetClassRegistration();
    setCreatingClass(true);
    setView("admin");
  }

  function cancelClassCreation() {
    if (!teacherProfile?.classes.length) return;
    resetClassRegistration();
    setCreatingClass(false);
    setView("admin");
  }

  function setRegistrationParticipation(leagueId: string, participating: boolean) {
    setRegistrationLeagueIds((current) => participating
      ? [...current, leagueId]
      : current.filter((id) => id !== leagueId));
  }

  function startRosterEdit() {
    if (!selectedClass) return;
    setClassTeamNames(Object.fromEntries(selectedClass.teams.map((team) => [team.id, team.name])));
    setAdminStatus(undefined);
    setEditingRoster(true);
  }

  async function saveClassTeamNames() {
    if (!selectedClass) return;
    try {
      setSavingRoster(true);
      setAdminStatus(undefined);
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/teams", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass.id,
          teams: selectedClass.teams.map((team) => ({ ...team, name: classTeamNames[team.id] ?? team.name, active: true })),
        }),
      });
      const payload = await response.json() as { error?: string; teams?: PersistedTeam[] };
      if (!response.ok || !payload.teams) throw new Error(payload.error ?? "Could not save team names.");
      const updatedClass = { ...selectedClass, teams: payload.teams };
      setTeacherProfile((current) => current ? { ...current, classes: current.classes.map((classroom) => classroom.id === updatedClass.id ? updatedClass : classroom) } : current);
      await loadManagedLeague(updatedClass);
      setEditingRoster(false);
      setAdminStatus("Team names saved.");
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : "Could not save team names.");
    } finally { setSavingRoster(false); }
  }

  async function retireClassTeam(teamId: string) {
    if (!selectedClass) return;
    try {
      setRetiringTeam(true);
      setAdminStatus(undefined);
      const token = await getTeacherAccessToken();
      const response = await fetch(`/api/teams?classId=${encodeURIComponent(selectedClass.id)}&teamId=${encodeURIComponent(teamId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json() as { error?: string; teams?: PersistedTeam[] };
      if (!response.ok || !payload.teams) throw new Error(payload.error ?? "Could not retire that team.");
      const updatedClass = { ...selectedClass, teams: payload.teams };
      setTeacherProfile((current) => current ? { ...current, classes: current.classes.map((classroom) => classroom.id === updatedClass.id ? updatedClass : classroom) } : current);
      await loadManagedLeague(updatedClass);
      setRetiringTeamId(undefined);
      setAdminStatus("Team retired from active tables and momentum.");
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : "Could not retire that team.");
    } finally { setRetiringTeam(false); }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setAdminStatus("Fullscreen is not available in this browser.");
    }
  }

  function updateTeamName(teamId: TeamId, name: string) {
    setLeague((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === teamId ? { ...team, name } : team)),
    }));
  }

  function updateTeamColour(teamId: TeamId, colour: string) {
    setLeague((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === teamId ? { ...team, colour } : team)),
    }));
  }

  function addTeam() {
    setLeague((current) => {
      if (current.teams.length >= 24) return current;
      const displayOrder = current.teams.length + 1;
      return {
        ...current,
        teams: [...current.teams, {
          id: `new-team-${crypto.randomUUID()}`,
          termId: current.term.id,
          name: `Team ${displayOrder}`,
          colour: teamColours[(displayOrder - 1) % teamColours.length],
          displayOrder,
        }],
      };
    });
  }

  function removeTeam() {
    setLeague((current) => current.teams.length > 2 ? { ...current, teams: current.teams.slice(0, -1) } : current);
  }

  async function signIn() {
    try {
      setAuthError(undefined);
      await signInWithMicrosoft();
    } catch (error) {
      setAuthError(error instanceof Error ? `Microsoft sign-in failed: ${error.message}` : "Microsoft sign-in was not completed.");
    }
  }

  async function saveTeams() {
    try {
      setAdminStatus(undefined);
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/teams", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ teams: league.teams.map((team) => ({ ...team, active: true })) }),
      });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Could not save teams.");
      const { teams } = await response.json() as { teams: PersistedTeam[] };
      setLeague((current) => ({
        ...current,
        teams: current.teams.map((team, index) => ({ ...team, id: teams[index]?.id ?? team.id })),
      }));
      setAdminStatus("Team settings saved.");
    } catch (error) {
      setAdminStatus(error instanceof Error ? error.message : "Could not save teams.");
    }
  }

  function updateRegistrationTeam(index: number, field: keyof RegistrationTeam, value: string) {
    setRegistrationTeams((current) => current.map((team, teamIndex) => teamIndex === index ? { ...team, [field]: value } : team));
  }

  function addRegistrationTeam() {
    setRegistrationTeams((current) => current.length >= 24 ? current : [...current, {
      name: `Team ${current.length + 1}`,
      colour: teamColours[current.length % teamColours.length],
    }]);
  }

  function removeRegistrationTeam() {
    setRegistrationTeams((current) => current.length <= 2 ? current : current.slice(0, -1));
  }

  function adjustScore(
    scores: ScoreDraft,
    setScores: (scores: ScoreDraft) => void,
    teamId: TeamId,
    difference: number,
  ) {
    const current = Number(scores[teamId]);
    const value = Number.isInteger(current) && current >= 0 ? current : 0;
    setScores({ ...scores, [teamId]: String(Math.max(0, value + difference)) });
  }

  async function registerClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setProfileError(undefined);
      setRegisteringClass(true);
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/teacher-profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ className, yearGroup, teams: registrationTeams, leagueIds: registrationLeagueIds }),
      });
      const payload = await response.json() as { error?: string; teacher?: TeacherProfile["teacher"]; class?: ManagedClass };
      if (!response.ok || !payload.teacher || !payload.class) throw new Error(payload.error ?? "Could not create your class.");
      setTeacherProfile((current) => current && ({ ...current, teacher: payload.teacher!, classes: [...current.classes, payload.class!], needsRegistration: false }));
      setSelectedClassId(payload.class.id);
      resetClassRegistration();
      setCreatingClass(false);
      setView("league");
      setProfileState("ready");
      setAdminStatus(`${payload.class.name} is ready for its first Friday quiz.`);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not create your class.");
    } finally {
      setRegisteringClass(false);
    }
  }

  async function submitResults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scoreLeague = entryClassId ? managedLeague : league;
    if (!scoreLeague) return;
    const scoreValues = scoreLeague.teams.map((team) => Number(draftScores[team.id]));
    if (scoreLeague.teams.some((team, index) => draftScores[team.id] === "" || !Number.isInteger(scoreValues[index]) || scoreValues[index] < 0)) {
      setScoreError("Enter a non-negative whole-number score for every team.");
      return;
    }

    try {
      setScoreError(undefined);
      setSavingResults(true);
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: entryClassId,
          quizDate: entryClassId ? mostRecentFriday() : new Date().toISOString().slice(0, 10),
          scores: scoreLeague.teams.map((team) => ({ displayOrder: team.displayOrder, score: Number(draftScores[team.id]) })),
        }),
      });
      const payload = await response.json() as { error?: string; week?: Omit<PublishedWeek, "scores">; scores?: Array<{ displayOrder: number; score: number }> };
      if (!response.ok || !payload.week || !payload.scores) throw new Error(payload.error ?? "Could not publish results.");

      if (entryClassId) {
        const classroom = teacherProfile?.classes.find((candidate) => candidate.id === entryClassId);
        if (classroom) await loadManagedLeague(classroom);
      } else {
        setLeague((current) => ({
          ...current,
          quizWeeks: [{ id: payload.week!.id, termId: current.term.id, weekNumber: payload.week!.weekNumber, quizDate: payload.week!.quizDate, publishedAt: payload.week!.publishedAt }],
          weeklyScores: payload.scores!.flatMap((score) => {
            const team = current.teams.find((candidate) => candidate.displayOrder === score.displayOrder);
            return team ? [{ id: `${payload.week!.id}-${team.id}`, quizWeekId: payload.week!.id, teamId: team.id, score: score.score }] : [];
          }),
        }));
        await refreshLeague();
      }
      setResultsRevealKey((current) => current + 1);
      setSaved(true);
      window.setTimeout(() => {
        setShowEntry(false);
        setSaved(false);
        setDraftScores(createScoreDraft(scoreLeague));
        setEntryClassId(undefined);
      }, 1500);
    } catch (error) {
      setScoreError(error instanceof Error ? error.message : "Could not publish results.");
    } finally {
      setSavingResults(false);
    }
  }

  function openCorrection(quizWeekId: string, scoreLeague = league, classId?: string) {
    setCorrectionWeekId(quizWeekId);
    setCorrectionClassId(classId);
    setCorrectionScores(Object.fromEntries(scoreLeague.teams.map((team) => [
      team.id,
      String(scoreLeague.weeklyScores.find((score) => score.quizWeekId === quizWeekId && score.teamId === team.id)?.score ?? ""),
    ])));
    setCorrectionReason("");
    setCorrectionConfirmed(false);
    setCorrectionError(undefined);
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scoreLeague = correctionClassId ? managedLeague : league;
    if (!scoreLeague) return;
    const values = scoreLeague.teams.map((team) => Number(correctionScores[team.id]));
    if (!correctionWeekId || !correctionConfirmed || !correctionReason.trim() || scoreLeague.teams.some((team, index) => correctionScores[team.id] === "" || !Number.isInteger(values[index]) || values[index] < 0)) {
      setCorrectionError("Confirm the correction, give a reason, and enter a non-negative whole-number score for every team.");
      return;
    }

    try {
      setCorrectionError(undefined);
      setCorrectingResults(true);
      const token = await getTeacherAccessToken();
      const response = await fetch("/api/results", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: correctionClassId,
          quizWeekId: correctionWeekId,
          reason: correctionReason.trim(),
          scores: scoreLeague.teams.map((team) => ({ displayOrder: team.displayOrder, score: Number(correctionScores[team.id]) })),
        }),
      });
      const payload = await response.json() as { error?: string; scores?: Array<{ displayOrder: number; score: number }> };
      if (!response.ok || !payload.scores) throw new Error(payload.error ?? "Could not correct results.");
      if (correctionClassId) {
        const classroom = teacherProfile?.classes.find((candidate) => candidate.id === correctionClassId);
        if (classroom) await loadManagedLeague(classroom);
      } else {
        setLeague((current) => ({
          ...current,
          weeklyScores: current.weeklyScores.map((score) => {
            if (score.quizWeekId !== correctionWeekId) return score;
            const team = current.teams.find((candidate) => candidate.id === score.teamId);
            const next = team ? payload.scores!.find((entry) => entry.displayOrder === team.displayOrder) : undefined;
            return next ? { ...score, score: next.score } : score;
          }),
        }));
        await refreshLeague();
      }
      setCorrectionWeekId(undefined);
      setCorrectionClassId(undefined);
      setAdminStatus("Results corrected and recorded in the audit history.");
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "Could not correct results.");
    } finally {
      setCorrectingResults(false);
    }
  }

  if (!teacher) {
    return <main className="app-shell auth-shell"><section className="auth-gate"><div className="brand"><img src="/assets/lrgs-quiz-crest.png" alt="" /><div><span>FRIDAY QUIZ LEAGUE</span><small>BRIGHT MINDS. A BRIGHTER FRIDAY.</small></div></div><span className="eyebrow">LRGS STAFF ACCESS</span><h1>Run your Friday quiz league.</h1><p>Sign in with your school Microsoft account to set up classes, enter results, and follow every leaderboard you teach.</p>{authError && <p role="alert">{authError}</p>}{isMicrosoftConfigured() && <button className="save-admin" onClick={() => void signIn()}>Sign in with Microsoft</button>}</section></main>;
  }

  if (profileState === "loading" || profileState === "idle") {
    return <main className="app-shell auth-shell"><section className="auth-gate league-state" aria-live="polite">Loading your class workspace...</section></main>;
  }

  if (profileState === "error") {
    return <main className="app-shell auth-shell"><section className="auth-gate"><span className="eyebrow">TEACHER ACCESS</span><h1>Class workspace</h1><p role="alert">{profileError}</p><button className="save-admin" onClick={() => void loadTeacherProfile()}>Try again</button></section></main>;
  }

  if (teacherProfile && teacherProfile.classes.length > 1 && !selectedClass && !creatingClass) {
    return <main className="app-shell"><header className="topbar"><div className="brand"><img src="/assets/lrgs-quiz-crest.png" alt="" /><div><span>FRIDAY QUIZ LEAGUE</span><small>BRIGHT MINDS. A BRIGHTER FRIDAY.</small></div></div></header><div className="modal-backdrop class-picker-backdrop"><section className="class-picker" role="dialog" aria-modal="true" aria-labelledby="class-picker-title"><span className="eyebrow">YOUR CLASSES</span><h1 id="class-picker-title">Which class are you running?</h1><div>{teacherProfile.classes.map((classroom) => <button key={classroom.id} type="button" onClick={() => { setSelectedClassId(classroom.id); setView("league"); }}><span>Year {classroom.yearGroup}</span><strong>{classroom.name}</strong><small>{classroom.teams.length} teams · {classroom.role === "lead" ? "Lead teacher" : "Class editor"}</small></button>)}</div><button className="save-admin" onClick={startClassCreation}>Add another class</button><button className="save-admin" onClick={() => { setTeacher(undefined); void signOutFromMicrosoft(); }}>Sign out</button></section></div></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/assets/lrgs-quiz-crest.png" alt="" />
          <div><span>FRIDAY QUIZ LEAGUE</span><small>BRIGHT MINDS. A BRIGHTER FRIDAY.</small></div>
        </div>
        <nav aria-label="Primary navigation">
          <button className={view === "league" ? "active" : ""} onClick={() => setView("league")}>League</button>
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin</button>
          {teacherProfile && teacherProfile.classes.length > 1 && <button onClick={() => setSelectedClassId(undefined)}>Change class</button>}
        </nav>
        <div className="topbar-actions"><p className="term-label">{selectedBoardId === "class" && selectedClass ? `${selectedClass.name.toUpperCase()} · YEAR ${selectedClass.yearGroup}` : leagueOptions.find((option) => option.id === selectedBoardId)?.name.toUpperCase() ?? league.term.name.toUpperCase()}<br /><strong>{displayedLeague.teams.length} TEAMS · {displayedLeague.quizWeeks.length} WEEKS</strong></p><button type="button" className="fullscreen-control" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}><span aria-hidden="true">⛶</span></button></div>
      </header>

      {view === "league" ? (
        showingManagedClass ? (managedLeagueError ? <section className="league-state" role="alert">{managedLeagueError} Refresh the page to try again.</section> : selectedBoardId === "class" && !managedLeague ? <section className="league-state" aria-live="polite">Loading your class competition...</section> : selectedBoardId !== "class" && !sharedBoard && !sharedBoardError ? <section className="league-state" aria-live="polite">Loading this league...</section> : sharedBoardError ? <section className="league-state" role="alert">{sharedBoardError}</section> : <><div className="board-selector"><label htmlFor="league-board">Leaderboard</label><select id="league-board" value={selectedBoardId} onChange={(event) => setSelectedBoardId(event.target.value)}><option value="class">My class: {selectedClass?.name}</option>{leagueOptions.filter((option) => option.enrolmentStatus === "active").map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div><section className="league-layout">
          <section className="standings-panel scoreboard-panel">
            <div className="section-heading"><span>TERM STANDINGS</span><strong>{termLeadLabel}</strong></div>
            <div className="column-labels"><span>RANK</span><span>TEAM</span><span>TOTAL POINTS</span></div>
            <div className={`team-list ${standingsScrolls ? "scrollable" : ""}`} role={standingsScrolls ? "region" : undefined} aria-label={standingsScrolls ? `Term standings, ${standings.length} teams. Scroll to view more teams.` : undefined} tabIndex={standingsScrolls ? 0 : undefined}>
              {standings.map((team, index) => (
                <article className={`team-row ${index === 0 ? "first" : ""} ${resultsRevealKey ? "results-reveal" : ""}`} key={`${team.id}-${resultsRevealKey}`} style={{ "--team-colour": team.colour, "--reveal-delay": `${index * 85}ms` } as CSSProperties}>
                  <strong className="rank" aria-label={`Rank ${index + 1}`}>{index + 1}</strong><span className="colour-bar" aria-hidden="true" />
                  <div><h2>{team.name}</h2><p>{index === 0 ? "SETTING THE PACE" : index === 1 ? "CLOSING THE GAP" : "STILL IN THE HUNT"}</p></div>
                  <b>{team.total}</b>
                </article>
              ))}
            </div>
          </section>
          <section className="chart-panel scoreboard-panel"><div className="section-heading"><span>TEAM MOMENTUM</span><strong>Cumulative points by week</strong></div><MomentumChart teams={standings} revealKey={resultsRevealKey} /><div className="legend">{standings.map((team) => <span key={team.id}><i style={{ background: team.colour }} />{team.name}</span>)}</div></section>
          <section className={teacher ? "league-bottom with-action" : "league-bottom"}>
            <section className={`winner-panel ${weeklyWinners.length > 1 ? "joint-winner" : ""}`}><img src="/assets/champion-trophy.png" alt="Golden quiz league trophy" /><div><span>{weeklyWinners.length > 2 ? "THIS WEEK'S RESULT" : "THIS WEEK'S WINNER"}</span><h1>{weeklyWinnerLabel}</h1><p>{weeklyWinnerDescription}</p></div></section>
            <section className="latest-panel"><span>LATEST SCORES</span>{latestScores.map((team) => <div key={team.id}><i style={{ background: team.colour }} />{team.name}<b className={team.latestScore === undefined && hasPublishedResults ? "not-entered" : ""}>{hasPublishedResults ? team.latestScore ?? "Not entered" : "-"}</b></div>)}</section>
            {teacher && selectedBoardId === "class" && <button className="add-results" onClick={() => { setEntryClassId(selectedClass?.id); setDraftScores(createScoreDraft(displayedLeague)); setShowEntry(true); }}><span aria-hidden="true">+</span>Add this week's results</button>}
          </section>
        </section></>) : <section className="league-state" aria-live="polite">Loading your class workspace...</section>
      ) : (
        <section className="admin-page">
          {!teacher ? <div>
            <span className="eyebrow">TEACHER ACCESS</span>
            <h1>Team admin</h1>
            <p>{isMicrosoftConfigured() ? "Sign in with your school Microsoft account to manage this league." : "Microsoft sign-in is waiting for the school Entra application details."}</p>
            {authError && <p role="alert">{authError}</p>}
            {isMicrosoftConfigured() && <button className="save-admin" onClick={() => void signIn()}>Sign in with Microsoft</button>}
          </div> : (teacherProfile?.needsRegistration || creatingClass) ? <form className="class-registration" onSubmit={(event) => void registerClass(event)}>
            {creatingClass && !teacherProfile?.needsRegistration && <button type="button" className="close" onClick={cancelClassCreation} aria-label="Cancel adding a class">×</button>}
            <div><span className="eyebrow">WELCOME, {teacher.displayName.toUpperCase()}</span><h1>Set up your class</h1><p>Create your form competition once. You can rename teams later; the roster is locked after its first submitted result.</p></div>
            <div className="registration-details"><label>Form or class name<input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="e.g. 13A" required autoFocus /></label><label>Year group<select value={yearGroup} onChange={(event) => setYearGroup(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 7).map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label></div>
            <div className="admin-toolbar"><span>{registrationTeams.length} teams</span><div><button type="button" className="team-count-control" onClick={removeRegistrationTeam} disabled={registrationTeams.length <= 2} aria-label="Remove the last team">-</button><button type="button" className="team-count-control" onClick={addRegistrationTeam} disabled={registrationTeams.length >= 24} aria-label="Add a team">+</button></div></div>
            <div className="admin-list">{registrationTeams.map((team, index) => <div className="team-admin-row" key={index}><i style={{ background: team.colour }} /><input value={team.name} onChange={(event) => updateRegistrationTeam(index, "name", event.target.value)} aria-label={`Team ${index + 1} name`} required /><label className="colour-picker"><span>Colour</span><input type="color" value={team.colour} onChange={(event) => updateRegistrationTeam(index, "colour", event.target.value)} aria-label={`Team ${index + 1} colour`} /></label><small>Team {index + 1}</small></div>)}</div>
            <section className="league-participation registration-participation"><div><span className="eyebrow">SHARED LEAGUES</span><p>Select the school leaderboards where this class's teams should appear. You can change these choices later.</p></div>{registrationLeagueOptions.map((option) => <label key={option.id}><span><strong>{option.name}</strong><small>{option.scope === "year_group" ? "Your year group" : option.scope === "phase" ? "Your school phase" : "All participating classes"}</small></span><input type="checkbox" checked={registrationLeagueIds.includes(option.id)} onChange={(event) => setRegistrationParticipation(option.id, event.target.checked)} aria-label={`Participate in ${option.name}`} /></label>)}</section>
            {profileError && <p role="alert">{profileError}</p>}
            <button className="save-admin" type="submit" disabled={registeringClass}>{registeringClass ? "Creating your class..." : "Create class competition"}</button>
          </form> : teacherProfile && selectedClass ? <section className="class-dashboard">
            <div><span className="eyebrow">MY CLASS</span><h1>{selectedClass.name}</h1><p>Year {selectedClass.yearGroup} · {selectedClass.role === "lead" ? "Lead teacher" : "Class editor"}</p></div>
            <section className="registered-roster"><div className="roster-heading"><span className="eyebrow">TEAM ROSTER</span>{!editingRoster && <button type="button" onClick={startRosterEdit}>Edit team names</button>}</div>{selectedClass.teams.map((team) => <div key={team.id}><i style={{ background: team.colour }} />{editingRoster ? <input value={classTeamNames[team.id] ?? team.name} onChange={(event) => setClassTeamNames((current) => ({ ...current, [team.id]: event.target.value }))} aria-label={`Team ${team.displayOrder} name`} /> : <strong>{team.name}</strong>}<small>Team {team.displayOrder}</small>{!editingRoster && <button type="button" className="retire-team" onClick={() => setRetiringTeamId(team.id)} disabled={selectedClass.teams.length <= 2} aria-label={`Retire ${team.name}`} title="Retire team from active leaderboards">×</button>}</div>)}{editingRoster && <div className="roster-actions"><button type="button" onClick={() => setEditingRoster(false)} disabled={savingRoster}>Cancel</button><button type="button" onClick={() => void saveClassTeamNames()} disabled={savingRoster}>{savingRoster ? "Saving..." : "Save names"}</button></div>}{retiringTeamId && <div className="retire-confirm" role="alert"><p><strong>Retire {selectedClass.teams.find((team) => team.id === retiringTeamId)?.name}?</strong> Its existing scores stay in the database, but it will disappear from active standings, charts and future score entry.</p><div><button type="button" onClick={() => setRetiringTeamId(undefined)} disabled={retiringTeam}>Cancel</button><button type="button" onClick={() => void retireClassTeam(retiringTeamId)} disabled={retiringTeam}>{retiringTeam ? "Retiring..." : "Retire team"}</button></div></div>}</section>
            <section className="league-participation"><div><span className="eyebrow">SHARED LEAGUES</span><p>Choose where this class's teams should appear. Form standings are always private to this class.</p></div>{leagueOptions.filter((option) => option.eligible).map((option) => <label key={option.id}><span><strong>{option.name}</strong><small>{option.scope === "year_group" ? "Your year group" : option.scope === "phase" ? "Your school phase" : "All participating classes"}</small></span><input type="checkbox" checked={option.enrolmentStatus === "active"} onChange={(event) => void setLeagueParticipation(option, event.target.checked)} aria-label={`Participate in ${option.name}`} /></label>)}</section>
            {managedLeagueError && <p role="alert">{managedLeagueError}</p>}
            {managedLeague && <section className="class-standings"><div className="section-heading"><span>FORM STANDINGS</span><strong>{managedLeague.quizWeeks.length ? `${managedLeague.quizWeeks.length} Fridays entered` : "First Friday awaits"}</strong></div>{getStandings(managedLeague).map((team, index) => <div key={team.id} style={{ "--team-colour": team.colour } as CSSProperties}><b>{index + 1}</b><span>{team.name}</span><strong>{team.total}</strong></div>)}</section>}
            <div className="dashboard-actions">{managedLeague && <button className="save-admin" onClick={() => { setEntryClassId(selectedClass.id); setDraftScores(createScoreDraft(managedLeague)); setShowEntry(true); }}>Add this Friday's results</button>}{managedLeague && managedLeague.quizWeeks.length > 0 && <button className="save-admin" onClick={() => setShowCorrectionPicker(true)}>Correct results</button>}<button className="save-admin" onClick={startClassCreation}>Add another class</button></div>
            {adminStatus && <p role="status">{adminStatus}</p>}
            <button className="save-admin" onClick={() => { setTeacher(undefined); void signOutFromMicrosoft(); }}>Sign out</button>
          </section> : <>
            <div><span className="eyebrow">LEAGUE SET-UP</span><h1>Team admin</h1><p>Signed in as {teacher.displayName}. Set a memorable name and colour for each team.</p></div>
            <div className="admin-toolbar"><span>{league.teams.length} active teams</span><div><button type="button" className="team-count-control" onClick={removeTeam} disabled={league.teams.length <= 2} aria-label="Remove the last team">-</button><button type="button" className="team-count-control" onClick={addTeam} disabled={league.teams.length >= 24} aria-label="Add a team">+</button></div></div>
            <div className="admin-list">{league.teams.map((team) => <div className="team-admin-row" key={team.id}><i style={{ background: team.colour }} /><input value={team.name} onChange={(event) => updateTeamName(team.id, event.target.value)} aria-label={`Team ${team.displayOrder} name`} /><label className="colour-picker"><span>Colour</span><input type="color" value={team.colour} onChange={(event) => updateTeamColour(team.id, event.target.value)} aria-label={`${team.name} colour`} /></label><small>Team {team.displayOrder}</small></div>)}</div>
            {adminStatus && <p role="status">{adminStatus}</p>}
            <button className="save-admin" onClick={() => void saveTeams()}>Save team settings</button>
            {league.quizWeeks.length > 0 && <section className="published-results"><span className="eyebrow">PUBLISHED RESULTS</span>{[...league.quizWeeks].sort((left, right) => right.weekNumber - left.weekNumber).map((week) => <div key={week.id}><span>Week {week.weekNumber} · {week.quizDate}</span><button type="button" onClick={() => openCorrection(week.id)}>Correct</button></div>)}</section>}
            <button className="save-admin" onClick={() => { setTeacher(undefined); void signOutFromMicrosoft(); }}>Sign out</button>
          </>}
        </section>
      )}

      {showEntry && entryLeague && <div className="modal-backdrop" role="presentation"><form className={`score-modal ${saved ? "results-published" : ""}`} onSubmit={(event) => void submitResults(event)}><button type="button" className="close" onClick={() => { setShowEntry(false); setEntryClassId(undefined); }} aria-label="Close score entry">Close</button><span className="eyebrow">PUBLISH RESULTS</span><h1>{saved ? "Results are live" : "Enter Friday's results"}</h1><p>{saved ? "The scoreboard is redrawing now." : "Each team gets one score. Publishing updates the league table and momentum chart straight away."}</p><div className="score-grid">{entryLeague.teams.map((team) => <div className="score-row" key={team.id}><label htmlFor={`score-${team.id}`}><i style={{ background: team.colour }} />{team.name}</label><div className="score-stepper"><button type="button" onClick={() => adjustScore(draftScores, setDraftScores, team.id, -1)} aria-label={`Decrease ${team.name} score`}>-</button><input id={`score-${team.id}`} aria-label={`${team.name} score`} type="number" min="0" step="1" value={draftScores[team.id]} onChange={(event) => setDraftScores({ ...draftScores, [team.id]: event.target.value })} /><button type="button" onClick={() => adjustScore(draftScores, setDraftScores, team.id, 1)} aria-label={`Increase ${team.name} score`}>+</button></div></div>)}</div>{scoreError && <p role="alert">{scoreError}</p>}<button className="save-results" type="submit" disabled={savingResults || saved}>{saved ? "Scoreboard live" : savingResults ? "Publishing results..." : "Publish results"}</button></form></div>}
      {showCorrectionPicker && managedLeague && selectedClass && <div className="modal-backdrop" role="presentation"><section className="class-picker correction-picker" role="dialog" aria-modal="true" aria-labelledby="correction-picker-title"><button type="button" className="close" onClick={() => setShowCorrectionPicker(false)} aria-label="Close result selection">Close</button><span className="eyebrow">CORRECT RESULTS</span><h1 id="correction-picker-title">Choose a Friday</h1><div>{[...managedLeague.quizWeeks].sort((left, right) => right.quizDate.localeCompare(left.quizDate)).map((week) => <button key={week.id} type="button" onClick={() => { setShowCorrectionPicker(false); openCorrection(week.id, managedLeague, selectedClass.id); }}><span>Week {week.weekNumber}</span><strong>{week.quizDate}</strong><small>Open score correction</small></button>)}</div></section></div>}
      {correctionWeekId && (correctionClassId ? managedLeague : league) && <div className="modal-backdrop" role="presentation"><form className="score-modal" onSubmit={(event) => void submitCorrection(event)}><button type="button" className="close" onClick={() => { setCorrectionWeekId(undefined); setCorrectionClassId(undefined); }} aria-label="Close correction">Close</button><span className="eyebrow">CORRECT RESULTS</span><h1>Correct a published Friday</h1><p>Changed scores are recorded with your identity, the previous value, and the reason below.</p><div className="score-grid">{(correctionClassId ? managedLeague! : league).teams.map((team) => <div className="score-row" key={team.id}><label htmlFor={`correction-${team.id}`}><i style={{ background: team.colour }} />{team.name}</label><div className="score-stepper"><button type="button" onClick={() => adjustScore(correctionScores, setCorrectionScores, team.id, -1)} aria-label={`Decrease ${team.name} corrected score`}>-</button><input id={`correction-${team.id}`} aria-label={`${team.name} corrected score`} type="number" min="0" step="1" value={correctionScores[team.id] ?? ""} onChange={(event) => setCorrectionScores({ ...correctionScores, [team.id]: event.target.value })} /><button type="button" onClick={() => adjustScore(correctionScores, setCorrectionScores, team.id, 1)} aria-label={`Increase ${team.name} corrected score`}>+</button></div></div>)}</div><label className="correction-reason"><span>Reason for correction</span><textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} required /></label><label className="confirmation"><input type="checkbox" checked={correctionConfirmed} onChange={(event) => setCorrectionConfirmed(event.target.checked)} />I confirm these corrected results should replace the published scores.</label>{correctionError && <p role="alert">{correctionError}</p>}<button className="save-results" type="submit" disabled={correctingResults}>{correctingResults ? "Saving correction..." : "Confirm correction"}</button></form></div>}
    </main>
  );
}
