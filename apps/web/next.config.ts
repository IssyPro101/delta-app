import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pipeline-intelligence/shared"],
  async rewrites() {
    const serverBaseUrl = process.env.SERVER_BASE_URL ?? "http://localhost:4000";

    return [
      {
        source: "/api/:path*",
        destination: `${serverBaseUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${serverBaseUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
