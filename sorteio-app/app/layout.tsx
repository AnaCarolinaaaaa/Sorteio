import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rifa Solidária - Cirurgia no Ombro",
  description: "Ação beneficente entre amigos para arrecadar fundos para a realização da cirurgia no ombro de Fernando Arcanjo da Costa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geist.className} antialiased`}>{children}</body>
    </html>
  );
}
