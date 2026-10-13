import type { Metadata } from "next";
import "./globals.css";
import "./v2.css";
export const metadata: Metadata = {
  title: "GAMBLING — The night is yours",
  description:
    "Tu club de juegos: casino virtual y desafíos de habilidad. Gratis, con monedas ficticias.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
