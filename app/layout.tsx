import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Casa Analítica", template: "%s · Casa Analítica" },
  description: "Escola digital de dados, inteligência artificial e negócios. Conhecimento que se transforma em resultado.",
};

export const viewport: Viewport = { themeColor: "#0B1F3B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
