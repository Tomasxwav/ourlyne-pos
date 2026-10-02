import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  experimental: {
    authInterrupts: true,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default nextConfig
