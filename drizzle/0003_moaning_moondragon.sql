CREATE TYPE "public"."exercise_type" AS ENUM('cardio', 'strengh', 'flexibility', 'skill', 'other');--> statement-breakpoint
CREATE TABLE "day_plan_wod_blocs" (
	"day_plan_id" text NOT NULL,
	"wod_bloc_id" text NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "day_plan_wod_blocs_day_plan_id_wod_bloc_id_pk" PRIMARY KEY("day_plan_id","wod_bloc_id")
);
--> statement-breakpoint
CREATE TABLE "day_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"day_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"user_id" text NOT NULL,
	"program_id" text NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_id_program_id_pk" PRIMARY KEY("user_id","program_id")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sets" integer DEFAULT 1 NOT NULL,
	"reps" integer,
	"time" interval,
	"type" "exercise_type",
	CONSTRAINT "sets_check" CHECK ("exercises"."sets" > 0),
	CONSTRAINT "reps_check" CHECK ("exercises"."reps" > 0)
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "wod_bloc_exercises" (
	"wod_bloc_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	CONSTRAINT "wod_bloc_exercises_wod_bloc_id_exercise_id_pk" PRIMARY KEY("wod_bloc_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "wod_blocs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" "exercise_type" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "day_plan_wod_blocs" ADD CONSTRAINT "day_plan_wod_blocs_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plan_wod_blocs" ADD CONSTRAINT "day_plan_wod_blocs_wod_bloc_id_wod_blocs_id_fk" FOREIGN KEY ("wod_bloc_id") REFERENCES "public"."wod_blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wod_bloc_exercises" ADD CONSTRAINT "wod_bloc_exercises_wod_bloc_id_wod_blocs_id_fk" FOREIGN KEY ("wod_bloc_id") REFERENCES "public"."wod_blocs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wod_bloc_exercises" ADD CONSTRAINT "wod_bloc_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;