import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const fixtureRoot = path.join(root, "work", "release-pipeline-contract");
const outputsDir = path.join(fixtureRoot, "outputs");
const bumpScript = path.join(root, "scripts", "bump-release-version.mjs");
const packageScript = path.join(root, "scripts", "build-universal-release.mjs");
const brands = [
  {
    id: "yinyi",
    slug: "yinyi-ai-presales-tool",
    appName: "音翼AI售前工具",
    forbidden: "音曼"
  },
  {
    id: "yinman",
    slug: "yinman-ai-presales-tool",
    appName: "音曼AI售前工具",
    forbidden: "音翼"
  }
];

fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(outputsDir, { recursive: true });

try {
  writePackageFiles("2.0.0");
  for (const brand of brands) createPublishedReleaseMarker(brand, "2.0");

  const firstPreparation = runJson(bumpScript, ["--brand", "all"]);
  assert.equal(firstPreparation.action, "bump");
  assert.equal(firstPreparation.packageVersion, "2.1.0");
  assert.equal(readPackageJson().version, "2.1.0");
  assert.equal(readPackageLock().version, "2.1.0");
  assert.equal(readPackageLock().packages[""].version, "2.1.0");

  createPublishedReleaseMarker(brands[0], "2.1");
  const interruptedRetry = runJson(bumpScript, ["--brand", "all", "--dry-run"]);
  assert.equal(interruptedRetry.action, "reuse");
  assert.equal(interruptedRetry.packageVersion, "2.1.0");

  createPublishedReleaseMarker(brands[1], "2.1");
  const nextFormalRelease = runJson(bumpScript, ["--brand", "all", "--dry-run"]);
  assert.equal(nextFormalRelease.action, "bump");
  assert.equal(nextFormalRelease.packageVersion, "2.2.0");

  for (const brand of brands) {
    writeSingleFileSource(brand, "2.1");
    run(packageScript, ["--brand", brand.id]);
    verifyReleasePackage(brand, "2.1");
  }

  console.log("PASS release versioning is automatic and interrupted retries are idempotent");
  console.log("PASS release packages contain HTML, README and product manual only");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function writePackageFiles(version) {
  const packageJson = { name: "release-contract-fixture", version, private: true };
  const lockJson = {
    name: packageJson.name,
    version,
    lockfileVersion: 3,
    requires: true,
    packages: { "": { name: packageJson.name, version } }
  };
  fs.writeFileSync(path.join(fixtureRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(fixtureRoot, "package-lock.json"), `${JSON.stringify(lockJson, null, 2)}\n`, "utf8");
}

function createPublishedReleaseMarker(brand, version) {
  const releaseName = `${brand.appName}-${version}-260101-1`;
  const releaseDir = path.join(outputsDir, releaseName);
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.writeFileSync(path.join(releaseDir, `${brand.appName}-${version}.html`), "fixture", "utf8");
  fs.writeFileSync(path.join(outputsDir, `${releaseName}.zip`), "fixture", "utf8");
}

function writeSingleFileSource(brand, version) {
  const sourceDir = path.join(outputsDir, `${brand.slug}-${version}-release`);
  fs.mkdirSync(sourceDir, { recursive: true });
  const source = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${brand.appName}</title>
  </head>
  <body><div id="root"></div></body>
</html>`;
  fs.writeFileSync(path.join(sourceDir, `${brand.appName}-${version}.html`), source, "utf8");
}

function verifyReleasePackage(brand, version) {
  const pattern = new RegExp(`^${escapeRegExp(brand.appName)}-${escapeRegExp(version)}-\\d{6}-\\d+$`);
  const releaseDirs = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
    .map((entry) => path.join(outputsDir, entry.name))
    .filter((releaseDir) => fs.existsSync(path.join(releaseDir, `${brand.appName}-${version}-产品说明书.md`)));
  assert.equal(releaseDirs.length, 1);
  const releaseDir = releaseDirs[0];
  const manualName = `${brand.appName}-${version}-产品说明书.md`;
  assert.deepEqual(fs.readdirSync(releaseDir).sort(), [
    "README-打开说明.txt",
    `${brand.appName}-${version}.html`,
    manualName
  ].sort());
  const readme = fs.readFileSync(path.join(releaseDir, "README-打开说明.txt"), "utf8");
  const manual = fs.readFileSync(path.join(releaseDir, manualName), "utf8");
  assert.match(readme, new RegExp(escapeRegExp(manualName)));
  assert.match(manual, new RegExp(`# ${escapeRegExp(brand.appName)} 产品说明书`));
  assert.match(manual, new RegExp(`版本：${escapeRegExp(version)}`));
  assert.match(manual, /接口接线图与接口占用表/);
  assert.doesNotMatch(manual, /软件大纲|软件开发大纲/);
  assert.doesNotMatch(manual, new RegExp(escapeRegExp(brand.forbidden)));
  assert.equal(fs.readdirSync(releaseDir).some((name) => name.includes("软件大纲")), false);
}

function runJson(script, args) {
  return JSON.parse(run(script, args));
}

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: fixtureRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${path.basename(script)} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, "package.json"), "utf8"));
}

function readPackageLock() {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, "package-lock.json"), "utf8"));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
