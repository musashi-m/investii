import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#141821",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Investidor10x — Carteira de Investimentos em Tempo Real",
  description:
    "Acompanhe sua carteira de Renda Fixa, Ações, FIIs, ETFs, BDRs, Criptos e Stocks com cotações reais e consolidação de patrimônio.",
  manifest: "/manifest.webmanifest",
  applicationName: "Investidor10x",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Investidor10x",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
        <PwaRegister />
      </body>
    </html>
  );
}
