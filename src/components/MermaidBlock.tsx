import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import type { ThemeSettings } from "../useSettings";
import { useTranslation } from "../LocaleContext";
import { svgToPng } from "../utils/svgToPng";
import { Lightbox } from "./Lightbox";

let idCounter = 0;

export function MermaidBlock({
  code,
  settings,
}: {
  code: string;
  settings: ThemeSettings;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const id = `mermaid-${++idCounter}`;
    setError(null);

    mermaid.initialize({
      startOnLoad: false,
      theme: settings.mermaidTheme,
      securityLevel: "loose",
      themeVariables: {
        background: settings.mermaidBg,
        primaryColor: settings.mermaidPrimaryColor,
        primaryTextColor: settings.mermaidPrimaryTextColor,
        primaryBorderColor: settings.mermaidLineColor,
        lineColor: settings.mermaidLineColor,
        secondaryColor: settings.mermaidSecondaryColor,
        tertiaryColor: settings.mermaidBg,
        noteBkgColor: settings.mermaidNoteBg,
        noteTextColor: settings.mermaidNoteTextColor,
        noteBorderColor: settings.mermaidLineColor,
        actorBkg: settings.mermaidActorBg,
        actorTextColor: settings.mermaidActorTextColor,
        actorBorder: settings.mermaidLineColor,
        actorLineColor: settings.mermaidLineColor,
        signalColor: settings.mermaidSignalTextColor,
        signalTextColor: settings.mermaidSignalTextColor,
        labelTextColor: settings.mermaidPrimaryTextColor,
        loopTextColor: settings.mermaidSignalTextColor,
        activationBorderColor: settings.mermaidLineColor,
        activationBkgColor: settings.mermaidSecondaryColor,
        sequenceNumberColor: settings.mermaidPrimaryTextColor,
        sectionBkgColor: settings.mermaidPrimaryColor,
        altSectionBkgColor: settings.mermaidSecondaryColor,
        sectionBkgColor2: settings.mermaidSecondaryColor,
        taskBorderColor: settings.mermaidLineColor,
        taskBkgColor: settings.mermaidPrimaryColor,
        taskTextColor: settings.mermaidPrimaryTextColor,
        activeTaskBorderColor: settings.mermaidPrimaryTextColor,
        activeTaskBkgColor: settings.mermaidSecondaryColor,
        gridColor: settings.mermaidLineColor,
        doneTaskBkgColor: "#52525b",
        doneTaskBorderColor: "#71717a",
        titleColor: settings.mermaidPrimaryTextColor,
        edgeLabelBackground: settings.mermaidBg,
        mainBkg: settings.mermaidPrimaryColor,
        nodeBorder: settings.mermaidLineColor,
        clusterBkg: settings.mermaidSecondaryColor,
        clusterBorder: settings.mermaidLineColor,
        defaultLinkColor: settings.mermaidLineColor,
        nodeTextColor: settings.mermaidPrimaryTextColor,
      },
    });

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
          // Ensure the SVG scales properly
          const svgEl = ref.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
          }
        }
      })
      .catch((e) => {
        setError(String(e));
      });
  }, [code, settings]);

  const getSvg = (): SVGSVGElement | null => {
    return ref.current?.querySelector("svg") ?? null;
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const svg = getSvg();
    if (!svg) return;
    try {
      const png = await svgToPng(svg);
      const a = document.createElement("a");
      a.href = png.dataUrl;
      a.download = "mermaid-diagram.png";
      a.click();
    } catch {
      // ignore
    }
  };

  const handleClick = async () => {
    const svg = getSvg();
    if (!svg) return;
    try {
      const png = await svgToPng(svg);
      setLightboxSrc(png.dataUrl);
    } catch {
      // ignore
    }
  };

  const handleLightboxDownload = () => {
    if (!lightboxSrc) return;
    const a = document.createElement("a");
    a.href = lightboxSrc;
    a.download = "mermaid-diagram.png";
    a.click();
  };

  if (error) {
    return (
      <div className="my-3 p-4 rounded-lg bg-red-900/20 border border-red-800">
        <div className="text-red-400 text-xs mb-2">{t("mermaid.renderError")}</div>
        <pre className="text-sm text-zinc-400 whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <>
      <div className="mermaid-wrapper" onClick={handleClick}>
        <div
          ref={ref}
          className="mermaid-container my-3 flex justify-center rounded-lg p-4 overflow-x-auto"
          style={{ backgroundColor: settings.mermaidBg }}
        />
        <span className="mermaid-hover-overlay">
          <button
            className="overlay-download-btn"
            onClick={handleDownload}
            title={t("viewer.mermaid.download")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </span>
      </div>
      {lightboxSrc && (
        <Lightbox
          src={lightboxSrc}
          alt="Mermaid diagram"
          onClose={() => setLightboxSrc(null)}
          onDownload={handleLightboxDownload}
        />
      )}
    </>
  );
}
