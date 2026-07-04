/**
 * Markdown 本文の内容判定ユーティリティ。
 * 重いレンダラ (KaTeX / Mermaid) を遅延ロードするかの判定に使う。
 * コンポーネントファイルから分離しているのは react-refresh (HMR) が
 * component-only export を要求するため。
 */

/** Whether the document contains math syntax that needs KaTeX: $$...$$
 *  (inline/display, singleDollarTextMath is off) or a ```math / ~~~math fence.
 *  A `$$` inside a code block is a false positive, which only costs an
 *  unnecessary load — never a missed formula. */
export function hasMathSyntax(text: string): boolean {
  return text.includes("$$") || /^ {0,3}(?:`{3,}|~{3,}) *math\b/m.test(text);
}

/** Whether a code block has any non-whitespace content worth rendering. */
export function hasRenderableMermaidCode(code: string): boolean {
  return code.trim().length > 0;
}
