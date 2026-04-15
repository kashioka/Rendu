import { useTranslation } from "../LocaleContext";

export function SyntaxReference() {
  const { t } = useTranslation();

  return (
    <div className="syntax-reference">
      <h3 className="syntax-reference-title">{t("help.syntaxTitle")}</h3>
      <div className="syntax-reference-grid">
        <section className="syntax-section">
          <h4>{t("help.basicFormatting")}</h4>
          <table>
            <tbody>
              <tr><td className="syntax-code">**{t("help.bold")}**</td><td><strong>{t("help.bold")}</strong></td></tr>
              <tr><td className="syntax-code">*{t("help.italic")}*</td><td><em>{t("help.italic")}</em></td></tr>
              <tr><td className="syntax-code">~~{t("help.strikethrough")}~~</td><td><del>{t("help.strikethrough")}</del></td></tr>
              <tr><td className="syntax-code">`code`</td><td><code>code</code></td></tr>
              <tr><td className="syntax-code">[{t("help.link")}](url)</td><td><span className="syntax-link">{t("help.link")}</span></td></tr>
            </tbody>
          </table>
        </section>

        <section className="syntax-section">
          <h4>{t("help.headings")}</h4>
          <table>
            <tbody>
              <tr><td className="syntax-code"># H1</td><td>{t("help.headingLevel", { n: "1" })}</td></tr>
              <tr><td className="syntax-code">## H2</td><td>{t("help.headingLevel", { n: "2" })}</td></tr>
              <tr><td className="syntax-code">### H3</td><td>{t("help.headingLevel", { n: "3" })}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="syntax-section">
          <h4>{t("help.lists")}</h4>
          <table>
            <tbody>
              <tr><td className="syntax-code">- item</td><td>{t("help.unorderedList")}</td></tr>
              <tr><td className="syntax-code">1. item</td><td>{t("help.orderedList")}</td></tr>
              <tr><td className="syntax-code">- [x] done</td><td>{t("help.taskList")}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="syntax-section">
          <h4>{t("help.blocks")}</h4>
          <table>
            <tbody>
              <tr><td className="syntax-code">```lang</td><td>{t("help.codeBlock")}</td></tr>
              <tr><td className="syntax-code">&gt; text</td><td>{t("help.blockquote")}</td></tr>
              <tr><td className="syntax-code">---</td><td>{t("help.horizontalRule")}</td></tr>
              <tr><td className="syntax-code">| A | B |</td><td>{t("help.table")}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="syntax-section">
          <h4>{t("help.html")}</h4>
          <table>
            <tbody>
              <tr><td className="syntax-code">{"<br>"}</td><td>{t("help.lineBreak")}</td></tr>
              <tr><td className="syntax-code">{"<kbd>"}Key{"</kbd>"}</td><td><kbd>Key</kbd></td></tr>
              <tr><td className="syntax-code">{"<details>"}</td><td>{t("help.collapsible")}</td></tr>
              <tr><td className="syntax-code">{"<sup>"} {"<sub>"}</td><td>{t("help.superSub")}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="syntax-section">
          <h4>{t("help.mermaidTitle")}</h4>
          <table>
            <tbody>
              <tr>
                <td className="syntax-code">{"```mermaid"}</td>
                <td>{t("help.mermaid")}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      <p className="syntax-reference-footer">{t("help.footer")}</p>
    </div>
  );
}
