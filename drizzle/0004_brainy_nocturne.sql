ALTER TABLE "programs" ADD COLUMN "creator_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "creation_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "last_edit_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;