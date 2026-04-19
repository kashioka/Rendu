import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ImageWithOverlay } from "./ImageWithOverlay";

interface LocalImageProps {
  baseDir: string;
  src: string;
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

export function LocalImage({ baseDir, src, alt, ...props }: LocalImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Resolve, validate, and read atomically on the Rust side
        const base64 = await invoke<string>("read_safe_image", {
          baseDir,
          src,
        });
        if (cancelled) return;
        const ext = src.split(".").pop()?.toLowerCase() || "";
        const mime = mimeTypes[ext] || "application/octet-stream";
        setDataUrl(`data:${mime};base64,${base64}`);
      } catch {
        // Path rejected, file not found, or permission denied
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseDir, src]);

  if (!dataUrl) return <img alt={alt} {...props} />;
  return <ImageWithOverlay src={dataUrl} alt={alt} {...props} />;
}
