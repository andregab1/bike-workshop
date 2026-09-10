"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Me = { user: { id: string; name: string; email: string; activeWorkshopId?: string | null }; memberships: Array<{ id: string; role: string; workshop: { id: string; name: string; slug: string } }> };
async function loadMe(): Promise<Me | null> { const response = await fetch("/api/me", { cache: "no-store" }); return (await response.json()).data; }

export function BikeFlowGate({ children }: { children?: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [bootstrap, setBootstrap] = useState<{ registrationOpen: boolean; workshopConfigured: boolean } | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login"); const [error, setError] = useState("");
  useEffect(() => { if (session) void loadMe().then(setMe); }, [session]);
  useEffect(() => { void fetch("/api/auth/bootstrap-status", { cache: "no-store" }).then((response) => response.json()).then((body) => setBootstrap(body.data)); }, [session]);
  async function authenticate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); const email = String(data.get("email")); const password = String(data.get("password")); const result = mode === "login" ? await authClient.signIn.email({ email, password }) : await authClient.signUp.email({ name: String(data.get("name")), email, password }); if (result.error) setError(result.error.message || "Não foi possível autenticar."); }
  async function createWorkshop(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); const response = await fetch("/api/workshops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), slug: data.get("slug") }) }); const body = await response.json(); if (!response.ok) return setError(body.error || "Não foi possível criar oficina."); setMe(await loadMe()); }
  if (isPending || !bootstrap || (session && !me)) return <main className="auth-shell"><p>Carregando BikeFlow…</p></main>;
  if (!session) return <main className="auth-shell"><form className="auth-card" onSubmit={authenticate}><h1>BikeFlow</h1><p>Bancada digital da oficina.</p>{mode === "signup" && <label>Nome<input name="name" required minLength={2} autoComplete="name" /></label>}<label>E-mail<input name="email" type="email" required autoComplete="email" /></label><label>Senha<input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit">{mode === "login" ? "Entrar" : "Criar conta"}</button>{bootstrap.registrationOpen && <button type="button" className="link-button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Criar primeira conta" : "Já tenho conta"}</button>}{!bootstrap.registrationOpen && mode === "login" && <p>Acesso restrito à equipe da oficina.</p>}</form></main>;
  if (!me?.memberships.length && bootstrap.workshopConfigured) return <main className="auth-shell"><div className="auth-card"><h1>Acesso desativado</h1><p>Seu usuário não possui acesso ativo à oficina. Procure o responsável.</p><button type="button" onClick={() => void authClient.signOut()}>Sair</button></div></main>;
  if (!me?.memberships.length) return <main className="auth-shell"><form className="auth-card" onSubmit={createWorkshop}><h1>Configurar oficina</h1><label>Nome<input name="name" required minLength={2} /></label><label>Identificador<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="pedal-forte" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit">Criar oficina</button></form></main>;
  async function switchWorkshop(workshopId: string) { await fetch("/api/workshops/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workshopId }) }); window.location.reload(); }
  const activeWorkshopId = me.memberships.some((membership) => membership.workshop.id === me.user.activeWorkshopId)
    ? me.user.activeWorkshopId
    : me.memberships[0].workshop.id;
  return <main className={children ? "native-root" : "prototype-shell"}><div className="session-bar"><label>Oficina<select value={activeWorkshopId || ""} onChange={(event) => void switchWorkshop(event.target.value)}>{me.memberships.map((membership) => <option key={membership.id} value={membership.workshop.id}>{membership.workshop.name}</option>)}</select></label><span>{me.user.name}</span><button type="button" onClick={() => void authClient.signOut()}>Sair</button></div>{children || <iframe className="prototype-frame authenticated" src="/bikeflow.html" title="BikeFlow — sistema da oficina" />}</main>;
}
