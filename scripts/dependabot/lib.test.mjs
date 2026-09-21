import { describe, expect, it } from 'vitest';
import {
  alertEcosystemOf,
  classifyUpdate,
  compareVersions,
  decide,
  extractErrorLines,
  isAutoMergeableUpdate,
  isSecurityUpdate,
  jevApproves,
  parseUpdatedDependencies,
  requiredChecksGreen,
} from './lib.mjs';

// PR #172 の実コミットメッセージから採取
const SINGLE = `chore(deps-dev): bump @vitest/coverage-v8 from 4.1.11 to 5.0.1

Bumps [@vitest/coverage-v8](https://github.com/vitest-dev/vitest) from 4.1.11 to 5.0.1.

---
updated-dependencies:
- dependency-name: "@vitest/coverage-v8"
  dependency-version: 5.0.1
  dependency-type: direct:development
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>`;

const GROUPED = `chore(deps): bump the npm-patch group with 2 updates

Bumps the npm-patch group with 2 updates: [@testing-library/dom](https://example.com) and [eslint-plugin-react-refresh](https://example.com).

Updates \`@testing-library/dom\` from 10.4.1 to 10.4.2
- [Release notes](https://example.com)

Updates \`eslint-plugin-react-refresh\` from 1.5.6 to 1.6.0

---
updated-dependencies:
- dependency-name: "@testing-library/dom"
  dependency-version: 10.4.2
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: npm-patch
- dependency-name: eslint-plugin-react-refresh
  dependency-version: 1.6.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
  dependency-group: npm-patch
...
`;

// PR #161 の実コミットメッセージから採取。セキュリティ更新には update-type が付かない
const SECURITY = `chore(deps-dev): bump browserslist from 4.28.4 to 4.28.9

Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.28.4 to 4.28.9.

---
updated-dependencies:
- dependency-name: browserslist
  dependency-version: 4.28.9
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>`;

describe('parseUpdatedDependencies', () => {
  it('単一依存を読む', () => {
    expect(parseUpdatedDependencies(SINGLE)).toEqual([
      { name: '@vitest/coverage-v8', version: '5.0.1', from: '4.1.11', dependencyType: 'direct:development' },
    ]);
  });

  it('グループ更新の全依存を読む', () => {
    const deps = parseUpdatedDependencies(GROUPED);
    expect(deps.map((d) => d.name)).toEqual(['@testing-library/dom', 'eslint-plugin-react-refresh']);
    expect(deps.map((d) => d.from)).toEqual(['10.4.1', '1.5.6']);
  });

  it('update-type の無いセキュリティ更新でも旧バージョンを読む', () => {
    expect(parseUpdatedDependencies(SECURITY)).toEqual([
      { name: 'browserslist', version: '4.28.9', from: '4.28.4', dependencyType: 'indirect' },
    ]);
  });

  it('本文と metadata の新バージョンが食い違えば from は null', () => {
    const tampered = SECURITY.replace('dependency-version: 4.28.9', 'dependency-version: 9.9.9');
    expect(parseUpdatedDependencies(tampered)[0].from).toBeNull();
  });

  it('ブロックが無い / 空 / 名前欠落は null', () => {
    expect(parseUpdatedDependencies('chore: 手で書いたコミット')).toBeNull();
    expect(parseUpdatedDependencies(undefined)).toBeNull();
    expect(parseUpdatedDependencies('x\n---\nupdated-dependencies:\n- dependency-version: 1.0.0\n...')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('数値として比較する (文字列比較ではない)', () => {
    expect(compareVersions('2.11.0', '2.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v0.23.40', '0.23.45')).toBe(-1);
  });

  it('プレリリースや欠損は比較不能として null', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBeNull();
    expect(compareVersions('1.0', '1.0.0')).toBeNull();
    expect(compareVersions(null, '1.0.0')).toBeNull();
  });
});

describe('classifyUpdate', () => {
  it('patch / minor / major を判定する', () => {
    expect(classifyUpdate('4.28.4', '4.28.9')).toBe('patch');
    expect(classifyUpdate('19.2.8', '19.3.0')).toBe('minor');
    expect(classifyUpdate('4.1.11', '5.0.1')).toBe('major');
  });

  it('0.x 系の minor は major 扱い、0.x の patch は patch', () => {
    expect(classifyUpdate('0.5.6', '0.6.0')).toBe('major');
    expect(classifyUpdate('0.5.6', '0.5.7')).toBe('patch');
  });

  it('ダウングレード / 同一 / 比較不能は null', () => {
    expect(classifyUpdate('2.0.0', '1.9.9')).toBeNull();
    expect(classifyUpdate('1.0.0', '1.0.0')).toBeNull();
    expect(classifyUpdate(null, '1.0.0')).toBeNull();
    expect(classifyUpdate('1.0.0', '1.1.0-rc.1')).toBeNull();
  });
});

describe('isSecurityUpdate', () => {
  const NPM = 'dependabot/npm_and_yarn/browserslist-4.28.9';
  const alerts = [{ ecosystem: 'npm', package: 'browserslist', firstPatched: '4.28.7' }];
  const dep = (name, version) => ({ name, version });

  it('ブランチ名から ecosystem を得る', () => {
    expect(alertEcosystemOf(NPM)).toBe('npm');
    expect(alertEcosystemOf('dependabot/cargo/src-tauri/rustls-0.23.45')).toBe('rust');
    expect(alertEcosystemOf('dependabot/github_actions/actions/checkout-8')).toBe('actions');
    expect(alertEcosystemOf('feature/x')).toBeNull();
  });

  it('first_patched 以上への更新ならセキュリティ更新', () => {
    expect(isSecurityUpdate(parseUpdatedDependencies(SECURITY), NPM, alerts)).toBe(true);
    expect(isSecurityUpdate([dep('browserslist', '4.28.7')], NPM, alerts)).toBe(true);
  });

  it('未満 / 別パッケージ / 比較不能 / alert 無しは対象外', () => {
    expect(isSecurityUpdate([dep('browserslist', '4.28.6')], NPM, alerts)).toBe(false);
    expect(isSecurityUpdate([dep('browserslist-x', '9.0.0')], NPM, alerts)).toBe(false);
    expect(isSecurityUpdate([dep('browserslist', '5.0.0-rc.1')], NPM, alerts)).toBe(false);
    expect(isSecurityUpdate([dep('browserslist', '9.0.0')], NPM, [{ ...alerts[0], firstPatched: null }])).toBe(false);
    expect(isSecurityUpdate([dep('browserslist', '9.0.0')], NPM, [])).toBe(false);
  });

  it('同名でも ecosystem が違えば対象外 (npm の open と cargo の open 等)', () => {
    expect(isSecurityUpdate([dep('browserslist', '4.28.9')], 'dependabot/cargo/src-tauri/browserslist-4.28.9', alerts)).toBe(false);
  });

  it('グループ更新に修正が1件混ざっているだけでは対象外', () => {
    expect(isSecurityUpdate([dep('browserslist', '4.28.9'), dep('vite', '7.9.9')], NPM, alerts)).toBe(false);
  });

  it('解釈不能な入力は対象外', () => {
    expect(isSecurityUpdate(null, NPM, alerts)).toBe(false);
    expect(isSecurityUpdate([], NPM, alerts)).toBe(false);
  });
});

describe('isAutoMergeableUpdate', () => {
  const dep = (name, from, version) => ({ name, from, version });

  it('patch / minor のみなら可 (update-type の無いセキュリティ更新も)', () => {
    expect(isAutoMergeableUpdate(parseUpdatedDependencies(GROUPED)).ok).toBe(true);
    expect(isAutoMergeableUpdate(parseUpdatedDependencies(SECURITY)).ok).toBe(true);
  });

  it('major を1つでも含めば不可', () => {
    expect(isAutoMergeableUpdate(parseUpdatedDependencies(SINGLE)).ok).toBe(false);
    expect(isAutoMergeableUpdate([dep('a', '1.0.0', '1.0.1'), dep('b', '1.0.0', '2.0.0')]).ok).toBe(false);
  });

  it('0.x の minor は不可', () => {
    expect(isAutoMergeableUpdate([dep('a', '0.5.6', '0.6.0')]).ok).toBe(false);
  });

  it('旧バージョン不明 / パース不能は不可 (fail closed)', () => {
    expect(isAutoMergeableUpdate([dep('a', null, '1.0.1')]).ok).toBe(false);
    expect(isAutoMergeableUpdate(null).ok).toBe(false);
  });

  it('tauri 系は patch でも不可', () => {
    for (const name of ['@tauri-apps/api', 'tauri', 'tauri-plugin-dialog']) {
      expect(isAutoMergeableUpdate([dep(name, '2.0.0', '2.0.1')]).ok).toBe(false);
    }
    expect(isAutoMergeableUpdate([dep('taurine', '2.0.0', '2.0.1')]).ok).toBe(true);
  });
});

describe('requiredChecksGreen', () => {
  const run = (name, conclusion = 'success', status = 'completed', slug = 'github-actions') => ({
    name,
    status,
    conclusion,
    app: { slug },
  });
  const all = [run('Frontend (TS / React)'), run('Backend (Rust / Tauri)'), run('Security audit (npm + cargo)')];

  it('必須3本が success なら true (CodeQL 等の他チェックは無視)', () => {
    expect(requiredChecksGreen([...all, run('CodeQL', 'neutral')])).toBe(true);
  });

  it('失敗 / 実行中 / 欠落は false', () => {
    expect(requiredChecksGreen([all[0], all[1], run('Security audit (npm + cargo)', 'failure')])).toBe(false);
    expect(requiredChecksGreen([all[0], all[1], run('Security audit (npm + cargo)', null, 'in_progress')])).toBe(false);
    expect(requiredChecksGreen([all[0], all[1]])).toBe(false);
  });

  it('再実行で同名 run が複数あるとき、古い success では通さない', () => {
    expect(requiredChecksGreen([...all, run('Frontend (TS / React)', 'failure')])).toBe(false);
    expect(requiredChecksGreen([...all, run('Frontend (TS / React)', null, 'in_progress')])).toBe(false);
    expect(requiredChecksGreen([...all, run('Frontend (TS / React)')])).toBe(true);
  });

  it('GitHub Actions 以外の App が作った同名チェックは数えない', () => {
    const spoofed = run('Security audit (npm + cargo)', 'success', 'completed', 'some-other-app');
    expect(requiredChecksGreen([all[0], all[1], spoofed])).toBe(false);
  });
});

describe('jevApproves', () => {
  it('merge_now かつ確率 0.9 以上のみ承認', () => {
    expect(jevApproves({ choice: 'merge_now', probabilities: { merge_now: 0.9 } })).toBe(true);
    expect(jevApproves({ choice: 'merge_now', probabilities: { merge_now: 0.89 } })).toBe(false);
    expect(jevApproves({ choice: 'hold_for_upstream', probabilities: { merge_now: 0.95 } })).toBe(false);
  });

  it('応答が欠けていれば承認しない', () => {
    expect(jevApproves(undefined)).toBe(false);
    expect(jevApproves({ choice: 'merge_now' })).toBe(false);
  });
});

describe('decide', () => {
  const ok = {
    authentic: true,
    deps: [{ name: 'browserslist', from: '4.28.4', version: '4.28.9' }],
    security: true,
    green: true,
    mergeable: true,
    jev: { choice: 'merge_now', probabilities: { merge_now: 0.97 } },
  };

  it('全条件を満たせばマージ', () => {
    expect(decide('security', ok).merge).toBe(true);
    expect(decide('monthly', ok).merge).toBe(true);
  });

  it('条件が1つでも欠ければマージしない', () => {
    for (const broken of [
      { authentic: false },
      { deps: null },
      { deps: [{ name: 'x', from: '1.0.0', version: '2.0.0' }] },
      { green: false },
      { mergeable: false },
    ]) {
      expect(decide('security', { ...ok, ...broken }).merge).toBe(false);
      expect(decide('monthly', { ...ok, ...broken }).merge).toBe(false);
    }
  });

  it('security は alert 解消が必須で Jev を見ない / monthly は Jev 承認が必須で alert を見ない', () => {
    expect(decide('security', { ...ok, security: false }).merge).toBe(false);
    expect(decide('security', { ...ok, jev: undefined }).merge).toBe(true);
    expect(decide('monthly', { ...ok, security: false }).merge).toBe(true);
    expect(decide('monthly', { ...ok, jev: undefined }).merge).toBe(false);
    expect(decide('monthly', { ...ok, jev: { choice: 'hold_for_upstream', probabilities: { hold_for_upstream: 0.99 } } }).merge).toBe(false);
  });

  it('Jev が承認しても major はマージしない', () => {
    expect(decide('monthly', { ...ok, deps: [{ name: 'x', from: '1.0.0', version: '2.0.0' }] }).merge).toBe(false);
  });
});

describe('extractErrorLines', () => {
  it('タイムスタンプと色を除いて原因行だけを重複なく抜く', () => {
    const log = [
      '2026-09-21T00:12:01.123Z npm error code ERESOLVE',
      '2026-09-21T00:12:01.124Z npm error code ERESOLVE',
      '2026-09-21T00:12:01.125Z \x1b[31mnpm error\x1b[0m peer vitest@"5.0.1" from @vitest/coverage-v8@5.0.1',
      '2026-09-21T00:12:01.126Z added 3 packages in 2s',
    ].join('\n');
    expect(extractErrorLines(log)).toEqual([
      'npm error code ERESOLVE',
      'npm error peer vitest@"5.0.1" from @vitest/coverage-v8@5.0.1',
    ]);
  });

  it('12 行・各 200 字で打ち切る / 空入力は空配列', () => {
    const log = Array.from({ length: 30 }, (_, i) => `Error: ${i} ${'x'.repeat(300)}`).join('\n');
    const lines = extractErrorLines(log);
    expect(lines).toHaveLength(12);
    expect(lines[0]).toHaveLength(200);
    expect(extractErrorLines(undefined)).toEqual([]);
  });
});
