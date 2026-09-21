// Dependabot 自動化の判定ロジック(純関数のみ、I/O なし)。
// 方針は fail closed: 解釈できない入力は必ず「自動マージしない」側に倒す。

export const REQUIRED_CHECKS = [
  'Frontend (TS / React)',
  'Backend (Rust / Tauri)',
  'Security audit (npm + cargo)',
];

// tauri 系は JS 側と Rust 側のバージョン同期が必要なため常に手動 (dependabot.yml の ignore と同じ理由)。
const MANUAL_ONLY = [/^@tauri-apps\//, /^tauri$/, /^tauri-/];

export const JEV_MERGE_THRESHOLD = 0.9;

/**
 * コミットメッセージ本文の「from A to B」を依存名ごとに集める。
 * 単一更新は見出し `bump NAME from A to B`、複数/グループ更新は本文 `Updates \`NAME\` from A to B`。
 */
function parseVersionChanges(commitMessage) {
  const changes = new Map();
  const headline = /^.*?\bbump (\S+) from (\S+) to (\S+)$/im.exec(commitMessage.split('\n')[0]);
  if (headline) changes.set(headline[1], { from: headline[2], to: headline[3] });
  for (const m of commitMessage.matchAll(/^Updates `([^`]+)` from (\S+) to (\S+)$/gm)) {
    changes.set(m[1], { from: m[2], to: m[3] });
  }
  return changes;
}

/**
 * Dependabot のコミットメッセージ末尾にある `updated-dependencies:` ブロックを読み、
 * 本文の「from A to B」から旧バージョンを補う (セキュリティ更新には update-type が付かないため、
 * 更新の大きさはバージョン差分から自前で判定する)。1件も読めなければ null。
 */
export function parseUpdatedDependencies(commitMessage) {
  const block = /\n---\nupdated-dependencies:\n([\s\S]*?)\n\.\.\./.exec(commitMessage ?? '');
  if (!block) return null;
  const changes = parseVersionChanges(commitMessage);
  const deps = [];
  for (const chunk of block[1].split(/\n(?=- )/)) {
    const field = (key) => {
      const m = new RegExp(`^[- ] ${key}: (.+)$`, 'm').exec(chunk);
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
    };
    const name = field('dependency-name');
    if (!name) return null;
    const version = field('dependency-version');
    const change = changes.get(name);
    deps.push({
      name,
      version,
      // 本文と metadata の新バージョンが食い違う場合は信用しない
      from: change && change.to === version ? change.from : null,
      dependencyType: field('dependency-type'),
    });
  }
  return deps.length > 0 ? deps : null;
}

/** a と b を比較して -1 / 0 / 1。`1.2.3` 形式 (先頭 v 可) 以外は null。 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
    return m ? m.slice(1).map(Number) : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/**
 * 更新の大きさ。0.x 系の minor は破壊的変更を含みうるので major 扱い (dependabot-merge-rules)。
 * @returns {'patch' | 'minor' | 'major' | null} 判定不能は null
 */
export function classifyUpdate(from, to) {
  const cmp = compareVersions(from, to);
  if (cmp === null || cmp >= 0) return null;
  const [fa, fb] = from.replace(/^v/, '').split('.').map(Number);
  const [ta, tb] = to.replace(/^v/, '').split('.').map(Number);
  if (fa !== ta) return 'major';
  if (fb !== tb) return fa === 0 ? 'major' : 'minor';
  return 'patch';
}

export function isManualOnly(name) {
  return MANUAL_ONLY.some((re) => re.test(name));
}

/** 全依存が patch / minor の更新か。旧バージョンが読めない依存があれば false。 */
export function isPatchOrMinorOnly(deps) {
  return deps.every((d) => ['patch', 'minor'].includes(classifyUpdate(d.from, d.version)));
}

/** Dependabot のブランチ名から alerts API の ecosystem 名を得る。未知なら null。 */
export function alertEcosystemOf(branch) {
  const m = /^dependabot\/([^/]+)\//.exec(branch ?? '');
  return { npm_and_yarn: 'npm', cargo: 'rust', github_actions: 'actions' }[m?.[1]] ?? null;
}

function fixesAlert(dep, alert, ecosystem) {
  if (alert.ecosystem !== ecosystem || alert.package !== dep.name) return false;
  const cmp = compareVersions(dep.version, alert.firstPatched);
  return cmp !== null && cmp >= 0;
}

/**
 * セキュリティ更新の PR か: 全依存が、同じ ecosystem の open alert を解消する
 * (パッケージ名一致かつ新バージョン >= first_patched)。
 * 「全依存」なのは、グループ更新に1件だけ修正が混ざった PR をセキュリティ名目で通さないため。
 */
export function isSecurityUpdate(deps, branch, openAlerts) {
  const ecosystem = alertEcosystemOf(branch);
  if (!ecosystem || !deps || deps.length === 0) return false;
  return deps.every((d) => openAlerts.some((a) => fixesAlert(d, a, ecosystem)));
}

/**
 * head SHA に対する必須チェックが全て success か。
 * 再実行で同名の run が複数あるときは、古い success で通さないよう全 run の success を要求する。
 * 他の App が同名のチェックを作って成りすませないよう、GitHub Actions 由来の run だけを数える。
 */
export function requiredChecksGreen(checkRuns) {
  return REQUIRED_CHECKS.every((name) => {
    const runs = checkRuns.filter((c) => c.name === name && c.app?.slug === 'github-actions');
    return runs.length > 0 && runs.every((c) => c.status === 'completed' && c.conclusion === 'success');
  });
}

/**
 * 自動マージ可能な更新内容か (CI や up-to-date は別判定)。
 * @returns {{ok: boolean, reason: string}}
 */
export function isAutoMergeableUpdate(deps) {
  if (!deps) return { ok: false, reason: 'updated-dependencies を解釈できない' };
  const manual = deps.filter((d) => isManualOnly(d.name));
  if (manual.length > 0) return { ok: false, reason: `手動同期が必要: ${manual.map((d) => d.name).join(', ')}` };
  if (!isPatchOrMinorOnly(deps)) return { ok: false, reason: 'patch/minor 以外 (major / 0.x の minor / 判定不能) を含む' };
  return { ok: true, reason: 'patch/minor のみ' };
}

/** Jev の choice 応答から自動マージ承認かを決める。 */
export function jevApproves(answer) {
  if (!answer || answer.choice !== 'merge_now') return false;
  const p = answer.probabilities?.merge_now;
  return typeof p === 'number' && p >= JEV_MERGE_THRESHOLD;
}

/** CI ログから失敗原因らしき行を最大 12 行抜く (タイムスタンプと ANSI 色は除去、各行 200 字まで)。 */
export function extractErrorLines(log) {
  const pattern = /npm error|ERESOLVE|\bpeer\b|error TS\d+|error\[E\d+\]|^\s*FAIL\b|\bError:|##\[error\]/;
  const seen = new Set();
  for (const raw of String(log ?? '').split('\n')) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\S+Z /, '').trim();
    if (line && pattern.test(line)) seen.add(line.slice(0, 200));
    if (seen.size >= 12) break;
  }
  return [...seen];
}

/**
 * PR を今マージしてよいかの最終判定。全条件を満たしたときだけ merge: true。
 * @param {'security' | 'monthly'} mode
 * @param {{authentic: boolean, deps: object[] | null, security: boolean, green: boolean,
 *          mergeable: boolean, jev?: object}} pr
 * @returns {{merge: boolean, reason: string}}
 */
export function decide(mode, pr) {
  if (!pr.authentic) return { merge: false, reason: 'Dependabot の署名付きコミット1件のみ、という条件を満たさない' };
  const update = isAutoMergeableUpdate(pr.deps);
  if (!update.ok) return { merge: false, reason: update.reason };
  if (mode === 'security' && !pr.security) return { merge: false, reason: 'open alert を解消する更新ではない' };
  if (mode === 'monthly' && !jevApproves(pr.jev)) {
    const p = pr.jev?.probabilities?.[pr.jev?.choice];
    return { merge: false, reason: pr.jev ? `Jev: ${pr.jev.choice} (${p ?? '?'})` : 'Jev の判定なし' };
  }
  if (!pr.green) return { merge: false, reason: '必須チェックが全 success ではない' };
  if (!pr.mergeable) return { merge: false, reason: 'main と競合している (Dependabot の自動 rebase 待ち)' };
  return { merge: true, reason: mode === 'security' ? 'セキュリティ更新 (patch/minor, CI green)' : 'Jev 承認 (patch/minor, CI green)' };
}
