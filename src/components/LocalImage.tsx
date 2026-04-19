import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { ImageWithOverlay } from "./ImageWithOverlay";

interface LocalImageProps {
  absolutePath: string;
  alt?: string;
}

const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

export function LocalImage({ absolutePath, alt, ...props }: LocalImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;

    (async () => {
      try {
        const data = await readFile(absolutePath);
        if (revoked) return;
        const ext = absolutePath.split(".").pop()?.toLowerCase() || "";
        const mime = mimeTypes[ext] || "application/octet-stream";
        const blob = new Blob([data], { type: mime });
        url = URL.createObjectURL(blob);
        if (!revoked) setBlobUrl(url);
      } catch {
        // File not found or permission denied
      }
    })();

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [absolutePath]);

  if (!blobUrl) return <img alt={alt} {...props} />;
  return <ImageWithOverlay src={blobUrl} alt={alt} {...props} />;
}
