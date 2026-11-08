/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.paypal.com https://*.paypalobjects.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.paypal.com https://*.paypalobjects.com https://*.agron.iastate.edu",
              "connect-src 'self' https://api-m.sandbox.paypal.com https://api.weather.gov https://mesonet.agron.iastate.edu https://api.groq.com https://generativelanguage.googleapis.com",
              "frame-src 'self' https://www.sandbox.paypal.com https://www.paypal.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
