import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BikeFlow | Oficina Pedal Forte",
  description: "Sistema operacional para oficinas mecânicas de bicicletas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
