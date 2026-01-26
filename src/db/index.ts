import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./schema.js";
import * as trainingSchema from "./training.js";
import * as aiAssistantSchema from "./ai_assistant.js";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const schema = { ...authSchema, ...trainingSchema, ...aiAssistantSchema };

export const db = drizzle(pool, { schema });
