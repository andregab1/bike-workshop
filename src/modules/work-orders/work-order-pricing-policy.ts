type ServiceLine = { serviceCatalogItemId?: string; name: string; unitPriceCents: number; discountCents: number; surchargeCents: number };
type PartLine = { inventoryItemId: string; name: string; unitPriceCents: number; discountCents: number; surchargeCents: number };

export function workOrderSensitiveChanges(
  services: ServiceLine[], currentServices: ServiceLine[], parts: PartLine[], currentParts: PartLine[],
  servicePrices: ReadonlyMap<string, number>, partPrices: ReadonlyMap<string, number>,
) {
  const serviceBaseline = (line: ServiceLine) => currentServices.find((current) => current.serviceCatalogItemId === line.serviceCatalogItemId && current.name === line.name);
  const partBaseline = (line: PartLine) => currentParts.find((current) => current.inventoryItemId === line.inventoryItemId && current.name === line.name);
  const pricingChanged = services.some((line) => { const existing = serviceBaseline(line); const baseline = existing?.unitPriceCents ?? (line.serviceCatalogItemId ? servicePrices.get(line.serviceCatalogItemId) : undefined); return baseline !== undefined && line.unitPriceCents !== baseline; })
    || parts.some((line) => { const existing = partBaseline(line); return line.unitPriceCents !== (existing?.unitPriceCents ?? partPrices.get(line.inventoryItemId)); });
  const adjustmentsChanged = services.some((line) => { const existing = serviceBaseline(line); return line.discountCents !== (existing?.discountCents ?? 0) || line.surchargeCents !== (existing?.surchargeCents ?? 0); })
    || parts.some((line) => { const existing = partBaseline(line); return line.discountCents !== (existing?.discountCents ?? 0) || line.surchargeCents !== (existing?.surchargeCents ?? 0); });
  return { pricingChanged, adjustmentsChanged };
}
