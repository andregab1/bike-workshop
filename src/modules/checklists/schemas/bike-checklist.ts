import { z } from "zod";
export const normalizeChecklistLabel = (label: string) => label.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const itemSchema = z.object({ label: z.string().trim().min(1, "O item não pode ficar vazio.").max(300), checked: z.boolean().default(false) });
export const bikeChecklistInputSchema = z.object({
  customerId: z.string().min(1, "Selecione o cliente."),
  bikeId: z.string().min(1, "Selecione a bicicleta."),
  title: z.string().trim().min(2).max(120).default("Checklist da bicicleta"),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item.").max(200),
});
export type BikeChecklistInput = z.infer<typeof bikeChecklistInputSchema>;
