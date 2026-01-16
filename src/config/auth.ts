import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js"; // Adjust path if needed
import * as schema from "../db/schema.js";
import { sendEmail } from "../services/email.service.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "athlete",
        input: true,
      }
    }
  },
  callbacks: {
    session: async ({ session, user }) => {
      return {
        ...session,
        user: {
          ...session.user,
          role: user.role
        }
      }
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Click the link to verify your email: ${url}`,
      });
    },
    sendOnSignIn: true,
  },
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
