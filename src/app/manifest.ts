import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Investidor10x — Carteira Inteligente",
    short_name: "Investidor10x",
    description:
      "Acompanhe seus investimentos, proventos, ações, FIIs e renda fixa com cotações reais e consolidação automática.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e17",
    theme_color: "#141821",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["finance", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Minha Carteira",
        short_name: "Carteira",
        description: "Abrir o consolidado da carteira",
        url: "/",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}

