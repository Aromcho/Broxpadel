import type { NextConfig } from 'next';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // el panel y el checkout llaman a /api/* en el mismo dominio (cookies httpOnly sin CORS)
  async rewrites() {
    return [
      { source: '/api/:path((?!revalidate).*)', destination: `${API}/api/:path` },
      { source: '/media/:path*', destination: `${API}/media/:path*` },
    ];
  },
  async headers() {
    return [
      { source: '/hdri/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
  experimental: { optimizePackageImports: ['three', '@react-three/drei'] },
};
export default nextConfig;
