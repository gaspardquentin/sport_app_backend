import { pgTable, text, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./schema.js";

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  code: text("code").notNull().unique(), // e.g., 'weight_loss' for stable references
  description: text("description"),
  exclusiveWith: jsonb("exclusive_with").$type<string[]>().default([]), // List of goal codes/IDs that are exclusive
});

export const userGoals = pgTable("user_goals", {
  userId: text("user_id").notNull().references(() => user.id),
  goalId: text("goal_id").notNull().references(() => goals.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.goalId] }),
}));
