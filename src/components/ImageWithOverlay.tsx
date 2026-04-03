import { useState } from "react";
import { useTranslation } from "../LocaleContext";
import { Lightbox } from "./Lightbox";

interface ImageWithOverlayProps {
  src?: string;
  alt?: string;
}

export function ImageWithOverlay({ src, alt, ...props }: ImageWithOverlayProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const { t } = useTranslation();

  if (!src) return <img src={src} alt={alt} {...props} />;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "image";
    a.click();
  };

  return (
    <>
      <span className="image-wrapper">
        <img src={src} alt={alt || ""} {...props} onClick={() => setShowLightbox(true)} style={{ cursor: "pointer" }} />
        <span className="image-hover-overlay">
          <button
            className="overlay-download-btn"
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            title={t("viewer.image.download")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </span>
      </span>
      {showLightbox && (
        <Lightbox
          src={src}
          alt={alt}
          onClose={() => setShowLightbox(false)}
          onDownload={handleDownload}
        />
      )}
    </>
  );
}
