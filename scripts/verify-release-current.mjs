import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const outputsDir = path.join(root, "outputs");
const distDir = path.join(root, "dist");

const brands = [
  {
    id: "yinyi",
    label: "音翼",
    appName: "音翼AI售前工具",
    slug: "yinyi-ai-presales-tool",
    forbidden: ["音曼", "Yinman AI Presales Tool", "翼欧", "AP150", "YM-AP150", "ap150", "SA110", "AJ200", "AJ600", "AJ350", "吊麦", "小圆盘阵麦", "音频扩展器", "\uFFFD"],
    forbiddenAssets: [
      "yinman-logo.png",
      "yinman-array-mic-pointmap.png",
      "yinman-array-mic-topology.png",
      "yinman-audio-processor.png",
      "yinman-hanging-mic.png",
      "yinman-hanging-mic-interface-panel.svg",
      "yinman-small-disc-mic.png",
      "yinman-audio-extender.png",
      "yinman-line-array-converter.png"
    ]
  },
  {
    id: "yinman",
    label: "音曼",
    appName: "音曼AI售前工具",
    slug: "yinman-ai-presales-tool",
    forbidden: ["音翼", "Yinyi AI Presales Tool", "DT2 Pro", "DT2 pro", "翼欧", "AP150", "YM-AP150", "ap150", "SA110", "AJ200", "AJ600", "AJ350", "\uFFFD"],
    forbiddenAssets: ["yinyi-tech-logo.svg", "yiou-logo.png", "topology-array-mic.png"]
  }
];

const distCss = readLatestDistCss();
const distWorkspaceTitleRule = extractCssRule(distCss, ".engineeringHeader .workspaceTitle");
const newestSourceStat = newestRelevantSourceStat();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scriptChecks = checkReleaseScripts(packageJson.scripts ?? {});
const results = brands.map(verifyBrand);

const summary = {
  scriptChecks,
  distWorkspaceTitleRule,
  results
};

console.log(JSON.stringify(summary, null, 2));

if (
  Object.values(scriptChecks).some((passed) => !passed) ||
  !distWorkspaceTitleRule ||
  results.some(
    (result) =>
      result.missingRequired.length > 0 ||
      result.forbiddenMatches.length > 0 ||
      result.forbiddenAssetMatches.length > 0 ||
      !result.releaseHtmlIsFreshForSource ||
      !result.singleFileHtmlIsFreshForSource ||
      !result.headerCssMatchesDist
  )
) {
  process.exitCode = 1;
}

function verifyBrand(brand) {
  const releaseDir = latestReleaseDir(brand.appName);
  const releaseHtmlPath = path.join(releaseDir, `${brand.appName}-1.1.html`);
  const singleFileHtmlPath = path.join(outputsDir, `${brand.slug}-1.1-internal-test`, `${brand.appName}-1.1-内部测试版.html`);
  const releaseHtml = fs.readFileSync(releaseHtmlPath, "utf8");
  const singleFileHtml = fs.readFileSync(singleFileHtmlPath, "utf8");
  const releaseStat = fs.statSync(releaseHtmlPath);
  const singleFileStat = fs.statSync(singleFileHtmlPath);
  const releaseWorkspaceTitleRule = extractCssRule(releaseHtml, ".engineeringHeader .workspaceTitle");
  const required = [
    `<title>${brand.appName}</title>`,
    `window.__YIOU_RELEASE_BUILD__=true`,
    `window.__APP_BRAND__="${brand.id}"`,
    brand.appName,
    "高端教育空间声学方案",
    ".engineeringHeader .workspaceTitle",
    "viewport-fit=cover"
  ];

  return {
    brand: brand.id,
    releaseDir: path.relative(root, releaseDir),
    releaseHtml: path.relative(root, releaseHtmlPath),
    singleFileHtml: path.relative(root, singleFileHtmlPath),
    releaseHtmlIsFreshForSource: releaseStat.mtimeMs >= newestSourceStat.mtimeMs,
    singleFileHtmlIsFreshForSource: singleFileStat.mtimeMs >= newestSourceStat.mtimeMs,
    headerCssMatchesDist: releaseWorkspaceTitleRule === distWorkspaceTitleRule,
    missingRequired: required.filter((token) => !releaseHtml.includes(token)),
    forbiddenMatches: brand.forbidden.filter((token) => releaseHtml.includes(token)),
    forbiddenAssetMatches: findForbiddenAssetMatches(releaseHtml, brand.forbiddenAssets),
    releaseWorkspaceTitleRule
  };
}

function readLatestDistCss() {
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    throw new Error("dist/assets not found. Run npm.cmd run build before release verification.");
  }
  const cssFiles = fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith(".css"))
    .map((name) => path.join(assetsDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!cssFiles.length) {
    throw new Error("No built CSS file found in dist/assets.");
  }
  return fs.readFileSync(cssFiles[0], "utf8");
}

function newestRelevantSourceStat() {
  const candidates = [
    path.join(root, "src"),
    path.join(root, "scripts", "build-single-file-release.mjs"),
    path.join(root, "scripts", "build-universal-release.mjs"),
    path.join(root, "package.json"),
    path.join(root, "index.html")
  ];
  const files = candidates.flatMap((candidate) => collectFiles(candidate));
  if (!files.length) {
    throw new Error("No relevant source files found.");
  }
  return files
    .map((file) => fs.statSync(file))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const current = path.join(target, entry.name);
    if (entry.isDirectory()) return collectFiles(current);
    if (entry.isFile() && /\.(?:ts|tsx|js|mjs|css|html|json|svg|png)$/i.test(entry.name)) return [current];
    return [];
  });
}

function latestReleaseDir(appName) {
  const pattern = new RegExp(`^${escapeRegExp(appName)}-1\\.1-内部测试版-(\\d{6})-(\\d+)$`);
  const matches = fs
    .readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(pattern);
      return match ? { name: entry.name, date: Number(match[1]), index: Number(match[2]) } : undefined;
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date || b.index - a.index);
  if (!matches.length) {
    throw new Error(`No release directory found for ${appName}.`);
  }
  return path.join(outputsDir, matches[0].name);
}

function extractCssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\{[^}]+\\}`));
  return match?.[0] ?? "";
}

function checkReleaseScripts(scripts) {
  return {
    yinyiRebuildsBeforePackaging:
      /npm\.cmd run build/.test(scripts["release:yinyi"] ?? "") &&
      /build-single-file-release\.mjs --brand yinyi/.test(scripts["release:yinyi"] ?? "") &&
      /build-universal-release\.mjs --brand yinyi/.test(scripts["release:yinyi"] ?? ""),
    yinmanRebuildsBeforePackaging:
      /npm\.cmd run build/.test(scripts["release:yinman"] ?? "") &&
      /build-single-file-release\.mjs --brand yinman/.test(scripts["release:yinman"] ?? "") &&
      /build-universal-release\.mjs --brand yinman/.test(scripts["release:yinman"] ?? ""),
    allRunsBothBrands:
      /release:yinyi/.test(scripts["release:all"] ?? "") &&
      /release:yinman/.test(scripts["release:all"] ?? ""),
    allRunsBehaviorParity:
      /verify:release-behavior/.test(scripts["release:all"] ?? "")
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findForbiddenAssetMatches(html, assetNames) {
  return assetNames.filter((assetName) => {
    const assetPath = path.join(root, "src", "assets", assetName);
    if (!fs.existsSync(assetPath)) return false;
    const encoded = fs.readFileSync(assetPath).toString("base64");
    return html.includes(encoded) || html.includes(crypto.createHash("sha256").update(fs.readFileSync(assetPath)).digest("hex"));
  });
}
