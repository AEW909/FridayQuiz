import { useEffect, useMemo, useRef, useState } from "react";

const initialTeams = [
  { id: 1, name: "Lions", colour: "#f7c948", scores: [48, 61, 72, 59, 64, 66, 70, 47] },
  { id: 2, name: "Hawks", colour: "#47d990", scores: [40, 56, 62, 61, 61, 58, 63, 61] },
  { id: 3, name: "Phoenixes", colour: "#ff626f", scores: [37, 49, 52, 60, 53, 58, 54, 65] },
  { id: 4, name: "Wolves", colour: "#42a8ff", scores: [34, 45, 51, 53, 49, 55, 61, 48] },
  { id: 5, name: "Unicorns", colour: "#b68cff", scores: [29, 42, 48, 54, 59, 53, 56, 31] },
  { id: 6, name: "Krakens", colour: "#35d7df", scores: [24, 35, 41, 49, 47, 52, 45, 47] },
];

function MomentumChart({ teams }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const pad = { l: 48, r: 26, t: 18, b: 34 };
    const totals = teams.map((team) => team.scores.reduce((sum, score) => {
      sum.push((sum.at(-1) || 0) + score); return sum;
    }, []));
    const max = Math.ceil(Math.max(...totals.flat()) / 100) * 100;
    ctx.strokeStyle = "rgba(153, 183, 255, .16)"; ctx.lineWidth = 1; ctx.font = "12px Inter, sans-serif"; ctx.fillStyle = "#9fb1d9";
    for (let i = 0; i <= 5; i += 1) {
      const y = pad.t + ((height - pad.t - pad.b) * i) / 5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); ctx.fillText(String(max - (max * i) / 5), 2, y + 4);
    }
    const usableW = width - pad.l - pad.r; const usableH = height - pad.t - pad.b;
    teams.forEach((team, index) => {
      ctx.beginPath(); ctx.strokeStyle = team.colour; ctx.lineWidth = 3;
      totals[index].forEach((value, week) => { const x = pad.l + (usableW * week) / 7; const y = pad.t + usableH - (value / max) * usableH; week ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      totals[index].forEach((value, week) => { const x = pad.l + (usableW * week) / 7; const y = pad.t + usableH - (value / max) * usableH; ctx.beginPath(); ctx.fillStyle = team.colour; ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
    });
    for (let week = 0; week < 8; week += 1) { const x = pad.l + (usableW * week) / 7; ctx.fillText(`W${week + 1}`, x - 9, height - 9); }
  }, [teams]);
  return <canvas ref={canvasRef} width="670" height="330" aria-label="Cumulative points by week for all teams" />;
}

export function App() {
  const [teams, setTeams] = useState(initialTeams); const [view, setView] = useState("league"); const [showEntry, setShowEntry] = useState(false); const [draftScores, setDraftScores] = useState(() => Object.fromEntries(initialTeams.map((team) => [team.id, ""]))); const [saved, setSaved] = useState(false);
  const standings = useMemo(() => teams.map((team) => ({ ...team, total: team.scores.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total), [teams]); const winner = standings[0]; const thisWeek = [...teams].sort((a, b) => b.scores.at(-1) - a.scores.at(-1))[0];
  function submitResults(event) { event.preventDefault(); if (teams.some((team) => draftScores[team.id] === "" || Number.isNaN(Number(draftScores[team.id])))) return; setTeams((current) => current.map((team) => ({ ...team, scores: [...team.scores, Number(draftScores[team.id])] }))); setSaved(true); window.setTimeout(() => { setShowEntry(false); setSaved(false); setDraftScores(Object.fromEntries(teams.map((team) => [team.id, ""]))); }, 700); }
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span>FRIDAY QUIZ LEAGUE</span><small>BRIGHT MINDS. A BRIGHTER FRIDAY.</small></div><nav aria-label="Primary navigation"><button className={view === "league" ? "active" : ""} onClick={() => setView("league")}>League</button><button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin</button></nav><p className="term-label">AUTUMN TERM 2026<br /><strong>6 TEAMS · 8 WEEKS</strong></p></header>
    {view === "league" ? <section className="league-layout"><section className="standings-panel"><div className="section-heading"><span>TERM STANDINGS</span><strong>{winner.name} lead by {winner.total - standings[1].total}</strong></div><div className="column-labels"><span>RANK</span><span>TEAM</span><span>TOTAL POINTS</span></div><div className="team-list">{standings.map((team, index) => <article className={`team-row ${index === 0 ? "first" : ""}`} key={team.id} style={{ "--team-colour": team.colour }}><strong className="rank">{index + 1}</strong><span className="colour-bar" aria-hidden="true" /><div><h2>{team.name}</h2><p>{index === 0 ? "SETTING THE PACE" : index === 1 ? "CLOSING THE GAP" : "STILL IN THE HUNT"}</p></div><b>{team.total}</b></article>)}</div></section><section className="chart-panel"><div className="section-heading"><span>TEAM MOMENTUM</span><strong>Cumulative points by week</strong></div><MomentumChart teams={teams} /><div className="legend">{teams.map((team) => <span key={team.id}><i style={{ background: team.colour }} />{team.name}</span>)}</div></section><section className="winner-panel"><img src="/assets/champion-trophy.png" alt="Golden quiz league trophy" /><div><span>THIS WEEK’S WINNER</span><h1>{thisWeek.name}</h1><p>{thisWeek.scores.at(-1)} points. Another brilliant round.</p></div></section><section className="latest-panel"><span>LATEST SCORES</span>{standings.map((team) => <div key={team.id}><i style={{ background: team.colour }} />{team.name}<b>{team.scores.at(-1)}</b></div>)}</section><button className="add-results" onClick={() => setShowEntry(true)}>Add this week’s results</button></section> : <section className="admin-page"><div><span className="eyebrow">LEAGUE SET-UP</span><h1>Team admin</h1><p>Set the six team names before the first quiz. Their colours stay fixed to keep the standings recognisable at a glance.</p></div><div className="admin-list">{teams.map((team) => <label key={team.id}><i style={{ background: team.colour }} /><input value={team.name} onChange={(e) => setTeams((current) => current.map((item) => item.id === team.id ? { ...item, name: e.target.value } : item))} /><small>Team {team.id}</small></label>)}</div><button className="save-admin" onClick={() => setView("league")}>Save team names</button></section>}
    {showEntry && <div className="modal-backdrop" role="presentation"><form className="score-modal" onSubmit={submitResults}><button type="button" className="close" onClick={() => setShowEntry(false)} aria-label="Close score entry">Close</button><span className="eyebrow">WEEK {teams[0].scores.length + 1}</span><h1>Enter this week’s results</h1><p>Each team gets one score. The league table and momentum chart update straight away.</p><div className="score-grid">{teams.map((team) => <label key={team.id}><span><i style={{ background: team.colour }} />{team.name}</span><input aria-label={`${team.name} score`} type="number" min="0" value={draftScores[team.id]} onChange={(e) => setDraftScores({ ...draftScores, [team.id]: e.target.value })} /></label>)}</div><button className="save-results" type="submit">{saved ? "Results saved" : "Save results"}</button></form></div>}
  </main>;
}
