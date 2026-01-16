ALTER TABLE "session" ADD COLUMN "token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "createdAt" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "updatedAt" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE("token");