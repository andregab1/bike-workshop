export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLocaleLowerCase("pt-BR");
  return normalized || null;
}

export function normalizeCpfCnpj(value?: string | null) {
  const normalized = value?.replace(/\D/g, "");
  return normalized || null;
}
