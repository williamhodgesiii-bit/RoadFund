import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Road Fund",
    short_name: "Road Fund",
    description: "Collect road dues, pay the plow contractor and keep a clean record for your private road.",
    start_url: "/app",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#1F5E3B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
