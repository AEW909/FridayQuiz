CREATE TYPE "public"."enrolment_status" AS ENUM('active', 'paused', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."league_scope" AS ENUM('class', 'year_group', 'whole_school');--> statement-breakpoint
CREATE TYPE "public"."score_audit_action" AS ENUM('created', 'corrected');--> statement-breakpoint
CREATE TABLE "academic_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_period_dates_valid" CHECK ("academic_periods"."ends_on" >= "academic_periods"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid,
	"name" text NOT NULL,
	"year_group" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"status" "enrolment_status" DEFAULT 'active' NOT NULL,
	"enrolled_on" date NOT NULL,
	"withdrawn_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_enrolment_dates_valid" CHECK ("league_enrolments"."withdrawn_on" is null or "league_enrolments"."withdrawn_on" >= "league_enrolments"."enrolled_on")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_series_id" uuid NOT NULL,
	"academic_period_id" uuid,
	"name" text NOT NULL,
	"scope" "league_scope" NOT NULL,
	"year_group" integer,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_dates_valid" CHECK ("leagues"."ends_on" >= "leagues"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "quiz_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organiser_teacher_id" uuid,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_series_dates_valid" CHECK ("quiz_series"."ends_on" >= "quiz_series"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "quiz_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_series_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"quiz_date" date NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_weeks_week_number_positive" CHECK ("quiz_weeks"."week_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "score_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_score_id" uuid NOT NULL,
	"action" "score_audit_action" NOT NULL,
	"previous_score" integer,
	"next_score" integer NOT NULL,
	"changed_by_teacher_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text,
	"email" text,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"colour" text NOT NULL,
	"display_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_display_order_positive" CHECK ("teams"."display_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "weekly_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_week_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"submitted_by_teacher_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_scores_non_negative" CHECK ("weekly_scores"."score" >= 0)
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_enrolments" ADD CONSTRAINT "league_enrolments_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_enrolments" ADD CONSTRAINT "league_enrolments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_quiz_series_id_quiz_series_id_fk" FOREIGN KEY ("quiz_series_id") REFERENCES "public"."quiz_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_academic_period_id_academic_periods_id_fk" FOREIGN KEY ("academic_period_id") REFERENCES "public"."academic_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_series" ADD CONSTRAINT "quiz_series_organiser_teacher_id_teachers_id_fk" FOREIGN KEY ("organiser_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_weeks" ADD CONSTRAINT "quiz_weeks_quiz_series_id_quiz_series_id_fk" FOREIGN KEY ("quiz_series_id") REFERENCES "public"."quiz_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_audits" ADD CONSTRAINT "score_audits_weekly_score_id_weekly_scores_id_fk" FOREIGN KEY ("weekly_score_id") REFERENCES "public"."weekly_scores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_audits" ADD CONSTRAINT "score_audits_changed_by_teacher_id_teachers_id_fk" FOREIGN KEY ("changed_by_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_scores" ADD CONSTRAINT "weekly_scores_quiz_week_id_quiz_weeks_id_fk" FOREIGN KEY ("quiz_week_id") REFERENCES "public"."quiz_weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_scores" ADD CONSTRAINT "weekly_scores_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_scores" ADD CONSTRAINT "weekly_scores_submitted_by_teacher_id_teachers_id_fk" FOREIGN KEY ("submitted_by_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_teacher_id_index" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "league_enrolments_league_id_index" ON "league_enrolments" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "league_enrolments_class_id_index" ON "league_enrolments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "leagues_quiz_series_id_index" ON "leagues" USING btree ("quiz_series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_weeks_series_week_unique" ON "quiz_weeks" USING btree ("quiz_series_id","week_number");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_weeks_series_date_unique" ON "quiz_weeks" USING btree ("quiz_series_id","quiz_date");--> statement-breakpoint
CREATE INDEX "score_audits_weekly_score_id_index" ON "score_audits" USING btree ("weekly_score_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_auth_subject_unique" ON "teachers" USING btree ("auth_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_email_unique" ON "teachers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_class_name_unique" ON "teams" USING btree ("class_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_class_display_order_unique" ON "teams" USING btree ("class_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_scores_week_team_unique" ON "weekly_scores" USING btree ("quiz_week_id","team_id");--> statement-breakpoint
CREATE INDEX "weekly_scores_team_id_index" ON "weekly_scores" USING btree ("team_id");