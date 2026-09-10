import { z } from "zod";

function environmentSchema(nodeEnvironment: string | undefined) {
  return z.object({
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    BETTER_AUTH_SECRET: z.string({ error: "BETTER_AUTH_SECRET is required." }).min(32, "BETTER_AUTH_SECRET must contain at least 32 characters."),
    BETTER_AUTH_URL: z.string({ error: "BETTER_AUTH_URL is required." }).url("BETTER_AUTH_URL must be a valid absolute URL.").refine(
      (value) => {
        const url = new URL(value);
        return nodeEnvironment !== "production" || url.protocol === "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      },
      "BETTER_AUTH_URL must use HTTPS in production.",
    ),
    DEMO_AUTH_ORGANIZATION_ID: z.string().min(1),
    DEMO_WORKSHOP_NAME: z.string().min(1),
    DEMO_WORKSHOP_SLUG: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  });
}

export function parseServerEnvironment(environment: Record<string, string | undefined>, nodeEnvironment = environment.NODE_ENV) {
  const result = environmentSchema(nodeEnvironment).safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid server environment: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  return result.data;
}

export const serverEnvironment = parseServerEnvironment({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  DEMO_AUTH_ORGANIZATION_ID: process.env.DEMO_AUTH_ORGANIZATION_ID,
  DEMO_WORKSHOP_NAME: process.env.DEMO_WORKSHOP_NAME,
  DEMO_WORKSHOP_SLUG: process.env.DEMO_WORKSHOP_SLUG,
  NODE_ENV: process.env.NODE_ENV,
}, process.env.NODE_ENV);
