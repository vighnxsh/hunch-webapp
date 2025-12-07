import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle Prisma generated client for server-side builds
      config.externals = config.externals || [];
      config.externals.push({
        '@prisma/client/runtime/client': 'commonjs @prisma/client/runtime/client',
      });
      
      // Add app directory to resolve paths
      config.resolve.modules = [
        ...(config.resolve.modules || []),
        path.resolve(__dirname, './app'),
      ];
    }
    return config;
  },
};

export default nextConfig;
