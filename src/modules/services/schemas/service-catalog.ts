import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || undefined).optional();

export const serviceCatalogInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText,
  category: optionalText,
  priceCents: z.int().min(0).max(100_000_000),
  estimatedDurationMinutes: z.int().min(1).max(100_000).nullish(),
  warrantyDays: z.int().min(0).max(3650).nullish(),
});

export const updateServiceCatalogSchema = serviceCatalogInputSchema.partial().extend({
  active: z.boolean().optional(),
});

export const serviceCatalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  active: z.enum(["true", "false", "all"]).default("true"),
});

export type ServiceCatalogInput = z.infer<typeof serviceCatalogInputSchema>;
export type UpdateServiceCatalogInput = z.infer<typeof updateServiceCatalogSchema>;
