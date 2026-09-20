CREATE TYPE "public"."class_teacher_role" AS ENUM('lead', 'editor');--> statement-breakpoint
CREATE TABLE "class_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"role" "class_teacher_role" DEFAULT 'editor' NOT NULL,
	"added_by_teacher_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_added_by_teacher_id_teachers_id_fk" FOREIGN KEY ("added_by_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_teachers_class_teacher_unique" ON "class_teachers" USING btree ("class_id","teacher_id");--> statement-breakpoint
CREATE INDEX "class_teachers_teacher_id_index" ON "class_teachers" USING btree ("teacher_id");--> statement-breakpoint
INSERT INTO "class_teachers" ("class_id", "teacher_id", "role", "added_by_teacher_id")
SELECT "id", "teacher_id", 'lead', "teacher_id"
FROM "classes"
WHERE "teacher_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "league_enrolments_league_class_unique" ON "league_enrolments" USING btree ("league_id","class_id");
