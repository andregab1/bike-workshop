import { z } from "zod";

const checklistItemSchema = z.object({
  label: z.string().trim().min(1).max(180),
  section: z.string().trim().max(80).transform((value) => value || undefined).optional(),
});

export const checklistTemplateInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).transform((value) => value || undefined).optional(),
  items: z.array(checklistItemSchema).min(1).max(100),
});

export const updateChecklistTemplateSchema = checklistTemplateInputSchema.partial().extend({
  active: z.boolean().optional(),
});

export type ChecklistTemplateInput = z.infer<typeof checklistTemplateInputSchema>;
export type UpdateChecklistTemplateInput = z.infer<typeof updateChecklistTemplateSchema>;
