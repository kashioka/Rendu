import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useTranslation } from "../LocaleContext";

interface CodeBlockWrapperProps {
  children: ReactNode;
}

export function CodeBlockWrapper({ children, ...props }: CodeBlockWrapperProps & React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);
  const [isMermaid, setIsMermaid] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!preRef.current) return;
    setIsMermaid(
      preRef.current.querySelector(".mermaid-container, .mermaid-wrapper") !== null
    );
  }, [children]);

  const handleCopy = useCallback(async () => {
    if (!preRef.current) return;
    const code = preRef.current.querySelector("code");
    const text = code?.textContent ?? preRef.current.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in some contexts
    }
  }, []);

  return (
    <div className="code-block-container">
      <pre ref={preRef} {...props}>{children}</pre>
      {!isMermaid && (
        <button
          className="code-copy-btn"
          onClick={handleCopy}
          title={copied ? t("viewer.code.copied") : t("viewer.code.copy")}
          aria-label={copied ? t("viewer.code.copied") : t("viewer.code.copy")}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
