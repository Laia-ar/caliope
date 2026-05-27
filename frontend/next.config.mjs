/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5000';

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Proxy auth routes to backend (these don't exist in Next.js)
        {
          source: '/logout',
          destination: `${BACKEND_URL}/logout`,
        },
        {
          source: '/login/callback',
          destination: `${BACKEND_URL}/login/callback`,
        },
        // Proxy API requests to backend
        {
          source: '/api/:path*',
          destination: `${BACKEND_URL}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
