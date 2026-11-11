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
};
export default nextConfig;
