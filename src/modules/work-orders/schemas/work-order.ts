import { z } from "zod";

const optionalText = z.string().trim().max(2000).transform((value) => value || undefined).optional();
const optionalNullableText = z.string().trim().max(2000).nullable().optional();
const optionalDate = z.iso.date().nullable().optional();
const quantity = z.number().positive().max(100_000);

export const workOrderServiceLineSchema = z.object({
  serviceCatalogItemId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  quantity,
  unitPriceCents: z.int().min(0).max(100_000_000),
  discountCents: z.int().min(0).max(100_000_000).default(0),
  surchargeCents: z.int().min(0).max(100_000_000).default(0),
  performedById: z.string().min(1).optional(),
});

export const workOrderPartLineSchema = z.object({
  inventoryItemId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  quantity,
  unitPriceCents: z.int().min(0).max(100_000_000),
  discountCents: z.int().min(0).max(100_000_000).default(0),
  surchargeCents: z.int().min(0).max(100_000_000).default(0),
});

const checklistItemSchema = z.object({
  id: z.string().min(1), label: z.string().min(1).max(300),
  result: z.enum(["", "OK", "ATTENTION", "REPLACE", "NOT_APPLICABLE"]).default(""),
  notes: z.string().max(1000).default(""),
});

export const checklistSnapshotSchema = z.object({
  name: z.string().min(1).max(160), items: z.array(checklistItemSchema).max(300),
}).nullable();

export const createWorkOrderSchema = z.object({
  bikeId: z.string().min(1), complaint: z.string().trim().min(2).max(4000),
  diagnosis: z.string().max(4000).default(""), expectedDate: optionalDate, expectedNote: optionalText,
  services: z.array(workOrderServiceLineSchema).max(200).default([]),
  parts: z.array(workOrderPartLineSchema).max(200).default([]),
  checklist: checklistSnapshotSchema.optional(),
});

export const updateWorkOrderSchema = z.object({
  version: z.int().positive(),
  changeReason: z.string().trim().min(3).max(500).optional(),
  diagnosis: z.string().max(4000).optional(), expectedDate: optionalDate, expectedNote: optionalNullableText,
  services: z.array(workOrderServiceLineSchema).max(200).optional(),
  parts: z.array(workOrderPartLineSchema).max(200).optional(),
  checklist: checklistSnapshotSchema.optional(),
});

export const assignMechanicSchema = z.object({ mechanicId: z.string().min(1) });
export const diagnosisCommandSchema = z.object({ diagnosis: z.string().trim().max(4000), recommendations: z.string().trim().max(4000).nullable().optional(), technicalNotes: z.string().trim().max(4000).nullable().optional() });
export const workOrderPlanningSchema = z.object({ priority: z.enum(["NORMAL", "URGENT", "WARRANTY_RETURN"]).optional(), expectedDate: optionalDate, expectedNote: optionalNullableText, reason: z.string().trim().min(3).max(500) });
export const workOrderLineStatusSchema = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), notes: z.string().trim().max(1000).optional() });
export const addWorkOrderServiceSchema = z.object({ serviceCatalogItemId: z.string().min(1), quantity: quantity.default(1), performedById: z.string().min(1).nullable().optional() });
export const addWorkOrderPartSchema = z.object({ inventoryItemId: z.string().min(1), quantity: quantity.default(1) });
export const updateWorkOrderLineSchema = z.object({
  quantity,
  discountCents: z.int().min(0).max(100_000_000).default(0),
  reason: z.string().trim().min(3).max(500),
  performedById: z.string().min(1).nullable().optional(),
});
export const workOrderDiscountSchema = z.object({
  version: z.int().positive(),
  type: z.enum(["FIXED", "PERCENT"]),
  value: z.string().trim().regex(/^\d+(?:[.,]\d{1,4})?$/, "Informe um desconto válido."),
  reason: z.string().trim().min(3).max(500),
});
export const quoteCreateSchema = z.object({ validUntil: z.iso.date().nullable().optional(), kind: z.enum(["BASE", "ADDITIONAL"]).default("BASE") });
export const quoteDecisionSchema = z.object({ note: z.string().trim().max(1000).transform((value) => value || undefined).optional(), channel: z.enum(["IN_PERSON", "WHATSAPP", "PHONE", "EMAIL", "OTHER"]).default("IN_PERSON"), approvedByName: z.string().trim().max(120).optional(), evidence: z.string().trim().max(1000).optional(), validUntil: z.iso.date().nullable().optional(), serviceLineIds: z.array(z.string().min(1)).max(200).optional(), partLineIds: z.array(z.string().min(1)).max(200).optional() });
export const quoteDecisionCommandSchema = quoteDecisionSchema.extend({ quoteId: z.string().min(1), decision: z.enum(["APPROVED", "REJECTED"]) });
export const applyWorkOrderChecklistSchema = z.object({ templateId: z.string().min(1), type: z.enum(["ENTRY", "TECHNICAL", "DELIVERY"]), required: z.boolean().default(false) });
export const checklistResultSchema = z.object({ result: z.enum(["PENDING", "OK", "ATTENTION", "REJECTED", "NOT_APPLICABLE"]), notes: z.string().trim().max(1000).nullable().optional() });
export const pauseExecutionSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
export const customerContactSchema = z.object({ channel: z.literal("WHATSAPP"), message: z.string().trim().min(1).max(4000) });
export const cancelWorkOrderSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
export const reopenCompletedWorkOrderSchema = z.object({ reason: z.string().trim().min(5).max(1000) });
export const completeWorkOrderSchema = z.object({ pickedUpByName: z.string().trim().min(2).max(120), documentNumber: z.string().trim().max(40).optional(), relationship: z.string().trim().max(80).optional(), notes: z.string().trim().max(1000).optional(), accepted: z.literal(true), paymentStatus: z.enum(["PENDING", "PAID", "WAIVED"]).default("PENDING") });
export const workOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["OPEN", "IN_PROGRESS", "READY", "COMPLETED", "CANCELLED"]).optional(), mechanicId: z.string().min(1).optional(), search: z.string().trim().max(120).optional(),
  sort: z.enum(["number_desc", "number_asc", "updated_desc", "expected_asc"]).default("number_desc"), late: z.enum(["true", "false"]).optional(),
  includeRejected: z.enum(["true", "false"]).default("false"),
});
export const workOrderHistoryQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) });

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
