/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Next.js dev server to accept requests from ngrok tunnels
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io'],

  // Allow embedding in monday.com iframes.
  // frame-ancestors CSP is the modern replacement for X-Frame-Options.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.monday.com https://monday.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
