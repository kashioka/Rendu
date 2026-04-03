import { useEffect, useRef, useState } from "react";
import { readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import html2pdf from "html2pdf.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { MermaidBlock } from "./MermaidBlock";
import type { ThemeSettings } from "../useSettings";
import type { HeadingItem } from "./OutlinePanel";
import { useTranslation } from "../LocaleContext";

interface MarkdownViewerProps {
  filePath: string;
  settings: ThemeSettings;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
}

interface SearchResult {
  lineNum: number;
  text: string;
}

interface GutterEntry {
  lineNum: number;
  top: number;
}

export function MarkdownViewer({ filePath, settings, onHeadingsChange }: MarkdownViewerProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [gutterVisible, setGutterVisible] = useState(false);
  const [gutterData, setGutterData] = useState<GutterEntry[]>([]);
  const markdownBodyRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    setError(null);
    setLoading(true);
    readTextFile(filePath)
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [filePath]);

  // After markdown renders, scan the DOM for headings and assign IDs
  useEffect(() => {
    if (loading || !markdownBodyRef.current) return;
    const els = markdownBodyRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const seen = new Map<string, number>();
    const items: HeadingItem[] = [];
    els.forEach((el) => {
      const text = (el.textContent || "").trim();
      const base = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      el.id = id;
      items.push({ id, text, level: parseInt(el.tagName[1]) });
    });
    onHeadingsChange?.(items);
  }, [content, loading]);

  // After markdown renders, compute gutter data (every line number + positions)
  useEffect(() => {
    if (loading || !markdownBodyRef.current || !gutterVisible) {
      setGutterData([]);
      return;
    }

    let cancelled = false;
    // Double RAF to ensure layout is complete after marginLeft change
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const container = markdownBodyRef.current;
        if (!container) return;

        const rawLines = content.split("\n");
        const totalLines = rawLines.length;

        // --- Parse source into blocks ---
        const sourceBlocks: { start: number; end: number }[] = [];
        let i = 0;
        while (i < totalLines) {
          if (!rawLines[i].trim()) { i++; continue; }
          const start = i;

          // Code fence
          if (rawLines[i].trim().startsWith("```")) {
            i++;
            while (i < totalLines && !rawLines[i].trim().startsWith("```")) i++;
            if (i < totalLines) i++;
            sourceBlocks.push({ start, end: i - 1 });
            continue;
          }
          // Heading
          if (/^#{1,6}\s/.test(rawLines[i])) {
            sourceBlocks.push({ start: i, end: i });
            i++;
            continue;
          }
          // HR
          if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(rawLines[i].trim())) {
            sourceBlocks.push({ start: i, end: i });
            i++;
            continue;
          }
          // Table
          if (rawLines[i].trim().startsWith("|")) {
            while (i < totalLines && rawLines[i].trim().startsWith("|")) i++;
            sourceBlocks.push({ start, end: i - 1 });
            continue;
          }
          // Blockquote
          if (rawLines[i].trim().startsWith(">")) {
            while (i < totalLines && rawLines[i].trim().startsWith(">")) i++;
            sourceBlocks.push({ start, end: i - 1 });
            continue;
          }
          // List
          if (/^[-*+]\s/.test(rawLines[i].trim()) || /^\d+[.)]\s/.test(rawLines[i].trim())) {
            i++;
            while (i < totalLines) {
              const t = rawLines[i].trim();
              if (!t) {
                let j = i + 1;
                while (j < totalLines && !rawLines[j].trim()) j++;
                if (j < totalLines && (/^[-*+]\s/.test(rawLines[j].trim()) || /^\d+[.)]\s/.test(rawLines[j].trim()) || rawLines[j].startsWith("  ") || rawLines[j].startsWith("\t"))) {
                  i++;
                  continue;
                }
                break;
              }
              if (/^[-*+]\s/.test(t) || /^\d+[.)]\s/.test(t) || rawLines[i].startsWith("  ") || rawLines[i].startsWith("\t")) {
                i++;
              } else {
                break;
              }
            }
            sourceBlocks.push({ start, end: i - 1 });
            continue;
          }
          // Paragraph (default)
          i++;
          while (i < totalLines && rawLines[i].trim() &&
                 !/^#{1,6}\s/.test(rawLines[i]) &&
                 !rawLines[i].trim().startsWith("```") &&
                 !rawLines[i].trim().startsWith("|") &&
                 !rawLines[i].trim().startsWith(">") &&
                 !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(rawLines[i].trim()) &&
                 !/^[-*+]\s/.test(rawLines[i].trim()) &&
                 !/^\d+[.)]\s/.test(rawLines[i].trim())) {
            i++;
          }
          sourceBlocks.push({ start, end: i - 1 });
        }

        // --- Match source blocks to rendered DOM blocks ---
        const blockSelector = ":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > p, :scope > ul, :scope > ol, :scope > pre, :scope > blockquote, :scope > table, :scope > hr";
        const renderedBlocks = Array.from(container.querySelectorAll(blockSelector));
        const matchCount = Math.min(sourceBlocks.length, renderedBlocks.length);

        // --- Compute position for every line ---
        const linePositions: (number | null)[] = new Array(totalLines).fill(null);

        for (let bi = 0; bi < matchCount; bi++) {
          const sb = sourceBlocks[bi];
          const el = renderedBlocks[bi] as HTMLElement;
          const top = el.offsetTop;
          const height = el.offsetHeight;
          const lineCount = sb.end - sb.start + 1;

          for (let li = sb.start; li <= sb.end; li++) {
            const fraction = lineCount > 1 ? (li - sb.start) / lineCount : 0;
            linePositions[li] = top + fraction * height;
          }
        }

        // Interpolate positions for empty/unmatched lines
        for (let li = 0; li < totalLines; li++) {
          if (linePositions[li] !== null) continue;
          let prevLine = li - 1;
          while (prevLine >= 0 && linePositions[prevLine] === null) prevLine--;
          let nextLine = li + 1;
          while (nextLine < totalLines && linePositions[nextLine] === null) nextLine++;

          if (prevLine >= 0 && nextLine < totalLines) {
            const t = (li - prevLine) / (nextLine - prevLine);
            linePositions[li] = linePositions[prevLine]! + (linePositions[nextLine]! - linePositions[prevLine]!) * t;
          } else if (prevLine >= 0) {
            linePositions[li] = linePositions[prevLine]! + (li - prevLine) * 20;
          } else if (nextLine < totalLines) {
            linePositions[li] = Math.max(0, linePositions[nextLine]! - (nextLine - li) * 20);
          } else {
            linePositions[li] = li * 20;
          }
        }

        const entries: GutterEntry[] = [];
        for (let li = 0; li < totalLines; li++) {
          entries.push({ lineNum: li + 1, top: linePositions[li] ?? 0 });
        }
        setGutterData(entries);
      });
    });

    return () => { cancelled = true; };
  }, [content, loading, gutterVisible]);

  // Cmd+F to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Auto-clear export error
  useEffect(() => {
    if (!exportError) return;
    const t = setTimeout(() => setExportError(null), 5000);
    return () => clearTimeout(t);
  }, [exportError]);

  // Search in raw markdown content
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const lines = content.split("\n");
    const results: SearchResult[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        results.push({ lineNum: i + 1, text: lines[i] });
      }
    }
    setSearchResults(results);
  }, [searchQuery, content]);

  const handleSelectResult = (result: SearchResult, resultIndex: number) => {
    setShowResults(false);
    if (!markdownBodyRef.current) return;

    // Find all matching text nodes in the rendered DOM
    const walker = document.createTreeWalker(
      markdownBodyRef.current,
      NodeFilter.SHOW_TEXT,
    );
    const query = searchQuery.toLowerCase();
    const matches: Element[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.toLowerCase().includes(query) && node.parentElement) {
        matches.push(node.parentElement);
      }
    }

    // Jump to the Nth match corresponding to the clicked result
    const target = matches[resultIndex] ?? matches[0];
    if (target && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetRect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offsetTop = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: Math.max(0, offsetTop - container.clientHeight / 2), behavior: "smooth" });
      const prev = target.style.backgroundColor;
      target.style.backgroundColor = "rgba(250, 204, 21, 0.4)";
      setTimeout(() => { target.style.backgroundColor = prev; }, 2000);
    }
  };

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const lang = match?.[1];
      const codeString = String(children).replace(/\n$/, "");
      if (lang === "mermaid") {
        return <MermaidBlock code={codeString} settings={settings} />;
      }
      return <code className={className} {...props}>{children}</code>;
    },
  };

  /** Convert a live SVG to a PNG data URL (reads only, no permanent DOM changes) */
  const svgToPng = async (svg: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number }> => {
    // Inline computed styles temporarily so they survive serialization
    const elements = svg.querySelectorAll("*");
    const savedStyles = new Map<Element, string>();
    elements.forEach((el) => {
      savedStyles.set(el, el.getAttribute("style") || "");
      const computed = getComputedStyle(el);
      let css = "";
      for (let i = 0; i < computed.length; i++) {
        const key = computed[i];
        css += `${key}:${computed.getPropertyValue(key)};`;
      }
      el.setAttribute("style", css);
    });

    const svgData = new XMLSerializer().serializeToString(svg);

    // Restore original styles immediately
    elements.forEach((el) => {
      const orig = savedStyles.get(el);
      if (orig) el.setAttribute("style", orig);
      else el.removeAttribute("style");
    });

    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = image.naturalWidth * scale;
    canvas.height = image.naturalHeight * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: svg.getBoundingClientRect().width,
      height: svg.getBoundingClientRect().height,
    };
  };

  const handleExportPdf = async () => {
    if (!markdownBodyRef.current) return;
    setExporting(true);

    // Wait for the overlay to render before modifying the DOM
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const el = markdownBodyRef.current;
    const replaced: { parent: Node; img: HTMLImageElement; svg: SVGSVGElement }[] = [];
    try {
      // 1) Convert SVGs to PNGs (inline styles temporarily, then restore)
      const liveSvgs = Array.from(el.querySelectorAll("svg"));
      for (const svg of liveSvgs) {
        try {
          const png = await svgToPng(svg);
          const img = document.createElement("img");
          img.src = png.dataUrl;
          img.style.width = png.width + "px";
          img.style.height = png.height + "px";
          const parent = svg.parentNode!;
          parent.replaceChild(img, svg);
          replaced.push({ parent, img, svg });
        } catch {
          // skip this SVG
        }
      }

      // 2) Apply print-friendly styles (hidden behind overlay)
      el.classList.add("pdf-export");

      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: 10,
          filename: "output.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(el)
        .outputPdf("blob");

      // 3) Restore DOM before showing the save dialog
      el.classList.remove("pdf-export");
      for (const { parent, img, svg } of replaced) {
        parent.replaceChild(svg, img);
      }
      replaced.length = 0;

      // 4) Hide overlay, then show save dialog
      setExporting(false);

      const savePath = await save({
        defaultPath: filePath.replace(/\.md$/i, ".pdf"),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) return;

      const arrayBuffer = await pdfBlob.arrayBuffer();
      await writeFile(savePath, new Uint8Array(arrayBuffer));
    } catch (e) {
      console.error("PDF export failed:", e);
      el.classList.remove("pdf-export");
      for (const { parent, img, svg } of replaced) {
        if (img.parentNode === parent) parent.replaceChild(svg, img);
      }
      setExporting(false);
      setExportError(t("viewer.exportPdf.error"));
    }
  };

  if (loading) return <div className="p-8 text-muted">{t("viewer.loading")}</div>;

  if (error) {
    return (
      <div className="p-8">
        <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 8 }}>{t("viewer.error.title")}</div>
        <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div>
        <div className="text-muted" style={{ fontSize: 14, marginTop: 8 }}>{t("viewer.error.path", { path: filePath })}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Export overlay */}
      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg px-6 py-4 text-sm font-medium shadow-lg"
               style={{ backgroundColor: "var(--sidebar-bg, #18181b)", color: "var(--text-color, #e4e4e7)" }}>
            {t("viewer.exportPdf.overlay")}
          </div>
        </div>
      )}
      {/* Export error toast */}
      {exportError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-sm font-medium shadow-lg"
             style={{ backgroundColor: "#991b1b", color: "#fecaca" }}>
          {exportError}
        </div>
      )}
      {/* Fixed toolbar */}
      <div className="viewer-toolbar flex-shrink-0 flex items-center px-4 py-2">
        <div className="flex-1 flex items-center">
          <button
            onClick={() => setGutterVisible((v) => !v)}
            className="line-gutter-toggle"
            title={gutterVisible ? t("viewer.lineToggle.hide") : t("viewer.lineToggle.show")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="1" y="5" fontSize="4.5" fill="currentColor" fontFamily="monospace">1</text>
              <text x="1" y="10" fontSize="4.5" fill="currentColor" fontFamily="monospace">2</text>
              <text x="1" y="15" fontSize="4.5" fill="currentColor" fontFamily="monospace">3</text>
              <line x1="7" y1="0" x2="7" y2="16" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <line x1="9" y1="3" x2="15" y2="3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="9" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* Search field */}
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => { if (searchQuery) setShowResults(true); }}
            ref={searchInputRef}
            placeholder={t("viewer.search.placeholder")}
            className="settings-input w-full px-3 py-1 text-sm rounded"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); setShowResults(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          )}
          {showResults && searchQuery && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg overflow-y-auto z-40"
              style={{
                backgroundColor: "var(--sidebar-bg, #18181b)",
                border: "1px solid var(--border-color, #3f3f46)",
                maxHeight: "300px",
              }}
            >
              {searchResults.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted">{t("viewer.search.noResults")}</div>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-xs text-muted" style={{ borderBottom: "1px solid var(--border-color, #3f3f46)" }}>
                    {t("viewer.matchCount", { count: searchResults.length })}
                  </div>
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectResult(r, i)}
                      className="px-3 py-1.5 text-sm cursor-pointer truncate hover:opacity-80"
                      style={{ borderBottom: "1px solid var(--border-color, #3f3f46)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg, #3f3f4680)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span className="text-muted mr-2" style={{ fontSize: 11 }}>L{r.lineNum}</span>
                      <span>{r.text.length > 80 ? r.text.slice(0, 80) + "…" : r.text}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="px-3 py-1.5 text-sm rounded border border-current opacity-70 hover:opacity-100 disabled:opacity-40 transition-opacity"
          >
            {exporting ? t("viewer.exportPdf.exporting") : t("viewer.exportPdf")}
          </button>
        </div>
      </div>
      {/* Click outside to close search results */}
      {showResults && <div className="fixed inset-0 z-30" onClick={() => setShowResults(false)} />}
      {/* Scrollable content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto" style={{ position: "relative" }}>
          {gutterVisible && gutterData.length > 0 && (
            <div className="line-gutter">
              {gutterData.map((entry, i) => (
                <div
                  key={i}
                  className="line-gutter-num"
                  style={{ position: "absolute", top: entry.top }}
                >
                  {entry.lineNum}
                </div>
              ))}
            </div>
          )}
          <div
            className="markdown-body"
            ref={markdownBodyRef}
            style={gutterVisible ? { marginLeft: 48 } : undefined}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
