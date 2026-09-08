import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 300, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  user: {
    additionalFields: {
      activeWorkshopId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  advanced: {
    database: { joins: true },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});
