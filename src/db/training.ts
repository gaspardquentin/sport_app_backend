import { pgTable, pgEnum, text, integer, timestamp, boolean, uuid, check, interval, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./schema";


export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  expiresAt: timestamp("expiresAt"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull()
});

//TODO: maybe replace this with another table ? Or fill it with more data
export const exerciseType = pgEnum('exercise_type', ['cardio', 'strengh', 'flexibility', 'skill', 'other']);

/*
String id
String title
int sets
int? reps
Duration? time
ExerciseType type
*/
export const exercises = pgTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sets: integer("sets").notNull().default(1),
  reps: integer("reps"),
  time: interval("time"),
  type: exerciseType()
},
  (table) => [
    check("sets_check", sql`${table.sets} > 0`),
    check("reps_check", sql`${table.reps} > 0`),
  ],
);


export const wodBlocs = pgTable("wod_blocs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: exerciseType().notNull(),
});

export const wodBlocExercises = pgTable("wod_bloc_exercises", {
  wodBlocId: text("wod_bloc_id").notNull().references(() => wodBlocs.id),
  exerciseId: text("exercise_id").notNull().references(() => exercises.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.wodBlocId, table.exerciseId] }),
}));

export const programs = pgTable("programs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
});

export const dayPlans = pgTable("day_plans", {
  id: text("id").primaryKey(),
  programId: text("program_id").notNull().references(() => programs.id),
  dayNumber: integer("day_number").notNull(),
});

export const dayPlanWodBlocs = pgTable("day_plan_wod_blocs", {
  dayPlanId: text("day_plan_id").notNull().references(() => dayPlans.id),
  wodBlocId: text("wod_bloc_id").notNull().references(() => wodBlocs.id),
  order: integer("order").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.dayPlanId, table.wodBlocId] }),
}));

export const enrollments = pgTable("enrollments", {
  userId: text("user_id").notNull().references(() => user.id),
  programId: text("program_id").notNull().references(() => programs.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.programId] }),
}));
