-- Expand movement metadata without rewriting existing ledger rows.
CREATE TYPE "ManualStockExitReason" AS ENUM ('USO_INTERNO', 'PERDA', 'DANO', 'DEVOLUCAO', 'OUTRO');

ALTER TABLE "inventory_movements"
ADD COLUMN "manualExitReason" "ManualStockExitReason";

-- Database invariants protect every writer, including future jobs and scripts.
ALTER TABLE "inventory_items"
ADD CONSTRAINT "inventory_reserved_nonnegative" CHECK ("reservedQuantity" >= 0),
ADD CONSTRAINT "inventory_reserved_not_over_physical" CHECK ("reservedQuantity" <= "quantity");

ALTER TABLE "inventory_movements"
ADD CONSTRAINT "inventory_movement_unit_cost_nonnegative" CHECK ("unitCostCents" IS NULL OR "unitCostCents" >= 0);

ALTER TABLE "inventory_reservations"
ADD CONSTRAINT "inventory_reservation_quantity_positive" CHECK ("quantity" > 0);
