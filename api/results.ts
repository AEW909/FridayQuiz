import pg from "pg";
import { requireClassMembership, requireTeacher, upsertTeacher } from "./_auth.js";

const { Pool } = pg;
const defaultClassId = "10000000-0000-4000-8000-000000000004";
const quizSeriesId = "10000000-0000-4000-8000-000000000003";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
type ScoreInput = { displayOrder: number; score: number };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isFriday(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay() === 5;
}

async function getActiveTeams(client: pg.PoolClient, classId: string) {
  const teams = await client.query(
    `SELECT id, display_order AS "displayOrder" FROM teams
      WHERE class_id = $1 AND active = true ORDER BY display_order`,
    [classId],
  );
  return teams.rows as Array<{ id: string; displayOrder: number }>;
}

function scoresAreComplete(scores: ScoreInput[], teams: Array<{ displayOrder: number }>) {
  const scoresByOrder = new Map(scores.map((score) => [score.displayOrder, score.score]));
  return scores.length === teams.length
    && scoresByOrder.size === teams.length
    && teams.every((team) => Number.isInteger(scoresByOrder.get(team.displayOrder)) && (scoresByOrder.get(team.displayOrder) ?? -1) >= 0);
}

async function establishClassAccess(client: pg.PoolClient, request: Request, classId: string, enforceMembership: boolean) {
  const identity = await requireTeacher(request);
  const teacher = await upsertTeacher(client, identity);
  if (enforceMembership) await requireClassMembership(client, classId, teacher.id);
  return teacher;
}

export async function GET(request: Request) {
  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return json({ error: "A class is required." }, 400);
  const client = await pool.connect();
  try {
    try {
      const teacher = await upsertTeacher(client, await requireTeacher(request));
      await requireClassMembership(client, classId, teacher.id);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, error instanceof Error && error.message.includes("access to this class") ? 403 : 401);
    }
    const result = await client.query(
      `SELECT qw.id AS "quizWeekId", qw.week_number AS "weekNumber", qw.quiz_date AS "quizDate", qw.published_at AS "publishedAt",
              ws.id AS "scoreId", ws.score, ws.team_id AS "teamId", t.display_order AS "displayOrder"
         FROM quiz_weeks qw JOIN weekly_scores ws ON ws.quiz_week_id = qw.id JOIN teams t ON t.id = ws.team_id
        WHERE qw.quiz_series_id = $1 AND qw.published_at IS NOT NULL AND t.class_id = $2
        ORDER BY qw.week_number, t.display_order`,
      [quizSeriesId, classId],
    );
    const weeks = new Map<string, { id: string; weekNumber: number; quizDate: string; publishedAt: string; scores: Array<{ id: string; score: number; teamId: string; displayOrder: number }> }>();
    for (const row of result.rows) {
      const week: { id: string; weekNumber: number; quizDate: string; publishedAt: string; scores: Array<{ id: string; score: number; teamId: string; displayOrder: number }> } = weeks.get(row.quizWeekId) ?? {
        id: row.quizWeekId, weekNumber: row.weekNumber, quizDate: row.quizDate, publishedAt: row.publishedAt, scores: [],
      };
      week.scores.push({ id: row.scoreId, score: row.score, teamId: row.teamId, displayOrder: row.displayOrder });
      weeks.set(row.quizWeekId, week);
    }
    return json({ weeks: [...weeks.values()] });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  let body: { classId?: string; quizDate?: string; scores?: ScoreInput[] };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "A valid JSON results payload is required." }, 400); }
  const classId = body.classId ?? defaultClassId;
  const isClassScoped = Boolean(body.classId);
  if (!body.quizDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.quizDate) || !body.scores) return json({ error: "A valid quiz date and all team scores are required." }, 400);
  if (isClassScoped && !isFriday(body.quizDate)) return json({ error: "Class results must be recorded against a Friday quiz." }, 400);

  const client = await pool.connect();
  try {
    let teacher;
    try { teacher = await establishClassAccess(client, request, classId, isClassScoped); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, error instanceof Error && error.message.includes("access to this class") ? 403 : 401); }
    const teams = await getActiveTeams(client, classId);
    if (!scoresAreComplete(body.scores, teams)) return json({ error: "Enter one non-negative whole-number score for every active team." }, 400);
    const scoresByOrder = new Map(body.scores.map((score) => [score.displayOrder, score.score]));

    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${quizSeriesId}:${body.quizDate}`]);
    const found = await client.query("SELECT id, week_number AS \"weekNumber\", quiz_date AS \"quizDate\", published_at AS \"publishedAt\" FROM quiz_weeks WHERE quiz_series_id = $1 AND quiz_date = $2", [quizSeriesId, body.quizDate]);
    let week = found.rows[0] as { id: string; weekNumber: number; quizDate: string; publishedAt: string } | undefined;
    if (!week) {
      const next = await client.query("SELECT COALESCE(MAX(week_number), 0) + 1 AS \"weekNumber\" FROM quiz_weeks WHERE quiz_series_id = $1", [quizSeriesId]);
      const created = await client.query("INSERT INTO quiz_weeks (quiz_series_id, week_number, quiz_date, published_at) VALUES ($1, $2, $3, NOW()) RETURNING id, week_number AS \"weekNumber\", quiz_date AS \"quizDate\", published_at AS \"publishedAt\"", [quizSeriesId, next.rows[0].weekNumber, body.quizDate]);
      week = created.rows[0];
    }
    const savedWeek = week!;
    const submitted = await client.query(`SELECT ws.id FROM weekly_scores ws JOIN teams t ON t.id = ws.team_id WHERE ws.quiz_week_id = $1 AND t.class_id = $2`, [savedWeek.id, classId]);
    if (submitted.rowCount) {
      await client.query("ROLLBACK");
      return json({ error: "This class has already submitted results for that Friday. Use the correction flow." }, 409);
    }
    for (const team of teams) await client.query("INSERT INTO weekly_scores (quiz_week_id, team_id, score, submitted_by_teacher_id) VALUES ($1, $2, $3, $4)", [savedWeek.id, team.id, scoresByOrder.get(team.displayOrder), teacher.id]);
    await client.query("COMMIT");
    return json({ week: savedWeek, scores: teams.map((team) => ({ displayOrder: team.displayOrder, score: scoresByOrder.get(team.displayOrder) })) }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function PATCH(request: Request) {
  let body: { classId?: string; quizWeekId?: string; reason?: string; scores?: ScoreInput[] };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "A valid JSON correction payload is required." }, 400); }
  const classId = body.classId ?? defaultClassId;
  const isClassScoped = Boolean(body.classId);
  if (!body.quizWeekId || !body.reason?.trim() || !body.scores) return json({ error: "A correction reason and all team scores are required." }, 400);
  const client = await pool.connect();
  try {
    let teacher;
    try { teacher = await establishClassAccess(client, request, classId, isClassScoped); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, error instanceof Error && error.message.includes("access to this class") ? 403 : 401); }
    const teams = await getActiveTeams(client, classId);
    if (!scoresAreComplete(body.scores, teams)) return json({ error: "Enter one non-negative whole-number score for every active team." }, 400);
    const scoresByOrder = new Map(body.scores.map((score) => [score.displayOrder, score.score]));
    await client.query("BEGIN");
    const week = await client.query("SELECT id FROM quiz_weeks WHERE id = $1 AND quiz_series_id = $2 AND published_at IS NOT NULL", [body.quizWeekId, quizSeriesId]);
    if (!week.rowCount) { await client.query("ROLLBACK"); return json({ error: "That published Friday could not be found." }, 404); }
    const existing = await client.query(`SELECT ws.id, ws.score, t.display_order AS "displayOrder" FROM weekly_scores ws JOIN teams t ON t.id = ws.team_id WHERE ws.quiz_week_id = $1 AND t.class_id = $2`, [body.quizWeekId, classId]);
    if (existing.rows.length !== teams.length) { await client.query("ROLLBACK"); return json({ error: "This class has not submitted results for that Friday." }, 409); }
    for (const score of existing.rows) {
      const nextScore = scoresByOrder.get(score.displayOrder) as number;
      if (nextScore === score.score) continue;
      await client.query("UPDATE weekly_scores SET score = $1, updated_at = NOW(), submitted_by_teacher_id = $2 WHERE id = $3", [nextScore, teacher.id, score.id]);
      await client.query("INSERT INTO score_audits (weekly_score_id, action, previous_score, next_score, changed_by_teacher_id, reason) VALUES ($1, 'corrected', $2, $3, $4, $5)", [score.id, score.score, nextScore, teacher.id, body.reason.trim()]);
    }
    await client.query("COMMIT");
    return json({ scores: teams.map((team) => ({ displayOrder: team.displayOrder, score: scoresByOrder.get(team.displayOrder) })) });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
