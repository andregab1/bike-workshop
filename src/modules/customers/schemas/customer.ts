import { z } from "zod";

import { normalizeCpfCnpj, normalizePhone } from "@/modules/customers/customer-identity";

const optionalText = z.union([z.string().trim(), z.null()]).transform((value) => value || null).optional();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30).refine((value) => {
    const digits = normalizePhone(value);
    return digits.length >= 8 && digits.length <= 15;
  }, "Telefone inválido."),
  email: z.union([z.email(), z.literal(""), z.null()]).optional().transform((value) => value || null),
  notes: optionalText,
  cpfCnpj: optionalText.refine((value) => {
    if (!value) return true;
    return [11, 14].includes(normalizeCpfCnpj(value)?.length ?? 0);
  }, "CPF/CNPJ deve possuir 11 ou 14 dígitos."),
  postalCode: optionalText,
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: z.union([z.string().trim().max(2), z.null()]).transform((value) => value ? value.toUpperCase() : null).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const duplicateCustomerSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.email(), z.literal(""), z.null()]).optional(),
  cpfCnpj: z.string().trim().max(30).optional(),
  excludeCustomerId: z.string().min(1).optional(),
}).refine((value) => Boolean(value.phone || value.email || value.cpfCnpj), {
  message: "Informe telefone, e-mail ou CPF/CNPJ.",
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type DuplicateCustomerInput = z.infer<typeof duplicateCustomerSchema>;
