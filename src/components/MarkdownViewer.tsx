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

function parseHeadings(markdown: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split("\n")) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/[#*`\[\]]/g, "").trim();
    const base = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    headings.push({ id, text, level });
  }
  return headings;
}

interface MarkdownViewerProps {
  filePath: string;
  settings: ThemeSettings;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
}

export function MarkdownViewer({ filePath, settings, onHeadingsChange }: MarkdownViewerProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const markdownBodyRef = useRef<HTMLDivElement>(null);

  const headingsRef = useRef<HeadingItem[]>([]);

  useEffect(() => {
    setError(null);
    setLoading(true);
    readTextFile(filePath)
      .then((text) => {
        setContent(text);
        const h = parseHeadings(text);
        headingsRef.current = h;
        onHeadingsChange?.(h);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [filePath]);

  const headingIndexRef = useRef(0);

  // Reset heading counter before each render
  headingIndexRef.current = 0;

  const makeHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    const Tag = `h${level}` as const;
    return function HeadingComponent(props: React.HTMLAttributes<HTMLHeadingElement>) {
      const idx = headingIndexRef.current++;
      const id = headingsRef.current[idx]?.id ?? `heading-${idx}`;
      return <Tag {...props} id={id} />;
    };
  };

  const components: Components = {
    h1: makeHeading(1),
    h2: makeHeading(2),
    h3: makeHeading(3),
    h4: makeHeading(4),
    h5: makeHeading(5),
    h6: makeHeading(6),
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

  const handleExportPdf = async () => {
    if (!markdownBodyRef.current) return;
    setExporting(true);
    try {
      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: 10,
          filename: "output.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(markdownBodyRef.current)
        .outputPdf("blob");

      const savePath = await save({
        defaultPath: filePath.replace(/\.md$/i, ".pdf"),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) return;

      const arrayBuffer = await pdfBlob.arrayBuffer();
      await writeFile(savePath, new Uint8Array(arrayBuffer));
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading...</div>;

  if (error) {
    return (
      <div className="p-8">
        <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 8 }}>Failed to read file</div>
        <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div>
        <div className="text-muted" style={{ fontSize: 14, marginTop: 8 }}>Path: {filePath}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fixed toolbar */}
      <div className="viewer-toolbar flex-shrink-0 flex justify-end px-4 py-2">
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="px-3 py-1.5 text-sm rounded border border-current opacity-70 hover:opacity-100 disabled:opacity-40 transition-opacity"
        >
          {exporting ? "Exporting..." : "PDF Export"}
        </button>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="markdown-body" ref={markdownBodyRef}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
