import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle Prisma generated client for server-side builds
      config.externals = config.externals || [];
      config.externals.push({
        '@prisma/client/runtime/client': 'commonjs @prisma/client/runtime/client',
      });
    }
    return config;
  },
};

export default nextConfig;
