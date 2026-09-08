const base = "http://127.0.0.1:3000";
const results = [];
const createdIds = [];
const runId = Date.now();

async function call(path, options = {}) {
  const response = await fetch(base + path, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data: body.data, error: body.error, code: body.code };
}

function record(id, title, expected, actual, passed, tags) {
  results.push({ id, title, expected, actual, status: passed ? "passed" : "failed", tags });
}

async function create(body, suffix) {
  const response = await call("/api/work-orders", { method: "POST", body: JSON.stringify({ ...body, legacyKey: `qa-matrix-${runId}-${suffix}` }) });
  if (!response.ok) throw new Error(`Fixture ${suffix}: ${response.status} ${response.error}`);
  createdIds.push(response.data.id);
  return response.data;
}

async function main() {
  const customers = (await call("/api/customers")).data;
  const inventory = (await call("/api/inventory")).data;
  const bikeId = customers[0].bikes[0].id;
  const serviceA = { name: "QA Regulagem", quantity: 1, unitPriceCents: 5000 };
  const serviceB = { name: "QA Inspeção", quantity: 1, unitPriceCents: 2500 };

  let order = await create({ bikeId, complaint: "QA MATRIX - fluxo principal", services: [serviceA] }, "main");
  let response = await call(`/api/work-orders/${order.id}`);
  record("OS-TC-001", "Criar e reler OS aberta", "HTTP 200, OPEN e total 5000", { http: response.status, status: response.data?.status, total: response.data?.totalCents }, response.status === 200 && response.data.status === "OPEN" && response.data.totalCents === 5000, ["happy_path", "persistence_refresh"]);

  response = await call(`/api/work-orders/${order.id}/start`, { method: "POST" });
  record("OS-TC-002", "Bloquear início sem aprovação", "409 QUOTE_NOT_APPROVED", { http: response.status, code: response.code }, response.status === 409 && response.code === "QUOTE_NOT_APPROVED", ["validation_negative", "state_transition"]);

  response = await call(`/api/work-orders/${order.id}/approve`, { method: "POST", body: JSON.stringify({ note: "QA aprovação" }) }); order = response.data;
  record("OS-TC-003", "Aprovar orçamento", "200 APPROVED persistido", { http: response.status, approval: order?.approvalStatus }, response.status === 200 && order.approvalStatus === "APPROVED", ["happy_path", "persistence_refresh"]);

  response = await call(`/api/work-orders/${order.id}/start`, { method: "POST" });
  record("OS-TC-004", "Bloquear início sem mecânico", "409 MECHANIC_REQUIRED", { http: response.status, code: response.code }, response.status === 409 && response.code === "MECHANIC_REQUIRED", ["validation_negative", "state_transition"]);

  await call(`/api/work-orders/${order.id}/assign`, { method: "POST", body: JSON.stringify({ mechanicName: "QA Mecânico" }) });
  response = await call(`/api/work-orders/${order.id}/start`, { method: "POST" }); order = response.data;
  record("OS-TC-005", "Iniciar com aprovação e mecânico", "200 IN_PROGRESS", { http: response.status, status: order?.status }, response.status === 200 && order.status === "IN_PROGRESS", ["happy_path", "state_transition"]);

  response = await call(`/api/work-orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ version: order.version, services: [serviceA, serviceB] }) }); order = response.data;
  const reset = order.approvalStatus === "PENDING";
  response = await call(`/api/work-orders/${order.id}/ready`, { method: "POST" });
  record("OS-TC-006", "Exigir nova aprovação após mudar orçamento em execução", "Aprovação volta a PENDING e READY é bloqueado", { approvalReset: reset, readyHttp: response.status, readyStatus: response.data?.status }, reset && response.status === 409, ["validation_negative", "state_transition", "data_integrity"]);

  if (response.ok) order = response.data; else order = (await call(`/api/work-orders/${order.id}`)).data;
  if (order.approvalStatus !== "APPROVED") order = (await call(`/api/work-orders/${order.id}/approve`, { method: "POST", body: JSON.stringify({ note: "QA aditivo aprovado" }) })).data;
  const readyResponses = await Promise.all([
    call(`/api/work-orders/${order.id}/ready`, { method: "POST" }),
    call(`/api/work-orders/${order.id}/ready`, { method: "POST" }),
  ]);
  order = (await call(`/api/work-orders/${order.id}`)).data;
  const stockActivities = order.activities.filter((item) => item.type === "STOCK_CONSUMED").length;
  record("OS-TC-007", "READY concorrente é idempotente", "Duas chamadas simultâneas retornam 200 e criam uma única baixa/atividade", { http: readyResponses.map((item) => item.status), activities: stockActivities, status: order.status }, readyResponses.every((item) => item.status === 200) && order.status === "READY" && stockActivities === 1, ["concurrency_idempotency", "regression"]);

  response = await call(`/api/work-orders/${order.id}/complete`, { method: "POST" });
  const completed = response.data;
  response = await call(`/api/work-orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ version: completed.version, diagnosis: "edição proibida" }) });
  record("OS-TC-008", "Bloquear edição após conclusão", "409 WORK_ORDER_LOCKED", { completed: completed.status, editHttp: response.status, code: response.code }, completed.status === "COMPLETED" && response.status === 409 && response.code === "WORK_ORDER_LOCKED", ["validation_negative", "state_transition"]);

  response = await call("/api/work-orders", { method: "POST", body: JSON.stringify({ bikeId, complaint: "QA MATRIX - bypass", services: [serviceA], initialStatus: "IN_PROGRESS", legacyKey: `qa-matrix-${runId}-bypass` }) });
  if (response.ok) createdIds.push(response.data.id);
  record("OS-TC-009", "Impedir criação direta em execução", "Rejeição ou criação forçada como OPEN", { http: response.status, status: response.data?.status }, !response.ok || response.data?.status === "OPEN", ["authorization", "state_transition", "security_privacy"]);

  let stale = await create({ bikeId, complaint: "QA MATRIX - snapshot obsoleto", services: [serviceA] }, "stale");
  const stalePayload = { version: stale.version, diagnosis: "resposta antiga", services: [serviceA] };
  await call(`/api/work-orders/${stale.id}`, { method: "PATCH", body: JSON.stringify({ version: stale.version, services: [serviceA, serviceB] }) });
  response = await call(`/api/work-orders/${stale.id}`, { method: "PATCH", body: JSON.stringify(stalePayload) });
  const fresh = (await call(`/api/work-orders/${stale.id}`)).data;
  record("OS-TC-010", "Rejeitar snapshot obsoleto", "409 conflito ou preservação dos 2 serviços", { stalePatchHttp: response.status, persistedServices: fresh.services.length }, response.status === 409 || fresh.services.length === 2, ["concurrency_idempotency", "data_integrity"]);

  response = await call("/api/work-orders", { method: "POST", body: JSON.stringify({ bikeId, complaint: "QA MATRIX - limite", services: [{ ...serviceA, quantity: 0 }] }) });
  record("OS-TC-011", "Rejeitar quantidade zero", "400 VALIDATION_ERROR", { http: response.status, code: response.code }, response.status === 400 && response.code === "VALIDATION_ERROR", ["boundary", "validation_negative"]);

  const item = inventory.find((candidate) => Number(candidate.quantity) >= 0);
  const beforeQuantity = Number(item.quantity);
  const itemName = item.customName || item.catalogPart?.name;
  let insufficient = await create({ bikeId, complaint: "QA MATRIX - estoque insuficiente", parts: [{ inventoryItemId: item.id, name: itemName, quantity: beforeQuantity + 1, unitPriceCents: item.salePriceCents }] }, "stock");
  await call(`/api/work-orders/${insufficient.id}/approve`, { method: "POST", body: "{}" });
  await call(`/api/work-orders/${insufficient.id}/assign`, { method: "POST", body: JSON.stringify({ mechanicName: "QA Mecânico" }) });
  await call(`/api/work-orders/${insufficient.id}/start`, { method: "POST" });
  response = await call(`/api/work-orders/${insufficient.id}/ready`, { method: "POST" });
  const afterOrder = (await call(`/api/work-orders/${insufficient.id}`)).data;
  const afterItem = (await call("/api/inventory")).data.find((candidate) => candidate.id === item.id);
  record("OS-TC-012", "Rollback com estoque insuficiente", "409, status IN_PROGRESS e saldo inalterado", { http: response.status, code: response.code, status: afterOrder.status, beforeQuantity, afterQuantity: Number(afterItem.quantity) }, response.status === 409 && response.code === "INSUFFICIENT_STOCK" && afterOrder.status === "IN_PROGRESS" && Number(afterItem.quantity) === beforeQuantity, ["validation_negative", "persistence_refresh", "recovery", "data_integrity"]);

  response = await call("/api/work-orders/id-inexistente");
  record("OS-TC-013", "Consultar OS inexistente", "404 WORK_ORDER_NOT_FOUND", { http: response.status, code: response.code }, response.status === 404 && response.code === "WORK_ORDER_NOT_FOUND", ["validation_negative", "security_privacy"]);

  response = await call(`/api/work-orders/${stale.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "QA cancelamento aberto" }) });
  const cancelled = response.data;
  record("OS-TC-014", "Cancelar OS aberta", "Transição para CANCELLED com auditoria", { http: response.status, status: cancelled?.status, activity: cancelled?.activities[0]?.type }, response.ok && cancelled.status === "CANCELLED" && cancelled.activities[0].type === "CANCELLED", ["happy_path", "state_transition", "persistence_refresh"]);

  const cancelEvents = cancelled.activities.filter((activity) => activity.type === "CANCELLED").length;
  response = await call(`/api/work-orders/${stale.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "QA repetição" }) });
  record("OS-TC-015", "Cancelamento repetido é idempotente", "Permanece cancelada e não duplica atividade", { http: response.status, status: response.data?.status, before: cancelEvents, after: response.data?.activities.filter((activity) => activity.type === "CANCELLED").length }, response.ok && response.data.status === "CANCELLED" && response.data.activities.filter((activity) => activity.type === "CANCELLED").length === cancelEvents, ["concurrency_idempotency", "state_transition"]);

  response = await call(`/api/work-orders/${completed.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "QA tentativa após conclusão" }) });
  record("OS-TC-016", "Bloquear cancelamento após conclusão", "409 INVALID_TRANSITION", { http: response.status, code: response.code }, response.status === 409 && response.code === "INVALID_TRANSITION", ["validation_negative", "state_transition"]);

  response = await call(`/api/work-orders/${createdIds[1]}/cancel`, { method: "POST", body: JSON.stringify({ reason: "" }) });
  record("OS-TC-017", "Exigir motivo do cancelamento", "400 VALIDATION_ERROR", { http: response.status, code: response.code }, response.status === 400 && response.code === "VALIDATION_ERROR", ["validation_negative", "boundary"]);

  const stockItem = inventory.find((candidate) => Number(candidate.quantity) >= 1);
  const stockBeforeCancel = Number(stockItem.quantity); const stockName = stockItem.customName || stockItem.catalogPart?.name;
  let readyCancel = await create({ bikeId, complaint: "QA MATRIX - cancelar pronta", parts: [{ inventoryItemId: stockItem.id, name: stockName, quantity: 1, unitPriceCents: stockItem.salePriceCents }] }, "cancel-ready");
  await call(`/api/work-orders/${readyCancel.id}/approve`, { method: "POST", body: "{}" }); await call(`/api/work-orders/${readyCancel.id}/assign`, { method: "POST", body: JSON.stringify({ mechanicName: "QA Mecânico" }) }); await call(`/api/work-orders/${readyCancel.id}/start`, { method: "POST" }); await call(`/api/work-orders/${readyCancel.id}/ready`, { method: "POST" });
  response = await call(`/api/work-orders/${readyCancel.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "QA cancelamento com reversão" }) });
  const stockAfterCancel = Number((await call("/api/inventory")).data.find((candidate) => candidate.id === stockItem.id).quantity);
  record("OS-TC-018", "Cancelar OS pronta restaura estoque", "CANCELLED, stockConsumed=false e saldo restaurado", { http: response.status, status: response.data?.status, stockConsumed: response.data?.stockConsumed, stockBeforeCancel, stockAfterCancel }, response.ok && response.data.status === "CANCELLED" && !response.data.stockConsumed && stockAfterCancel === stockBeforeCancel, ["happy_path", "recovery", "data_integrity", "persistence_refresh"]);

  let deadlineOrder = await create({ bikeId, complaint: "QA MATRIX - prazo estruturado", expectedDate: "2026-09-15", expectedNote: "Retirada após as 14h" }, "deadline");
  response = await call(`/api/work-orders/${deadlineOrder.id}`);
  deadlineOrder = response.data;
  record("OS-TC-019", "Persistir data e observação de prazo separadas", "Data 2026-09-15 e observação preservadas após leitura fresca", { http: response.status, expectedDate: deadlineOrder?.expectedDate?.slice(0, 10), expectedNote: deadlineOrder?.expectedNote }, response.status === 200 && deadlineOrder.expectedDate.slice(0, 10) === "2026-09-15" && deadlineOrder.expectedNote === "Retirada após as 14h", ["happy_path", "persistence_refresh", "time"]);

  response = await call(`/api/work-orders/${deadlineOrder.id}`, { method: "PATCH", body: JSON.stringify({ version: deadlineOrder.version, expectedDate: null, expectedNote: null }) });
  const clearedDeadline = (await call(`/api/work-orders/${deadlineOrder.id}`)).data;
  record("OS-TC-020", "Limpar data e observação de prazo", "Campos nulos após atualização e leitura fresca", { http: response.status, expectedDate: clearedDeadline?.expectedDate, expectedNote: clearedDeadline?.expectedNote }, response.status === 200 && clearedDeadline.expectedDate === null && clearedDeadline.expectedNote === null, ["boundary", "persistence_refresh", "time"]);

  response = await call("/api/work-orders", { method: "POST", body: JSON.stringify({ bikeId, complaint: "QA MATRIX - data inválida", expectedDate: "2026-02-30" }) });
  record("OS-TC-021", "Rejeitar data de calendário inválida", "400 VALIDATION_ERROR", { http: response.status, code: response.code }, response.status === 400 && response.code === "VALIDATION_ERROR", ["validation_negative", "boundary", "time"]);

  console.log(JSON.stringify({ runId, createdIds, results, counts: { passed: results.filter((item) => item.status === "passed").length, failed: results.filter((item) => item.status === "failed").length } }, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ runId, createdIds, fatal: error.message }, null, 2)); process.exit(1); });
