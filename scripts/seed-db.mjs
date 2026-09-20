import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });

const ids = {
  teacher: "10000000-0000-4000-8000-000000000001",
  period: "10000000-0000-4000-8000-000000000002",
  series: "10000000-0000-4000-8000-000000000003",
  class: "10000000-0000-4000-8000-000000000004",
  league: "10000000-0000-4000-8000-000000000005",
};

const teams = [
  ["20000000-0000-4000-8000-000000000001", "Lions", "#f7c948", 1],
  ["20000000-0000-4000-8000-000000000002", "Hawks", "#47d990", 2],
  ["20000000-0000-4000-8000-000000000003", "Phoenixes", "#ff626f", 3],
  ["20000000-0000-4000-8000-000000000004", "Wolves", "#42a8ff", 4],
  ["20000000-0000-4000-8000-000000000005", "Unicorns", "#b68cff", 5],
  ["20000000-0000-4000-8000-000000000006", "Krakens", "#35d7df", 6],
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("INSERT INTO teachers (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [ids.teacher, "League organiser"]);
  await client.query("INSERT INTO academic_periods (id, name, starts_on, ends_on) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [ids.period, "Autumn Term 2026", "2026-09-01", "2026-12-18"]);
  await client.query("INSERT INTO quiz_series (id, name, organiser_teacher_id, starts_on, ends_on) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING", [ids.series, "Friday Quiz League 2026", ids.teacher, "2026-09-01", "2026-12-18"]);
  await client.query("INSERT INTO classes (id, teacher_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [ids.class, ids.teacher, "Friday Quiz League"]);
  await client.query("INSERT INTO leagues (id, quiz_series_id, academic_period_id, name, scope, starts_on, ends_on) VALUES ($1, $2, $3, $4, 'whole_school', $5, $6) ON CONFLICT (id) DO NOTHING", [ids.league, ids.series, ids.period, "Friday Quiz League", "2026-09-01", "2026-12-18"]);
  await client.query("INSERT INTO league_enrolments (league_id, class_id, enrolled_on) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM league_enrolments WHERE league_id = $1 AND class_id = $2)", [ids.league, ids.class, "2026-09-01"]);
  for (const [id, name, colour, order] of teams) await client.query("INSERT INTO teams (id, class_id, name, colour, display_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING", [id, ids.class, name, colour, order]);
  await client.query("COMMIT");
  console.log("Seeded Friday Quiz League foundation.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
