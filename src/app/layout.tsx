import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GAMBLING — The night is yours",
  description:
    "Tu club de juegos: casino virtual y desafíos de habilidad. Gratis, con monedas ficticias.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
