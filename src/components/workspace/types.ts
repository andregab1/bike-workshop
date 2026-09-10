export type DashboardData = {
  statuses: Record<string, number>;
  overdue: number;
  awaitingApproval: number;
  criticalStock: number;
  mechanics: Array<{ memberId: string; name: string; inProgress: number }>;
};

export type Bike = {
  id: string;
  brand: string;
  model: string;
  color?: string | null;
  serialNumber?: string | null;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  cpfCnpj?: string | null;
  active: boolean;
  bikes: Bike[];
};

export type WorkOrder = {
  id: string;
  number: number;
  status: string;
  approvalStatus: string;
  expectedDate?: string | null;
  totalCents: number;
  assignedMechanicName?: string | null;
  customerSnapshotData?: { name?: string } | null;
  bikeSnapshotData?: { brand?: string; model?: string } | null;
  bike: { brand: string; model: string; customer: { name: string } };
};

export type WorkOrderPage = { items: WorkOrder[]; total: number };

export type InventoryItem = {
  id: string;
  customName?: string | null;
  sku?: string | null;
  physicalQuantity: string | number;
  reservedQuantity: string | number;
  availableQuantity: string | number;
  minimumQuantity: string | number;
  salePriceCents: number;
  catalogPart?: { name: string } | null;
  brand?: { name: string } | null;
};

export type InventoryPage = {
  items: InventoryItem[];
  summary: { registered: number; available: number; reorder: number; totalCostCents: number };
};

export type TeamMember = {
  id: string;
  role: string;
  active: boolean;
  user: { name: string; email: string };
};
