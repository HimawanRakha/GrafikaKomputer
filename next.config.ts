import type { NextConfig } from "next";

// GitHub Pages serves the site under /<repo> (https://himawanrakha.github.io/GrafikaKomputer/).
// The Pages workflow passes that prefix as PAGES_BASE_PATH; locally it is empty.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export", // GitHub Pages only hosts static files
  basePath,
  images: { unoptimized: true }, // no image optimization server in a static export
  // basePath is applied to <Link> automatically but NOT to next/image src or
  // fetched files (GLB models), so components read it via lib/asset.ts.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
