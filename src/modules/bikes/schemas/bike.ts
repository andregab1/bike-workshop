import { z } from "zod";

const optionalText = z.union([z.string().trim(), z.null()]).transform((value) => value || null).optional();

export const createBikeSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  year: z.int().min(1900).max(2200).nullable().optional(),
  type: z.enum(["MTB", "ROAD", "GRAVEL", "BMX", "URBAN", "E_BIKE", "OTHER"]).nullable().optional(),
  wheelSize: optionalText,
  frameSize: optionalText,
  color: optionalText,
  serialNumber: optionalText,
  notes: optionalText,
});

export const updateBikeSchema = createBikeSchema.partial();
export const transferBikeSchema = z.object({ newCustomerId: z.string().min(1), reason: z.string().trim().min(3).max(500) });

export type CreateBikeInput = z.infer<typeof createBikeSchema>;
export type UpdateBikeInput = z.infer<typeof updateBikeSchema>;
