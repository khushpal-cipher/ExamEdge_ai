import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@examedge/core'],
  // Institutes are served on <slug>.localhost in development.
  allowedDevOrigins: ['*.localhost'],
};

export default nextConfig;
