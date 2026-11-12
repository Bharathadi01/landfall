/** @type {import('next').NextConfig} */
const nextConfig = {
  // A second local server (for example a verification run) can use its own build folder: NEXT_DIST_DIR=.next-verify
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.paypal.com https://*.paypalobjects.com https://*.agron.iastate.edu https://tiles.openfreemap.org https://*.openfreemap.org https://nowcoast.noaa.gov https://*.noaa.gov https://*.weather.gov https://*.cartocdn.com https://s3.amazonaws.com https://*.amazonaws.com https://server.arcgisonline.com https://*.arcgisonline.com https://gibs.earthdata.nasa.gov https://*.earthdata.nasa.gov https://tilecache.rainviewer.com https://*.rainviewer.com",
              "connect-src 'self' data: blob: https://api.open-meteo.com https://api.rainviewer.com https://tilecache.rainviewer.com https://api-m.sandbox.paypal.com https://*.paypal.com https://api.weather.gov https://*.weather.gov https://mesonet.agron.iastate.edu https://tiles.openfreemap.org https://*.openfreemap.org https://nowcoast.noaa.gov https://*.noaa.gov https://demotiles.maplibre.org https://*.cartocdn.com https://s3.amazonaws.com https://*.amazonaws.com https://server.arcgisonline.com https://*.arcgisonline.com https://gibs.earthdata.nasa.gov https://*.earthdata.nasa.gov",
              "frame-src 'self' https://www.sandbox.paypal.com https://www.paypal.com https://*.paypal.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
