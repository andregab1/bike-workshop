"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./workspace.module.css";

const links = [
  ["/dashboard", "Dashboard"],
  ["/clientes", "Clientes"],
  ["/bicicletas", "Bicicletas"],
  ["/ordens-servico", "Ordens de serviço"],
  ["/estoque", "Estoque"],
  ["/orcamentos", "Orçamentos"],
  ["/mecanicos", "Mecânicos"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={styles.shell}><aside className={styles.sidebar}><h2 className={styles.brand}>BikeFlow</h2><nav className={styles.nav} aria-label="Navegação principal">{links.map(([href, label]) => <Link key={href} href={href} className={pathname === href ? styles.active : undefined}>{label}</Link>)}<Link className={styles.legacy} href="/">Módulo completo</Link></nav></aside><section className={styles.content}>{children}</section></div>;
}
