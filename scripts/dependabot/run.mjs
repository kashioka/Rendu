// Dependabot PR の無人処理。GitHub Actions の schedule から呼ばれる。
//   node scripts/dependabot/run.mjs security   … open alert を解消する patch/minor を 1 回の実行で最大 1 件マージ
//   node scripts/dependabot/run.mjs monthly    … 全 PR を Jev に判断させ、承認されたものをマージ + 月次レポート Issue
// DRY_RUN=true でマージも Issue 作成もしない。
//
// 安全境界: PR のコードは checkout も実行もしない (API で事実を読むだけ)。
// App トークンは ruleset を bypass するので、必須チェックの確認はこのスクリプトが唯一のゲート。
import { appendFileSync } from 'node:fs';
import {
  REQUIRED_CHECKS,
  classifyUpdate,
  decide,
  extractErrorLines,
  isSecurityUpdate,
  parseUpdatedDependencies,
  requiredChecksGreen,
} from './lib.mjs';

const mode = process.argv[2];
if (mode !== 'security' && mode !== 'monthly') {
  console.error('usage: run.mjs <security|monthly>');
  process.exit(2);
}
const dryRun = process.env.DRY_RUN === 'true';
const repo = process.env.GITHUB_REPOSITORY;
const DEPENDABOT = 'dependabot[bot]';

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body?.message ?? ''}`);
    error.status = res.status;
    throw error;
  }
  return body;
}

// 直前のマージで main が壊れていないことを確認してから次をマージする
async function mainCiState() {
  const { workflow_runs: runs } = await gh(`/repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=1`);
  if (runs.length === 0) return 'unknown';
  return runs[0].status === 'completed' ? runs[0].conclusion : 'running';
}

// 失敗した必須チェックのログから原因らしき行を抜く (Jev に「なぜ落ちたか」を渡すため)。
// ログは依存パッケージが出力を左右できる非信頼テキストだが、渡すのは CI が赤い PR だけで、
// 赤い PR は Jev の判定に関係なくマージされないので、判定を誘導されても実害はレポートの文言に留まる。
async function failureExcerpt(checkRun) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${checkRun.id}/logs`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!res.ok) return null;
    return extractErrorLines(await res.text());
  } catch {
    return null;
  }
}

async function collect(pr, openAlerts) {
  const commits = await gh(`/repos/${repo}/pulls/${pr.number}/commits?per_page=100`);
  const authentic =
    pr.head.repo?.full_name === repo &&
    commits.length === 1 &&
    commits[0].author?.login === DEPENDABOT &&
    commits[0].commit.verification?.verified === true;
  const deps = authentic ? parseUpdatedDependencies(commits[0].commit.message) : null;
  const { check_runs: checkRuns } = await gh(`/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`);
  const detail = await gh(`/repos/${repo}/pulls/${pr.number}`);
  const failures = {};
  for (const run of checkRuns) {
    if (REQUIRED_CHECKS.includes(run.name) && run.conclusion === 'failure') {
      failures[run.name] = await failureExcerpt(run);
    }
  }
  return {
    number: pr.number,
    title: pr.title,
    sha: pr.head.sha,
    authentic,
    deps,
    security: isSecurityUpdate(deps, pr.head.ref, openAlerts),
    green: requiredChecksGreen(checkRuns),
    // 計算中 (null) は「まだマージできない」として扱う
    mergeable: detail.mergeable === true && detail.head.sha === pr.head.sha,
    failures,
    checks: Object.fromEntries(
      REQUIRED_CHECKS.map((name) => {
        const run = checkRuns.find((c) => c.name === name);
        return [name, run ? (run.conclusion ?? run.status) : 'missing'];
      }),
    ),
  };
}

const JEV_CHOICES = {
  merge_now: 'Merge this PR as-is right now.',
  wait_for_sibling_pr: 'Do not merge yet; another open PR in this list must land first or together with it.',
  hold_for_upstream:
    'Keep the PR open and wait. Use this when CI fails because of a dependency-resolution or compatibility problem (ERESOLVE, unmet peer dependency, a tool that does not support the new version yet) that a future upstream release or a companion bump can fix.',
  close:
    'Close the PR. Use this only when the update can never become applicable, e.g. the dependency is being removed or the PR is superseded by another one.',
};

async function askJev(prs) {
  const state = {
    policy: [
      `Repo ${repo}: Tauri 2 + React 19 + TypeScript desktop app, solo maintainer.`,
      'Patch/minor Dependabot PRs are merged only when every required CI check succeeded. Major bumps and 0.x minor bumps are never merged automatically.',
      'react and react-dom must always resolve to the same version.',
    ],
    prs: Object.fromEntries(
      prs.map((pr) => [
        `pr${pr.number}`,
        {
          title: pr.title,
          updates: (pr.deps ?? []).map((d) => ({
            name: d.name,
            from: d.from,
            to: d.version,
            size: classifyUpdate(d.from, d.version),
            type: d.dependencyType,
          })),
          fixes_open_security_alert: pr.security,
          required_checks: pr.checks,
          failure_log_excerpts: pr.failures,
          conflicts_with_main: !pr.mergeable,
        },
      ]),
    ),
  };
  const questions = Object.fromEntries(
    prs.map((pr) => [
      `pr${pr.number}`,
      {
        type: 'choice',
        instructions: `Given the policy and the facts for pr${pr.number}, which action should the maintainer take on pr${pr.number}?`,
        criteria: JEV_CHOICES,
      },
    ]),
  );
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Jev API → ${res.status}`);
  return (await res.json()).answers ?? {};
}

async function merge(pr) {
  // sha を固定: 判定後に head が差し替わっていたら 409 で失敗する
  await gh(`/repos/${repo}/pulls/${pr.number}/merge`, {
    method: 'PUT',
    body: { sha: pr.sha, merge_method: 'squash' },
  });
}

// 月内 2 回目以降の実行は、新たにマージがあったときだけ追記する (同じ表を毎日積まない)
async function publishReport(markdown, merged) {
  const title = `Dependabot 月次判断 ${new Date().toISOString().slice(0, 7)}`;
  const open = await gh(`/repos/${repo}/issues?state=open&labels=dependencies&per_page=100`);
  const existing = open.find((i) => i.title === title && !i.pull_request);
  if (existing && merged === 0) return;
  if (existing) {
    await gh(`/repos/${repo}/issues/${existing.number}/comments`, { method: 'POST', body: { body: markdown } });
  } else {
    await gh(`/repos/${repo}/issues`, { method: 'POST', body: { title, body: markdown, labels: ['dependencies'] } });
  }
}

const lines = [`## Dependabot ${mode}${dryRun ? ' (dry run)' : ''}`, ''];
const say = (line) => {
  console.log(line);
  lines.push(line);
};
let failed = false;

const ci = await mainCiState();
const pulls = (await gh(`/repos/${repo}/pulls?state=open&base=main&per_page=100`)).filter(
  (pr) => pr.user.login === DEPENDABOT && pr.user.type === 'Bot',
);

if (pulls.length === 0) {
  say('open な Dependabot PR はありません。');
} else {
  const openAlerts = (await gh(`/repos/${repo}/dependabot/alerts?state=open&per_page=100`)).map((a) => ({
    ecosystem: a.dependency.package.ecosystem,
    package: a.dependency.package.name,
    firstPatched: a.security_vulnerability.first_patched_version?.identifier ?? null,
  }));
  const prs = [];
  for (const pr of pulls) prs.push(await collect(pr, openAlerts));

  if (mode === 'monthly') {
    try {
      const answers = await askJev(prs);
      for (const pr of prs) pr.jev = answers[`pr${pr.number}`];
    } catch (e) {
      // Jev が使えなければ何もマージしない (fail closed)
      say(`⚠️ Jev に問い合わせできませんでした: ${e.message}`);
      failed = true;
    }
  }

  say('| PR | 結果 | 理由 | Jev の判定 |');
  say('|---|---|---|---|');
  let merged = 0;
  for (const pr of prs) {
    const decision = decide(mode, pr);
    let result = decision.merge ? 'マージ' : '保留';
    if (decision.merge) {
      if (ci !== 'success') {
        result = '保留';
        decision.reason += ` — ただし main の CI が ${ci} のため見送り`;
      } else if (mode === 'security' && merged >= 1) {
        result = '次回';
        decision.reason += ' — 1 回の実行で 1 件まで';
      } else {
        try {
          if (!dryRun) await merge(pr);
          merged++;
        } catch (e) {
          // 409 = 判定後に head が差し替わった (Dependabot の rebase)。次回の実行で拾えば足りる。
          // それ以外は放置すると自動化が黙って止まるのでジョブを失敗させる。405 は直後の競合でも返るが、
          // ruleset に拒否されたとき (bypass の設定ミス) も 405 なので無害扱いしない
          const benign = e.status === 409;
          result = benign ? '次回' : '失敗';
          decision.reason += ` — ${e.message}`;
          if (!benign) failed = true;
        }
      }
    }
    const jev = pr.jev ? `${pr.jev.choice} (${pr.jev.probabilities?.[pr.jev.choice] ?? '?'})` : '—';
    say(`| #${pr.number} ${pr.title} | ${result} | ${decision.reason} | ${jev} |`);
  }

  if (mode === 'monthly' && !dryRun) await publishReport(lines.join('\n'), merged);
}

// main が赤いまま自動マージを続けない。ジョブを失敗させて GitHub の通知メールで気づけるようにする
if (ci === 'failure') {
  say('');
  say('❌ main の CI が失敗しています。自動マージを停止しました。');
  failed = true;
}

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
process.exit(failed ? 1 : 0);
