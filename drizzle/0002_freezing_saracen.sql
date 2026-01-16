CREATE TYPE "public"."role" AS ENUM('coach', 'athlete');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "role" DEFAULT 'athlete' NOT NULL;