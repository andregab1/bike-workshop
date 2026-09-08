DELETE FROM inventory_movements
WHERE "workOrderId" IN (
  SELECT id FROM work_orders WHERE "legacyKey" LIKE 'qa-matrix-%'
);

DELETE FROM work_orders WHERE "legacyKey" LIKE 'qa-matrix-%';
