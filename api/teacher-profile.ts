import pg from "pg";
import { requireTeacher, upsertTeacher } from "./_auth.js";
import { phaseForYearGroup } from "./_league-eligibility.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const quizSeriesId = "10000000-0000-4000-8000-000000000003";

type TeamDraft = { name?: string; colour?: string };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readClasses(client: pg.PoolClient, teacherId: string) {
  const result = await client.query(
    `SELECT c.id, c.name, c.year_group AS "yearGroup", ct.role,
            COALESCE(
              json_agg(json_build_object('id', t.id, 'name', t.name, 'colour', t.colour, 'displayOrder', t.display_order)
                ORDER BY t.display_order) FILTER (WHERE t.id IS NOT NULL),
              '[]'::json
            ) AS teams
       FROM class_teachers ct
       JOIN classes c ON c.id = ct.class_id
       LEFT JOIN teams t ON t.class_id = c.id AND t.active = true
      WHERE ct.teacher_id = $1
      GROUP BY c.id, ct.role
      ORDER BY c.created_at`,
    [teacherId],
  );
  return result.rows;
}

async function readAvailableLeagues(client: pg.PoolClient) {
  const result = await client.query(
    `SELECT id, name, scope, year_group AS "yearGroup", phase
       FROM leagues
      WHERE quiz_series_id = $1
        AND scope IN ('year_group', 'phase', 'whole_school')
      ORDER BY CASE scope WHEN 'year_group' THEN 1 WHEN 'phase' THEN 2 ELSE 3 END, year_group, name`,
    [quizSeriesId],
  );
  return result.rows;
}

export async function GET(request: Request) {
  let identity;
  try {
    identity = await requireTeacher(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, 401);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const teacher = await upsertTeacher(client, identity);
    const [classes, availableLeagues] = await Promise.all([readClasses(client, teacher.id), readAvailableLeagues(client)]);
    await client.query("COMMIT");
    return json({ teacher, classes, availableLeagues, needsRegistration: classes.length === 0 });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  let identity;
  try {
    identity = await requireTeacher(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Teacher sign-in is required." }, 401);
  }

  const body = await request.json() as { className?: string; yearGroup?: number; teams?: TeamDraft[]; leagueIds?: string[] };
  const className = body.className?.trim() ?? "";
  const teams = body.teams ?? [];
  const requestedLeagueIds = body.leagueIds ?? [];
  const normalizedNames = teams.map((team) => team.name?.trim().toLocaleLowerCase() ?? "");
  const validTeams = teams.length >= 2
    && teams.length <= 24
    && normalizedNames.every(Boolean)
    && new Set(normalizedNames).size === normalizedNames.length
    && teams.every((team) => /^#[0-9a-f]{6}$/i.test(team.colour ?? ""));
  const validLeagueIds = Array.isArray(requestedLeagueIds)
    && requestedLeagueIds.every((leagueId) => typeof leagueId === "string")
    && new Set(requestedLeagueIds).size === requestedLeagueIds.length;
  if (!className || !Number.isInteger(body.yearGroup) || body.yearGroup! < 7 || body.yearGroup! > 13 || !validTeams || !validLeagueIds) {
    return json({ error: "Enter a class name, a Year 7-13 group, and 2-24 uniquely named teams with valid colours." }, 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const teacher = await upsertTeacher(client, identity);
    if (requestedLeagueIds.length) {
      const eligibleLeagues = await client.query(
        `SELECT l.id
           FROM leagues l
          WHERE l.quiz_series_id = $1
            AND l.id = ANY($2::uuid[])
            AND (
              (l.scope = 'year_group' AND l.year_group = $3)
              OR (l.scope = 'phase' AND l.phase = $4)
              OR l.scope = 'whole_school'
            )`,
        [quizSeriesId, requestedLeagueIds, body.yearGroup, phaseForYearGroup(body.yearGroup!)],
      );
      if (eligibleLeagues.rowCount !== requestedLeagueIds.length) {
        await client.query("ROLLBACK");
        return json({ error: "Choose only the shared leagues available to this year group." }, 400);
      }
    }
    const createdClass = await client.query(
      `INSERT INTO classes (teacher_id, name, year_group)
       VALUES ($1, $2, $3)
       RETURNING id, name, year_group AS "yearGroup"`,
      [teacher.id, className, body.yearGroup],
    );
    const classroom = createdClass.rows[0] as { id: string; name: string; yearGroup: number };
    await client.query(
      `INSERT INTO class_teachers (class_id, teacher_id, role, added_by_teacher_id)
       VALUES ($1, $2, 'lead', $2)`,
      [classroom.id, teacher.id],
    );
    const savedTeams = [] as Array<{ id: string; name: string; colour: string; displayOrder: number }>;
    for (const [index, team] of teams.entries()) {
      const result = await client.query(
        `INSERT INTO teams (class_id, name, colour, display_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, colour, display_order AS "displayOrder"`,
        [classroom.id, team.name!.trim(), team.colour, index + 1],
      );
      savedTeams.push(result.rows[0]);
    }
    for (const leagueId of requestedLeagueIds) {
      await client.query(
        `INSERT INTO league_enrolments (league_id, class_id, status, enrolled_on, withdrawn_on)
         VALUES ($1, $2, 'active', (SELECT starts_on FROM quiz_series WHERE id = $3), NULL)`,
        [leagueId, classroom.id, quizSeriesId],
      );
    }
    await client.query("COMMIT");
    return json({ teacher, class: { ...classroom, role: "lead", teams: savedTeams } }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
