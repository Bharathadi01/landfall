import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Landfall — Relief that lands before the storm",
    short_name: "Landfall",
    description: "Anticipatory emergency mutual aid powered by PayPal.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F3EC",
    theme_color: "#0E6B50",
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

