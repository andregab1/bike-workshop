import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { WorkOrderAttachmentType } from "@/generated/prisma/enums";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/shared/auth/permissions";
import { DomainError } from "@/shared/http/errors";

const storageRoot = path.join(process.cwd(), "storage", "work-order-attachments");
const maxSizeBytes = 10 * 1024 * 1024;
const signatures = [
  { mime: "image/jpeg", extension: "jpg", matches: (data: Uint8Array) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { mime: "image/png", extension: "png", matches: (data: Uint8Array) => data.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]) },
  { mime: "image/webp", extension: "webp", matches: (data: Uint8Array) => new TextDecoder().decode(data.slice(0, 4)) === "RIFF" && new TextDecoder().decode(data.slice(8, 12)) === "WEBP" },
  { mime: "application/pdf", extension: "pdf", matches: (data: Uint8Array) => new TextDecoder().decode(data.slice(0, 5)) === "%PDF-" },
] as const;

function identify(data: Uint8Array) { return signatures.find((signature) => signature.matches(data)); }

export const workOrderAttachmentService = {
  async create(context: RequestContext, workOrderId: string, input: { file: File; type: WorkOrderAttachmentType; description?: string }) {
    requirePermission(context, "MANAGE_WORK_ORDERS");
    const order = await prisma.workOrder.findFirst({ where: { id: workOrderId, workshopId: context.workshopId }, select: { id: true, status: true } });
    if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
    if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new DomainError("Não é possível anexar arquivos a uma OS encerrada.", 409, "WORK_ORDER_LOCKED");
    if (!input.file.size || input.file.size > maxSizeBytes) throw new DomainError("O arquivo deve ter até 10 MB.", 400, "INVALID_ATTACHMENT_SIZE");
    const bytes = new Uint8Array(await input.file.arrayBuffer()); const identified = identify(bytes);
    if (!identified) throw new DomainError("Envie uma imagem JPG, PNG, WebP ou um PDF válido.", 400, "INVALID_ATTACHMENT_TYPE");
    const storageKey = `${context.workshopId}/${workOrderId}/${randomUUID()}.${identified.extension}`;
    const absolute = path.join(storageRoot, storageKey); await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, bytes, { flag: "wx" });
    return prisma.$transaction(async (tx) => {
      const attachment = await tx.workOrderAttachment.create({ data: { workOrderId, type: input.type, storageKey, fileName: path.basename(input.file.name).slice(0, 180) || `anexo.${identified.extension}`, mimeType: identified.mime, sizeBytes: bytes.length, description: input.description, createdById: context.userId } });
      await tx.workOrderActivity.create({ data: { workOrderId, workshopId: context.workshopId, actorMemberId: context.memberId, createdById: context.userId, type: "ATTACHMENT_ADDED", title: "Anexo adicionado", description: attachment.fileName, metadata: { attachmentId: attachment.id, type: attachment.type, sizeBytes: attachment.sizeBytes } } });
      return attachment;
    });
  },

  async read(context: RequestContext, workOrderId: string, attachmentId: string) {
    const attachment = await prisma.workOrderAttachment.findFirst({ where: { id: attachmentId, workOrderId, workOrder: { workshopId: context.workshopId } } });
    if (!attachment) throw new DomainError("Anexo não encontrado.", 404, "ATTACHMENT_NOT_FOUND");
    return { attachment, bytes: await readFile(path.join(storageRoot, attachment.storageKey)) };
  },
};
