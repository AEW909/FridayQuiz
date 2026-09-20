import pg from "pg";
import { requireSchoolAdmin, upsertTeacher } from "./_auth.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  let identity;
  try { identity = await requireSchoolAdmin(request); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "School administrator access is required." }, 403); }

  const client = await pool.connect();
  try {
    await upsertTeacher(client, identity);
    const result = await client.query(
      `SELECT c.id, c.name, c.year_group AS "yearGroup", lead.display_name AS "leadTeacher",
              count(DISTINCT t.id)::int AS "teamCount",
              count(DISTINCT ws.quiz_week_id)::int AS "submittedWeeks",
              max(qw.quiz_date) AS "lastSubmittedOn",
              COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object('name', l.name, 'status', le.status))
                  FILTER (WHERE l.id IS NOT NULL),
                '[]'::jsonb
              ) AS participation
         FROM classes c
         LEFT JOIN class_teachers leadMembership ON leadMembership.class_id = c.id AND leadMembership.role = 'lead'
         LEFT JOIN teachers lead ON lead.id = leadMembership.teacher_id
         LEFT JOIN teams t ON t.class_id = c.id AND t.active = true
         LEFT JOIN weekly_scores ws ON ws.team_id = t.id
         LEFT JOIN quiz_weeks qw ON qw.id = ws.quiz_week_id
         LEFT JOIN league_enrolments le ON le.class_id = c.id
         LEFT JOIN leagues l ON l.id = le.league_id
        GROUP BY c.id, lead.display_name
        ORDER BY c.year_group, c.name`,
    );
    const classes = result.rows;
    return json({
      totals: {
        classes: classes.length,
        teams: classes.reduce((total, classroom) => total + classroom.teamCount, 0),
        submittedClasses: classes.filter((classroom) => classroom.submittedWeeks > 0).length,
      },
      classes,
    });
  } finally { client.release(); }
}
