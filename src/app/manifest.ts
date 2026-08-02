import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Out Tonight",
    short_name: "Out Tonight",
    description: "Everything worth going to, in one feed",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // POST + multipart is required to receive shared *files*; a GET target can
    // only carry text and URLs. One target handles both links and photos.
    share_target: {
      action: "/api/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "photo",
            accept: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          },
        ],
      },
    },
  };
}
