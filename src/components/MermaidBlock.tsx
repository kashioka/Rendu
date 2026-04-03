import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import type { ThemeSettings } from "../useSettings";

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

  if (error) {
    return (
      <div className="my-3 p-4 rounded-lg bg-red-900/20 border border-red-800">
        <div className="text-red-400 text-xs mb-2">Mermaid render error</div>
        <pre className="text-sm text-zinc-400 whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid-container my-3 flex justify-center rounded-lg p-4 overflow-x-auto"
      style={{ backgroundColor: settings.mermaidBg }}
    />
  );
}
