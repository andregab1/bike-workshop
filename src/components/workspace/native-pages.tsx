"use client";

import { useEffect, useState } from "react";
import { getApiData } from "@/lib/api/client";
import type { Customer, DashboardData, InventoryPage, TeamMember, WorkOrderPage } from "./types";
import { DataTable, LoadState, PageHeader, SearchInput, StatusBadge, styles } from "./ui";

function useRemoteData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    getApiData<T>(path).then((result) => { if (active) setData(result); }).catch((caught: Error) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [path]);
  return { data, error, loading: !data && !error };
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function displayDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value)) : "—";
}

export function DashboardPage() {
  const state = useRemoteData<DashboardData>("/api/dashboard");
  return <><PageHeader title="Dashboard" description="Visão operacional da oficina." /><LoadState {...state} />{state.data && <><div className={styles.cards}><div className={styles.card}><span>OS abertas</span><strong>{state.data.statuses.OPEN || 0}</strong></div><div className={styles.card}><span>Em serviço</span><strong>{state.data.statuses.IN_PROGRESS || 0}</strong></div><div className={styles.card}><span>Aguardando aprovação</span><strong>{state.data.awaitingApproval}</strong></div><div className={styles.card}><span>Estoque crítico</span><strong>{state.data.criticalStock}</strong></div><div className={styles.card}><span>Em atraso</span><strong>{state.data.overdue}</strong></div></div><DataTable headings={["Mecânico", "OS em serviço"]} empty={!state.data.mechanics.length}>{state.data.mechanics.map((mechanic) => <tr key={mechanic.memberId}><td>{mechanic.name}</td><td>{mechanic.inProgress}</td></tr>)}</DataTable></>}</>;
}

export function CustomersPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const state = useRemoteData<Customer[]>(`/api/customers?active=all${query ? `&q=${encodeURIComponent(query)}` : ""}`);
  return <><PageHeader title="Clientes" description="Busca por nome, telefone, e-mail, CPF ou CNPJ."><SearchInput value={input} onChange={setInput} onSubmit={() => setQuery(input.trim())} placeholder="Buscar cliente" /></PageHeader><LoadState {...state} />{state.data && <DataTable headings={["Nome", "Telefone", "E-mail", "Documento", "Bicicletas", "Situação"]} empty={!state.data.length}>{state.data.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.phone}</td><td>{customer.email || "—"}</td><td>{customer.cpfCnpj || "—"}</td><td>{customer.bikes.length}</td><td><StatusBadge value={customer.active ? "Ativo" : "Arquivado"} /></td></tr>)}</DataTable>}</>;
}

export function BikesPage() {
  const state = useRemoteData<Customer[]>("/api/customers?active=all");
  const bikes = state.data?.flatMap((customer) => customer.bikes.map((bike) => ({ ...bike, customerName: customer.name }))) || [];
  return <><PageHeader title="Bicicletas" description="Cadastro técnico vinculado aos clientes." /><LoadState {...state} />{state.data && <DataTable headings={["Bicicleta", "Cliente", "Cor", "Número de série", "Situação"]} empty={!bikes.length}>{bikes.map((bike) => <tr key={bike.id}><td><strong>{bike.brand} {bike.model}</strong></td><td>{bike.customerName}</td><td>{bike.color || "—"}</td><td>{bike.serialNumber || "—"}</td><td><StatusBadge value={bike.active ? "Ativa" : "Arquivada"} /></td></tr>)}</DataTable>}</>;
}

export function WorkOrdersPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const state = useRemoteData<WorkOrderPage>(`/api/work-orders?pageSize=100${query ? `&search=${encodeURIComponent(query)}` : ""}`);
  return <><PageHeader title="Ordens de serviço" description="Acompanhamento de execução, prazo e responsável."><SearchInput value={input} onChange={setInput} onSubmit={() => setQuery(input.trim())} placeholder="OS, cliente ou bicicleta" /></PageHeader><LoadState {...state} />{state.data && <DataTable headings={["OS", "Cliente", "Bicicleta", "Status", "Previsão", "Responsável", "Total"]} empty={!state.data.items.length}>{state.data.items.map((order) => <tr key={order.id}><td>#{order.number}</td><td>{order.customerSnapshotData?.name || order.bike.customer.name}</td><td>{[order.bikeSnapshotData?.brand || order.bike.brand, order.bikeSnapshotData?.model || order.bike.model].join(" ")}</td><td><StatusBadge value={order.status} /></td><td>{displayDate(order.expectedDate)}</td><td>{order.assignedMechanicName || "Não atribuído"}</td><td>{money(order.totalCents)}</td></tr>)}</DataTable>}</>;
}

export function InventoryPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const state = useRemoteData<InventoryPage>(`/api/inventory?size=100${query ? `&search=${encodeURIComponent(query)}` : ""}`);
  return <><PageHeader title="Estoque" description="Estoque físico, reservado e disponível separados."><SearchInput value={input} onChange={setInput} onSubmit={() => setQuery(input.trim())} placeholder="Nome, SKU ou localização" /></PageHeader><LoadState {...state} />{state.data && <><div className={styles.cards}><div className={styles.card}><span>Itens cadastrados</span><strong>{state.data.summary.registered}</strong></div><div className={styles.card}><span>Unidades disponíveis</span><strong>{state.data.summary.available}</strong></div><div className={styles.card}><span>Precisam de reposição</span><strong>{state.data.summary.reorder}</strong></div></div><DataTable headings={["Peça", "SKU", "Físico", "Reservado", "Disponível", "Mínimo", "Venda"]} empty={!state.data.items.length}>{state.data.items.map((item) => <tr key={item.id}><td><strong>{item.customName || item.catalogPart?.name || "Peça"}</strong><br /><span className={styles.muted}>{item.brand?.name || "Sem marca"}</span></td><td>{item.sku || "—"}</td><td>{String(item.physicalQuantity)}</td><td>{String(item.reservedQuantity)}</td><td>{String(item.availableQuantity)}</td><td>{String(item.minimumQuantity)}</td><td>{money(item.salePriceCents)}</td></tr>)}</DataTable></>}</>;
}

export function QuotesPage() {
  const state = useRemoteData<WorkOrderPage>("/api/work-orders?pageSize=100&includeRejected=true");
  return <><PageHeader title="Orçamentos" description="Situação comercial das ordens de serviço." /><LoadState {...state} />{state.data && <DataTable headings={["OS", "Cliente", "Aprovação", "Status da OS", "Valor"]} empty={!state.data.items.length}>{state.data.items.map((order) => <tr key={order.id}><td>#{order.number}</td><td>{order.customerSnapshotData?.name || order.bike.customer.name}</td><td><StatusBadge value={order.approvalStatus} /></td><td><StatusBadge value={order.status} /></td><td>{money(order.totalCents)}</td></tr>)}</DataTable>}</>;
}

export function MechanicsPage() {
  const state = useRemoteData<TeamMember[]>("/api/team");
  const members = state.data?.filter((member) => ["OWNER", "MANAGER", "MECHANIC"].includes(member.role)) || [];
  return <><PageHeader title="Mecânicos" description="Equipe com acesso operacional à oficina." /><LoadState {...state} />{state.data && <DataTable headings={["Nome", "E-mail", "Cargo", "Situação"]} empty={!members.length}>{members.map((member) => <tr key={member.id}><td>{member.user.name}</td><td>{member.user.email}</td><td><StatusBadge value={member.role} /></td><td>{member.active ? "Ativo" : "Inativo"}</td></tr>)}</DataTable>}</>;
}
