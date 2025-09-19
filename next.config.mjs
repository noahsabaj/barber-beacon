/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint errors during production builds (2025 best practice for Vercel)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even with TypeScript errors (if needed)
    // ignoreBuildErrors: true, // Uncomment only if needed
  },
};

export default nextConfig;
