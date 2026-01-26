import { pgTable, pgEnum, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { user } from "./schema.js";
import { programs } from "./training.js";

export const severityEnum = pgEnum('severity', ['low', 'medium', 'high']);
export const personalizationTypeEnum = pgEnum('personalization_type', ['injury_adaptation', 'reschedule', 'ai_generated']);

export const athleteInjuries = pgTable("athlete_injuries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  description: text("description").notNull(),
  affectedBodyParts: jsonb("affected_body_parts").notNull(), // Stores array of strings
  severity: severityEnum("severity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const programPersonalizations = pgTable("program_personalizations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  originalProgramId: text("original_program_id").notNull().references(() => programs.id),
  weekNumber: integer("week_number").notNull(),
  dayNumber: integer("day_number"), // Nullable means it overrides the whole week if needed
  personalizationType: personalizationTypeEnum("personalization_type").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalCostUsd: text("total_cost_usd").notNull().default("0"), // Using text for numeric precision if needed
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
