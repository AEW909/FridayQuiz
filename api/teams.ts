import pg from "pg";
import { requireClassMembership, requireTeacher, upsertTeacher } from "./_auth.js";
import { canChangeTeamCount } from "./_team-roster.js";

const { Pool } = pg;
const defaultClassId = "10000000-0000-4000-8000-000000000004";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
    const result = await client.query("SELECT id, name, colour, display_order AS \"displayOrder\", active FROM teams WHERE class_id = $1 ORDER BY display_order", [classId]);
    return json({ teams: result.rows });
  } finally {
    client.release();
  }
}

export async function PUT(request: Request) {
  const body = await request.json() as { classId?: string; teams?: Array<{ id?: string; name: string; colour: string; displayOrder: number; active: boolean }> };
  const classId = body.classId ?? defaultClassId;
  const isClassScoped = Boolean(body.classId);
  const teams = body.teams?.filter((team) => team.active) ?? [];
  const names = teams.map((team) => team.name.trim().toLocaleLowerCase());
  if (teams.length < 2 || teams.length > 24 || names.some((name) => !name) || new Set(names).size !== names.length) return json({ error: "Use 2-24 uniquely named active teams." }, 400);
  for (const team of teams) {
    if (!/^#[0-9a-f]{6}$/i.test(team.colour)) return json({ error: "Each team needs a valid colour." }, 400);
  }
  const client = await pool.connect();
  try {
    try {
      const teacher = await upsertTeacher(client, await requireTeacher(request));
      if (isClassScoped) await requireClassMembership(client, classId, teacher.id);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, error instanceof Error && error.message.includes("access to this class") ? 403 : 401);
    }
    const roster = await client.query(
      `SELECT count(*) FILTER (WHERE t.active)::int AS "activeTeamCount",
              EXISTS(SELECT 1 FROM weekly_scores ws JOIN teams scored_team ON scored_team.id = ws.team_id WHERE scored_team.class_id = $1) AS "hasSubmittedScores"
         FROM teams t
        WHERE t.class_id = $1`,
      [classId],
    );
    const { activeTeamCount, hasSubmittedScores } = roster.rows[0] as { activeTeamCount: number; hasSubmittedScores: boolean };
    if (!canChangeTeamCount(hasSubmittedScores, activeTeamCount, teams.length)) {
      return json({ error: "The team count is locked once this class has submitted results. You can still rename teams and change their colours." }, 409);
    }
    await client.query("BEGIN");
    // Vacate unique names before applying a whole roster update, so name swaps work.
    await client.query("UPDATE teams SET name = CONCAT('__archived_', id::text), active = false WHERE class_id = $1", [classId]);
    for (const [index, team] of teams.entries()) {
      const updated = await client.query("UPDATE teams SET name = $1, colour = $2, active = true WHERE class_id = $3 AND display_order = $4", [team.name.trim(), team.colour, classId, index + 1]);
      if (!updated.rowCount) await client.query("INSERT INTO teams (class_id, name, colour, display_order, active) VALUES ($1, $2, $3, $4, true)", [classId, team.name.trim(), team.colour, index + 1]);
    }
    await client.query("COMMIT");
    const saved = await pool.query("SELECT id, name, colour, display_order AS \"displayOrder\", active FROM teams WHERE class_id = $1 AND active = true ORDER BY display_order", [classId]);
    return json({ teams: saved.rows });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
