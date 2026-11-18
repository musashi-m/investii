import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Investidor — Carteira de Investimentos em Tempo Real",
  description:
    "Acompanhe sua carteira de Renda Fixa, Ações, FIIs, ETFs, BDRs, Criptos e Stocks com cotações reais e consolidação de patrimônio.",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('investidor-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased selection:bg-emerald-500/20">
        {children}
      </body>
    </html>
  );
}

