import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "はまスイ記録会",
    short_name: "はまスイ",
    description: "スイミング記録会の記録閲覧",
    start_url: "/",
    display: "standalone",
    background_color: "#d8f0ff",
    theme_color: "#4ea7e2",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };
}
