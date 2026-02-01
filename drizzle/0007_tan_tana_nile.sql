CREATE TABLE "default_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"gender" text,
	"min_age" integer,
	"max_age" integer,
	"goal" "exercise_type",
	"level" text
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" text DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"exclusive_with" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "goals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_goals" (
	"user_id" text NOT NULL,
	"goal_id" text NOT NULL,
	CONSTRAINT "user_goals_user_id_goal_id_pk" PRIMARY KEY("user_id","goal_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "goals" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "availability_per_week" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "default_programs" ADD CONSTRAINT "default_programs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;