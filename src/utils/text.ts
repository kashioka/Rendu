/**
 * テキスト処理の Unicode 安全ユーティリティ。
 * ASCII 前提を避け、CJK・全角/半角・絵文字を正しく扱う。
 */

/**
 * 検索用にテキストを正規化する。
 * NFKC で全角/半角・互換文字を畳み (ＡＢＣ→ABC、半角ｶﾅ→カナ 等)、
 * lowercase で英字の大小を無視する。CJK には toLowerCase は無害な no-op。
 */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/**
 * コードポイント単位で文字列を切り詰める。
 * `String.prototype.slice` は UTF-16 コードユニット単位なので、絵文字や
 * 一部の漢字 (サロゲートペア) を途中で割ると半欠け文字 (�) になる。
 * `for...of` はコードポイント単位で反復するためこれを防ぐ。
 * max+1 個目で打ち切るので、非常に長い行でも走査は有界 (全体を確保しない)。
 * 超過時のみ末尾に ellipsis を付ける。
 */
export function truncateChars(s: string, max: number, ellipsis = "…"): string {
  const out: string[] = [];
  for (const ch of s) {
    if (out.length === max) return out.join("") + ellipsis;
    out.push(ch);
  }
  return s;
}
