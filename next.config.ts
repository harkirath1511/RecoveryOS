import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ngrok assigns a new subdomain when the free tunnel restarts. This applies
  // only to Next.js development assets/HMR; production does not use it.
  allowedDevOrigins: ["*.ngrok-free.app"],
};

export default nextConfig;
