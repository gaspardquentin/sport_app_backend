CREATE TYPE "public"."personalization_type" AS ENUM('injury_adaptation', 'reschedule', 'ai_generated');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "athlete_injuries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text NOT NULL,
	"affected_body_parts" jsonb NOT NULL,
	"severity" "severity" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "program_personalizations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"original_program_id" text NOT NULL,
	"week_number" integer NOT NULL,
	"day_number" integer,
	"personalization_type" "personalization_type" NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "age" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "athlete_injuries" ADD CONSTRAINT "athlete_injuries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_personalizations" ADD CONSTRAINT "program_personalizations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_personalizations" ADD CONSTRAINT "program_personalizations_original_program_id_programs_id_fk" FOREIGN KEY ("original_program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;