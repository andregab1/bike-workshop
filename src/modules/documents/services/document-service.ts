import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";

import type { DocumentType } from "@/generated/prisma/enums";
import type { RequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/shared/http/errors";

const storageRoot = path.join(process.cwd(), "storage", "documents");
const safeText = (value: unknown) => String(value ?? "").replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\xFF]/g, "");

async function renderPdf(type: DocumentType, order: Awaited<ReturnType<typeof loadOrder>>) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595.28, 841.89]); const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 800; const draw = (text: string, size = 10, strong = false) => { page.drawText(safeText(text), { x: 42, y, size, font: strong ? bold : font }); y -= size + 8; };
  draw(order.workshop.legalName || order.workshop.name, 16, true); draw(type === "QUOTE" ? `ORÇAMENTO - OS #${order.number}` : type === "PICKUP_RECEIPT" ? `COMPROVANTE DE RETIRADA - OS #${order.number}` : `ORDEM DE SERVIÇO #${order.number}`, 14, true);
  draw(`Cliente: ${order.customerSnapshot.name}`); draw(`Telefone: ${order.customerSnapshot.phone}`); draw(`Bicicleta: ${order.bike.brand} ${order.bike.model}`); draw(`Problema relatado: ${order.complaint}`); y -= 8;
  draw("Serviços", 12, true); for (const line of order.services) draw(`${line.nameSnapshot} | ${line.quantity} x R$ ${(line.unitPriceCents / 100).toFixed(2)} | R$ ${(line.totalCents / 100).toFixed(2)}`);
  draw("Peças", 12, true); for (const line of order.parts) draw(`${line.nameSnapshot} | ${line.quantity} x R$ ${(line.unitPriceCents / 100).toFixed(2)} | R$ ${(line.totalCents / 100).toFixed(2)}`);
  y -= 8; draw(`Total: R$ ${(order.totalCents / 100).toFixed(2)}`, 13, true);
  const pickup = order.pickups[0]; if (type === "PICKUP_RECEIPT" && pickup) { draw(`Retirado por: ${pickup.pickedUpByName}`); draw(`Data: ${pickup.pickedUpAt.toLocaleString("pt-BR")}`); draw(`Aceite: ${pickup.accepted ? "Sim" : "Não"}`); }
  if (order.workshop.terms) { y -= 12; draw("Termos", 11, true); draw(order.workshop.terms.slice(0, 1000), 9); }
  return pdf.save();
}

async function loadOrder(context: RequestContext, workOrderId: string) {
  const order = await prisma.workOrder.findFirst({ where: { id: workOrderId, workshopId: context.workshopId }, include: { workshop: true, bike: true, customerSnapshot: true, services: true, parts: true, pickups: { orderBy: { pickedUpAt: "desc" }, take: 1 } } });
  if (!order) throw new DomainError("Ordem de serviço não encontrada.", 404, "WORK_ORDER_NOT_FOUND");
  return order;
}

export const documentService = {
  async generate(context: RequestContext, workOrderId: string, type: DocumentType) {
    const order = await loadOrder(context, workOrderId);
    if (type === "PICKUP_RECEIPT" && !order.pickups.length) throw new DomainError("Conclua a retirada antes de gerar o comprovante.", 409, "PICKUP_REQUIRED");
    const bytes = await renderPdf(type, order); const hash = createHash("sha256").update(bytes).digest("hex");
    const latest = await prisma.generatedDocument.aggregate({ where: { workOrderId, type }, _max: { version: true } }); const version = (latest._max.version || 0) + 1;
    const storageKey = `${context.workshopId}/${workOrderId}/${type.toLowerCase()}-v${version}-${randomUUID()}.pdf`; const absolute = path.join(storageRoot, storageKey);
    await mkdir(path.dirname(absolute), { recursive: true }); await writeFile(absolute, bytes);
    return prisma.generatedDocument.create({ data: { workshopId: context.workshopId, workOrderId, type, version, storageKey, contentHash: hash, createdById: context.userId } });
  },
  async read(context: RequestContext, id: string) {
    const document = await prisma.generatedDocument.findFirst({ where: { id, workshopId: context.workshopId } });
    if (!document) throw new DomainError("Documento não encontrado.", 404, "DOCUMENT_NOT_FOUND");
    return { document, bytes: await readFile(path.join(storageRoot, document.storageKey)) };
  },
};
