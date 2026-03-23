import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    allowedDevOrigins: ["localhost:3000", "localhost:3001", "*.replit.dev", "*.repl.co"],
  },
};

export default nextConfig;
