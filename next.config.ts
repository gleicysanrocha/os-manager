import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuração essencial para o GitHub Pages (gera arquivos estáticos)
  output: "export",

  // Isso garante que os links internos e assets encontrem o caminho correto no GitHub Pages
  // Como a URL ficaria github.io/os-manager, precisamos deste prefixo:
  basePath: "/os-manager",
  assetPrefix: "/os-manager",

  // Imagens do next/image não funcionam nativamente no GitHub Pages sem estarem desotimizadas
  images: {
    unoptimized: true,
  },

  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
