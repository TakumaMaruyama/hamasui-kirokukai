import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, mkdir, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const RUNS = 3;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const invocationDirectory = process.cwd();
const [baselineFlag, baselineArgument] = process.argv.slice(2);
if (baselineFlag !== "--baseline" || !baselineArgument || process.argv.length !== 4) {
  console.error("Usage: node scripts/benchmark-historical-docs.mjs --baseline <previous-repository-directory>");
  process.exit(1);
}

const BASELINE_ROOT = path.resolve(invocationDirectory, baselineArgument);
try {
  await Promise.all([
    stat(path.join(BASELINE_ROOT, "lib", "ranking-report.ts")),
    stat(path.join(BASELINE_ROOT, "lib", "pdf.tsx"))
  ]);
} catch {
  console.error(`Baseline directory is missing lib/ranking-report.ts or lib/pdf.tsx: ${BASELINE_ROOT}`);
  process.exit(1);
}

process.chdir(PROJECT_ROOT);
const TARGET_MONTH_START = new Date("2025-09-01T00:00:00.000Z");
const TARGET_MONTH_END = new Date("2025-10-01T00:00:00.000Z");
const EVENTS = [
  ["15m板キック", 15, "板キック"],
  ["15m板クロール", 15, "クロール"],
  ["15mクロール", 15, "クロール"],
  ["30mクロール", 30, "クロール"],
  ["15m平泳ぎ", 15, "平泳ぎ"],
  ["30m平泳ぎ", 30, "平泳ぎ"]
];

function compileSource(sourceRoot, outputDirectory) {
  execFileSync(
    path.join(PROJECT_ROOT, "node_modules", ".bin", "tsc"),
    [
      "--outDir",
      outputDirectory,
      "--rootDir",
      sourceRoot,
      "--module",
      "commonjs",
      "--target",
      "es2022",
      "--moduleResolution",
      "node",
      "--jsx",
      "react",
      "--esModuleInterop",
      "--skipLibCheck",
      "--noEmitOnError",
      "false",
      path.join(sourceRoot, "lib", "ranking-report.ts"),
      path.join(sourceRoot, "lib", "pdf.tsx")
    ],
    { cwd: PROJECT_ROOT, stdio: "inherit" }
  );
}

async function loadBenchmarkImplementations() {
  const compileDirectory = await mkdtemp(path.join(os.tmpdir(), "hamasui-historical-compile-"));
  const beforeDirectory = path.join(compileDirectory, "before");
  const afterDirectory = path.join(compileDirectory, "after");
  const baselineSourceDirectory = path.join(compileDirectory, "baseline-source");
  await mkdir(beforeDirectory);
  await mkdir(afterDirectory);
  await mkdir(baselineSourceDirectory);
  // Copy only the code under comparison, excluding dependencies, build output, and secrets.
  await cp(path.join(BASELINE_ROOT, "lib"), path.join(baselineSourceDirectory, "lib"), { recursive: true });

  const sharedNodeModules = path.join(PROJECT_ROOT, "node_modules");
  await symlink(sharedNodeModules, path.join(baselineSourceDirectory, "node_modules"), "dir");
  compileSource(baselineSourceDirectory, beforeDirectory);
  compileSource(PROJECT_ROOT, afterDirectory);

  await Promise.all([
    symlink(sharedNodeModules, path.join(beforeDirectory, "node_modules"), "dir"),
    symlink(sharedNodeModules, path.join(afterDirectory, "node_modules"), "dir")
  ]);

  const requireCompiled = createRequire(path.join(PROJECT_ROOT, "scripts", "benchmark-historical-docs.cjs"));
  const beforeRanking = requireCompiled(path.join(beforeDirectory, "lib", "ranking-report.js"));
  const afterRanking = requireCompiled(path.join(afterDirectory, "lib", "ranking-report.js"));
  const beforePdf = requireCompiled(path.join(beforeDirectory, "lib", "pdf.js"));
  const afterPdf = requireCompiled(path.join(afterDirectory, "lib", "pdf.js"));

  return {
    buildBefore: beforeRanking.buildHistoricalFirstChallengeGroups,
    buildAfter: afterRanking.buildHistoricalFirstChallengeGroups,
    renderBefore: beforePdf.renderChallengeRankingPdf,
    renderAfter: afterPdf.renderChallengeRankingPdf
  };
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function formatTime(timeMs) {
  const seconds = Math.floor(timeMs / 1000);
  const centiseconds = Math.floor((timeMs % 1000) / 10);
  return `00:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function createResults(count) {
  const random = createRandom(0xc08c5a1);
  const results = [];

  for (let index = 0; index < count; index += 1) {
    const [title, distanceM, style] = EVENTS[index % EVENTS.length];
    const grade = index % 10;
    const gender = index % 3 === 0 ? "female" : "male";
    const dayOffset = Math.floor(random() * 273);
    const heldOn = new Date(Date.UTC(2025, 0, 1 + dayOffset));
    const timeMs = 12000 + Math.floor(random() * 24000);

    results.push({
      timeMs,
      timeText: formatTime(timeMs),
      athlete: { id: `athlete-${index % 500}`, fullName: `選手 ${String(index % 500).padStart(3, "0")}` },
      event: { title, distanceM, style, grade, gender },
      meet: { heldOn }
    });
  }

  return results;
}

function options() {
  return {
    targetMonthStart: TARGET_MONTH_START,
    targetMonthEnd: TARGET_MONTH_END,
    gradeRangeMode: "existing",
    gradeSequence: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    excludeOtherGender: true
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function measureSyncPair(runBefore, runAfter) {
  runBefore();
  runAfter();

  const beforeElapsed = [];
  const afterElapsed = [];
  let beforeValue;
  let afterValue;
  for (let iteration = 0; iteration < RUNS; iteration += 1) {
    const order = iteration % 2 === 0
      ? [["before", runBefore], ["after", runAfter]]
      : [["after", runAfter], ["before", runBefore]];
    for (const [kind, run] of order) {
      const start = performance.now();
      const value = run();
      if (kind === "before") {
        beforeValue = value;
        beforeElapsed.push(performance.now() - start);
      } else {
        afterValue = value;
        afterElapsed.push(performance.now() - start);
      }
    }
  }
  return {
    before: { medianMs: median(beforeElapsed), value: beforeValue },
    after: { medianMs: median(afterElapsed), value: afterValue }
  };
}

async function measureAsyncPair(runBefore, runAfter) {
  await runBefore();
  await runAfter();

  const beforeElapsed = [];
  const afterElapsed = [];
  let beforeValue;
  let afterValue;
  for (let iteration = 0; iteration < RUNS; iteration += 1) {
    const order = iteration % 2 === 0
      ? [["before", runBefore], ["after", runAfter]]
      : [["after", runAfter], ["before", runBefore]];
    for (const [kind, run] of order) {
      const start = performance.now();
      const value = await run();
      if (kind === "before") {
        beforeValue = value;
        beforeElapsed.push(performance.now() - start);
      } else {
        afterValue = value;
        afterElapsed.push(performance.now() - start);
      }
    }
  }
  return {
    before: { medianMs: median(beforeElapsed), value: beforeValue },
    after: { medianMs: median(afterElapsed), value: afterValue }
  };
}

function assertEquivalent(before, after, count) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`${count}件のcanonical入力で旧新の集計出力が一致しません`);
  }
}

async function runForCount(count, implementations) {
  const results = createResults(count);
  const build = measureSyncPair(
    () => implementations.buildBefore(results, options()),
    () => implementations.buildAfter(results, options())
  );
  const beforeBuild = build.before;
  const afterBuild = build.after;
  assertEquivalent(beforeBuild.value, afterBuild.value, count);

  const periodLabel = "2025年9月 歴代1位記録一覧";
  const pdf = await measureAsyncPair(
    () => implementations.renderBefore({ periodLabel, groups: beforeBuild.value, highlightLegend: "NEW はこの月に新しく歴代1位になった記録", rankRange: { min: 1, max: 1 } }),
    () => implementations.renderAfter({ periodLabel, groups: afterBuild.value, highlightLegend: "NEW はこの月に新しく歴代1位になった記録", rankRange: { min: 1, max: 1 } })
  );
  const beforePdf = pdf.before;
  const afterPdf = pdf.after;

  const artifactDirectory = path.join(os.tmpdir(), "hamasui-historical-benchmark");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(path.join(artifactDirectory, `after-${count}.pdf`), afterPdf.value);
  await writeFile(path.join(artifactDirectory, `before-${count}.pdf`), beforePdf.value);

  return {
    count,
    beforeBuildMs: beforeBuild.medianMs,
    afterBuildMs: afterBuild.medianMs,
    beforePdfMs: beforePdf.medianMs,
    afterPdfMs: afterPdf.medianMs,
    groups: afterBuild.value.length,
    artifactDirectory
  };
}

const implementations = await loadBenchmarkImplementations();
for (const count of [1000, 10000]) {
  const result = await runForCount(count, implementations);
  console.log(JSON.stringify(result));
}
