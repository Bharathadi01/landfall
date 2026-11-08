import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Landfall — Cash Before the Storm",
    short_name: "Landfall",
    description: "Anticipatory emergency mutual aid powered by PayPal.",
    start_url: "/enroll",
    display: "standalone",
    background_color: "#041633",
    theme_color: "#0B3D91",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
