import pg from "pg";
import { requireClassMembership, requireTeacher, upsertTeacher } from "./_auth.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const quizSeriesId = "10000000-0000-4000-8000-000000000003";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function phaseFor(yearGroup: number) {
  if (yearGroup <= 9) return "lower";
  if (yearGroup <= 11) return "middle";
  return "upper";
}

async function signedInTeacher(client: pg.PoolClient, request: Request) {
  return upsertTeacher(client, await requireTeacher(request));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const leagueId = url.searchParams.get("leagueId");
  const client = await pool.connect();
  try {
    let teacher;
    try { teacher = await signedInTeacher(client, request); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, 401); }

    if (classId) {
      try { await requireClassMembership(client, classId, teacher.id); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "You do not have access to this class." }, 403); }
      const classResult = await client.query(`SELECT year_group AS "yearGroup" FROM classes WHERE id = $1`, [classId]);
      if (!classResult.rowCount) return json({ error: "That class could not be found." }, 404);
      const yearGroup = classResult.rows[0].yearGroup as number;
      const phase = phaseFor(yearGroup);
      const result = await client.query(
        `SELECT l.id, l.name, l.scope, l.year_group AS "yearGroup", l.phase,
                le.status AS "enrolmentStatus", le.enrolled_on AS "enrolledOn", le.withdrawn_on AS "withdrawnOn",
                (l.scope = 'year_group' AND l.year_group = $2)
                  OR (l.scope = 'phase' AND l.phase = $3)
                  OR l.scope = 'whole_school' AS "eligible"
           FROM leagues l
           LEFT JOIN league_enrolments le ON le.league_id = l.id AND le.class_id = $1
          WHERE l.quiz_series_id = $4
            AND l.scope IN ('year_group', 'phase', 'whole_school')
          ORDER BY CASE l.scope WHEN 'year_group' THEN 1 WHEN 'phase' THEN 2 ELSE 3 END, l.year_group, l.name`,
        [classId, yearGroup, phase, quizSeriesId],
      );
      return json({ leagues: result.rows });
    }

    if (!leagueId) return json({ error: "A class or league is required." }, 400);
    const leagueResult = await client.query(
      `SELECT id, name, scope, year_group AS "yearGroup", phase FROM leagues WHERE id = $1 AND quiz_series_id = $2`,
      [leagueId, quizSeriesId],
    );
    if (!leagueResult.rowCount) return json({ error: "That league could not be found." }, 404);
    const teams = await client.query(
      `SELECT t.id, t.name, t.colour, t.display_order AS "displayOrder", true AS active, c.name AS "className"
         FROM league_enrolments le
         JOIN teams t ON t.class_id = le.class_id AND t.active = true
         JOIN classes c ON c.id = le.class_id
        WHERE le.league_id = $1
        ORDER BY c.name, t.display_order`,
      [leagueId],
    );
    const scores = await client.query(
      `SELECT qw.id AS "quizWeekId", qw.week_number AS "weekNumber", qw.quiz_date AS "quizDate", qw.published_at AS "publishedAt",
              ws.id AS "scoreId", ws.score, ws.team_id AS "teamId"
         FROM league_enrolments le
         JOIN teams t ON t.class_id = le.class_id AND t.active = true
         JOIN weekly_scores ws ON ws.team_id = t.id
         JOIN quiz_weeks qw ON qw.id = ws.quiz_week_id AND qw.published_at IS NOT NULL
        WHERE le.league_id = $1
          AND qw.quiz_date >= le.enrolled_on
          AND (le.withdrawn_on IS NULL OR qw.quiz_date <= le.withdrawn_on)
        ORDER BY qw.week_number, t.display_order`,
      [leagueId],
    );
    type BoardWeek = { id: string; weekNumber: number; quizDate: string; publishedAt: string; scores: Array<{ id: string; score: number; teamId: string }> };
    const weeks = new Map<string, BoardWeek>();
    for (const row of scores.rows) {
      const week: BoardWeek = weeks.get(row.quizWeekId) ?? { id: row.quizWeekId, weekNumber: row.weekNumber, quizDate: row.quizDate, publishedAt: row.publishedAt, scores: [] };
      week.scores.push({ id: row.scoreId, score: row.score, teamId: row.teamId });
      weeks.set(row.quizWeekId, week);
    }
    return json({ league: leagueResult.rows[0], teams: teams.rows, weeks: [...weeks.values()] });
  } finally { client.release(); }
}

export async function PUT(request: Request) {
  let body: { classId?: string; leagueId?: string; participating?: boolean };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "A valid league participation request is required." }, 400); }
  if (!body.classId || !body.leagueId || typeof body.participating !== "boolean") return json({ error: "A class, league and participation choice are required." }, 400);
  const client = await pool.connect();
  try {
    let teacher;
    try {
      teacher = await signedInTeacher(client, request);
      await requireClassMembership(client, body.classId, teacher.id);
    } catch (error) { return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, 403); }
    const eligible = await client.query(
      `SELECT l.id FROM leagues l JOIN classes c ON c.id = $1
        WHERE l.id = $2 AND l.quiz_series_id = $3 AND (
          (l.scope = 'year_group' AND l.year_group = c.year_group)
          OR (l.scope = 'phase' AND l.phase = CASE WHEN c.year_group <= 9 THEN 'lower' WHEN c.year_group <= 11 THEN 'middle' ELSE 'upper' END)
          OR l.scope = 'whole_school'
        )`,
      [body.classId, body.leagueId, quizSeriesId],
    );
    if (!eligible.rowCount) return json({ error: "This class is not eligible for that league." }, 400);
    if (body.participating) {
      await client.query(
        `INSERT INTO league_enrolments (league_id, class_id, status, enrolled_on, withdrawn_on)
         VALUES ($1, $2, 'active', (SELECT starts_on FROM quiz_series WHERE id = $3), NULL)
         ON CONFLICT (league_id, class_id) DO UPDATE SET status = 'active', withdrawn_on = NULL`,
        [body.leagueId, body.classId, quizSeriesId],
      );
    } else {
      await client.query(`UPDATE league_enrolments SET status = 'withdrawn', withdrawn_on = CURRENT_DATE WHERE league_id = $1 AND class_id = $2`, [body.leagueId, body.classId]);
    }
    return json({ ok: true });
  } finally { client.release(); }
}
