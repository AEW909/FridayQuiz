import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });

const ids = {
  teacher: "10000000-0000-4000-8000-000000000001",
  period: "10000000-0000-4000-8000-000000000002",
  series: "10000000-0000-4000-8000-000000000003",
  wholeSchoolLeague: "10000000-0000-4000-8000-000000000005",
};

const leagueDefinitions = [
  ["year_group", 7, null, "Year 7 League"],
  ["year_group", 8, null, "Year 8 League"],
  ["year_group", 9, null, "Year 9 League"],
  ["year_group", 10, null, "Year 10 League"],
  ["year_group", 11, null, "Year 11 League"],
  ["year_group", 12, null, "Year 12 League"],
  ["year_group", 13, null, "Year 13 League"],
  ["phase", null, "lower", "Lower School League"],
  ["phase", null, "middle", "Middle School League"],
  ["phase", null, "upper", "Upper School League"],
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("INSERT INTO teachers (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [ids.teacher, "League organiser"]);
  await client.query("INSERT INTO academic_periods (id, name, starts_on, ends_on) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING", [ids.period, "Autumn Term 2026", "2026-09-01", "2026-12-18"]);
  await client.query("INSERT INTO quiz_series (id, name, organiser_teacher_id, starts_on, ends_on) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING", [ids.series, "Friday Quiz League 2026", ids.teacher, "2026-09-01", "2026-12-18"]);
  await client.query("INSERT INTO leagues (id, quiz_series_id, academic_period_id, name, scope, starts_on, ends_on) VALUES ($1, $2, $3, $4, 'whole_school', $5, $6) ON CONFLICT (id) DO NOTHING", [ids.wholeSchoolLeague, ids.series, ids.period, "Whole School League", "2026-09-01", "2026-12-18"]);
  for (const [scope, yearGroup, phase, name] of leagueDefinitions) {
    await client.query(
      `INSERT INTO leagues (quiz_series_id, academic_period_id, name, scope, year_group, phase, starts_on, ends_on)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8
       WHERE NOT EXISTS (
         SELECT 1 FROM leagues WHERE quiz_series_id = $1 AND scope = $4
           AND year_group IS NOT DISTINCT FROM $5 AND phase IS NOT DISTINCT FROM $6
       )`,
      [ids.series, ids.period, name, scope, yearGroup, phase, "2026-09-01", "2026-12-18"],
    );
  }
  await client.query("COMMIT");
  console.log("Seeded Friday Quiz League foundation without demo class data.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
