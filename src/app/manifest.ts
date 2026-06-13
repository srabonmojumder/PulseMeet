import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PulseMeet",
    short_name: "PulseMeet",
    description: "Team chat & video meetings — real-time messaging, calls, and screen sharing.",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#4338ca",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
