import type { ReactNode } from "react";
import { BikeFlowGate } from "@/app/bike-flow-gate";
import { AppShell } from "@/components/workspace/app-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <BikeFlowGate><AppShell>{children}</AppShell></BikeFlowGate>;
}
