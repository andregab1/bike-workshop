import type { FormEvent, ReactNode } from "react";
import styles from "./workspace.module.css";

export function PageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <header className={styles.header}><div><h1>{title}</h1><p>{description}</p></div>{children}</header>;
}

export function SearchInput({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (value: string) => void; onSubmit: () => void; placeholder: string }) {
  function submit(event: FormEvent) { event.preventDefault(); onSubmit(); }
  return <form className={styles.search} onSubmit={submit} role="search"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /><button className={styles.button}>Buscar</button></form>;
}

export function StatusBadge({ value }: { value: string }) {
  const labels: Record<string, string> = { OPEN: "Aberta", IN_PROGRESS: "Em serviço", READY: "Pronta", COMPLETED: "Concluída", CANCELLED: "Cancelada", PENDING: "Pendente", APPROVED: "Aprovado", PARTIALLY_APPROVED: "Parcial", REJECTED: "Recusado", OWNER: "Proprietário", MANAGER: "Gerente", MECHANIC: "Mecânico", ATTENDANT: "Atendente" };
  return <span className={styles.badge}>{labels[value] || value}</span>;
}

export function DataTable({ headings, children, empty }: { headings: string[]; children: ReactNode; empty?: boolean }) {
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{empty ? <tr><td className={styles.empty} colSpan={headings.length}>Nenhum registro encontrado.</td></tr> : children}</tbody></table></div>;
}

export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className={styles.empty}>Carregando…</div>;
  if (error) return <div className={styles.error} role="alert">{error}</div>;
  return null;
}

export { styles };
