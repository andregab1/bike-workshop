import { z } from "zod";

export const workshopRoleSchema = z.enum(["OWNER", "MANAGER", "ATTENDANT", "MECHANIC", "STOCKKEEPER"]);

export const addMemberSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  role: workshopRoleSchema,
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(12).max(128).optional(),
}).superRefine((value, context) => {
  if ((value.name && !value.password) || (!value.name && value.password)) {
    context.addIssue({ code: "custom", message: "Informe nome e senha juntos para criar uma conta." });
  }
});

export const updateMemberSchema = z.object({
  active: z.boolean().optional(),
  role: workshopRoleSchema.optional(),
  name: z.string().trim().min(2).max(120).optional(),
}).refine((value) => value.active !== undefined || value.role !== undefined || value.name !== undefined, "Informe uma alteração.");

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
