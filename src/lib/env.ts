import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DEMO_AUTH_ORGANIZATION_ID: z.string().min(1),
  DEMO_WORKSHOP_NAME: z.string().min(1),
  DEMO_WORKSHOP_SLUG: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const serverEnvironment = serverEnvironmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DEMO_AUTH_ORGANIZATION_ID: process.env.DEMO_AUTH_ORGANIZATION_ID,
  DEMO_WORKSHOP_NAME: process.env.DEMO_WORKSHOP_NAME,
  DEMO_WORKSHOP_SLUG: process.env.DEMO_WORKSHOP_SLUG,
});
