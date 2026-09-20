ALTER TYPE "public"."league_scope" ADD VALUE IF NOT EXISTS 'phase' BEFORE 'whole_school';--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "phase" text;
