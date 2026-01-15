import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js"; // Adjust path if needed
import * as schema from "../db/schema.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true
  },
  basePath: "/api/v1/auth",
  trustedOrigins: [
    "null",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ],
  socialProviders: {}
});
