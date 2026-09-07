/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Reuse a dynamic page's rendered result in the client router cache for a
    // short while, so switching between the bottom-nav tabs (and back to home /
    // parent) is instant instead of re-fetching from the server every time.
    // Completing a quest calls router.refresh(), which busts this immediately.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
