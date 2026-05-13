import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` produces a minimal `.next/standalone/` directory that the
  // Enterprise Edition Dockerfile copies in — ~40 MB image instead of 1 GB.
  // Harmless for the Vercel cloud build (Vercel ignores it).
  output: "standalone",
};

export default nextConfig;
