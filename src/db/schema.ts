import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const leagueScope = pgEnum("league_scope", ["class", "year_group", "phase", "whole_school"]);
export const enrolmentStatus = pgEnum("enrolment_status", ["active", "paused", "withdrawn"]);
export const scoreAuditAction = pgEnum("score_audit_action", ["created", "corrected"]);
export const classTeacherRole = pgEnum("class_teacher_role", ["lead", "editor"]);

export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authSubject: text("auth_subject"),
    email: text("email"),
    displayName: text("display_name").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("teachers_auth_subject_unique").on(table.authSubject),
    uniqueIndex("teachers_email_unique").on(table.email),
  ],
);

export const academicPeriods = pgTable(
  "academic_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdAt,
  },
  (table) => [check("academic_period_dates_valid", sql`${table.endsOn} >= ${table.startsOn}`)],
);

export const quizSeries = pgTable(
  "quiz_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    organiserTeacherId: uuid("organiser_teacher_id").references(() => teachers.id),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdAt,
  },
  (table) => [check("quiz_series_dates_valid", sql`${table.endsOn} >= ${table.startsOn}`)],
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherId: uuid("teacher_id").references(() => teachers.id),
    name: text("name").notNull(),
    yearGroup: integer("year_group"),
    createdAt,
  },
  (table) => [index("classes_teacher_id_index").on(table.teacherId)],
);

export const classTeachers = pgTable(
  "class_teachers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id").notNull().references(() => classes.id),
    teacherId: uuid("teacher_id").notNull().references(() => teachers.id),
    role: classTeacherRole("role").notNull().default("editor"),
    addedByTeacherId: uuid("added_by_teacher_id").references(() => teachers.id),
    createdAt,
  },
  (table) => [
    uniqueIndex("class_teachers_class_teacher_unique").on(table.classId, table.teacherId),
    index("class_teachers_teacher_id_index").on(table.teacherId),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id").notNull().references(() => classes.id),
    name: text("name").notNull(),
    colour: text("colour").notNull(),
    displayOrder: integer("display_order").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt,
  },
  (table) => [
    uniqueIndex("teams_class_name_unique").on(table.classId, table.name),
    uniqueIndex("teams_class_display_order_unique").on(table.classId, table.displayOrder),
    check("teams_display_order_positive", sql`${table.displayOrder} > 0`),
  ],
);

export const leagues = pgTable(
  "leagues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizSeriesId: uuid("quiz_series_id").notNull().references(() => quizSeries.id),
    academicPeriodId: uuid("academic_period_id").references(() => academicPeriods.id),
    name: text("name").notNull(),
    scope: leagueScope("scope").notNull(),
    yearGroup: integer("year_group"),
    phase: text("phase"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdAt,
  },
  (table) => [
    index("leagues_quiz_series_id_index").on(table.quizSeriesId),
    check("league_dates_valid", sql`${table.endsOn} >= ${table.startsOn}`),
  ],
);

export const leagueEnrolments = pgTable(
  "league_enrolments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueId: uuid("league_id").notNull().references(() => leagues.id),
    classId: uuid("class_id").notNull().references(() => classes.id),
    status: enrolmentStatus("status").notNull().default("active"),
    enrolledOn: date("enrolled_on").notNull(),
    withdrawnOn: date("withdrawn_on"),
    createdAt,
  },
  (table) => [
    uniqueIndex("league_enrolments_league_class_unique").on(table.leagueId, table.classId),
    index("league_enrolments_league_id_index").on(table.leagueId),
    index("league_enrolments_class_id_index").on(table.classId),
    check(
      "league_enrolment_dates_valid",
      sql`${table.withdrawnOn} is null or ${table.withdrawnOn} >= ${table.enrolledOn}`,
    ),
  ],
);

export const quizWeeks = pgTable(
  "quiz_weeks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizSeriesId: uuid("quiz_series_id").notNull().references(() => quizSeries.id),
    weekNumber: integer("week_number").notNull(),
    quizDate: date("quiz_date").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    uniqueIndex("quiz_weeks_series_week_unique").on(table.quizSeriesId, table.weekNumber),
    uniqueIndex("quiz_weeks_series_date_unique").on(table.quizSeriesId, table.quizDate),
    check("quiz_weeks_week_number_positive", sql`${table.weekNumber} > 0`),
  ],
);

export const weeklyScores = pgTable(
  "weekly_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizWeekId: uuid("quiz_week_id").notNull().references(() => quizWeeks.id),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    score: integer("score").notNull(),
    submittedByTeacherId: uuid("submitted_by_teacher_id").references(() => teachers.id),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("weekly_scores_week_team_unique").on(table.quizWeekId, table.teamId),
    index("weekly_scores_team_id_index").on(table.teamId),
    check("weekly_scores_non_negative", sql`${table.score} >= 0`),
  ],
);

export const scoreAudits = pgTable(
  "score_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    weeklyScoreId: uuid("weekly_score_id").notNull().references(() => weeklyScores.id),
    action: scoreAuditAction("action").notNull(),
    previousScore: integer("previous_score"),
    nextScore: integer("next_score").notNull(),
    changedByTeacherId: uuid("changed_by_teacher_id").references(() => teachers.id),
    reason: text("reason"),
    createdAt,
  },
  (table) => [index("score_audits_weekly_score_id_index").on(table.weeklyScoreId)],
);
