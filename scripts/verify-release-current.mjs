import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getReleaseVersion } from "./release-version.mjs";

const root = process.cwd();
const outputsDir = path.join(root, "outputs");
const distDir = path.join(root, "dist");
const releaseVersion = getReleaseVersion(root);
const requestedBrand = getArgValue("--brand");

const brands = [
  {
    id: "yinyi",
    label: "音翼",
    appName: "音翼AI售前工具",
    slug: "yinyi-ai-presales-tool",
    forbidden: ["音曼", "Yinman AI Presales Tool", "翼欧", "吊麦", "小圆盘阵麦", "音频扩展器", "拟调整预览", "尚未写入正式规则", "内部校准", "内部测试版", "内部测试报告", "张灏", "\uFFFD"],
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
    forbidden: ["音翼", "Yinyi AI Presales Tool", "DT2 Pro", "DT2 pro", "翼欧", "拟调整预览", "尚未写入正式规则", "内部校准", "内部测试版", "内部测试报告", "张灏", "\uFFFD"],
    forbiddenAssets: ["yinyi-tech-logo.svg", "yiou-logo.png", "topology-array-mic.png"]
  }
];

const distCss = readLatestDistCss();
const distWorkspaceTitleRule = extractCssRule(distCss, ".engineeringHeader .workspaceTitle");
const newestSourceStat = newestRelevantSourceStat();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scriptChecks = checkReleaseScripts(packageJson.scripts ?? {});
const selectedBrands = requestedBrand ? brands.filter((brand) => brand.id === requestedBrand) : brands;
if (!selectedBrands.length) throw new Error(`Unknown release brand: ${requestedBrand}`);
const results = selectedBrands.map(verifyBrand);

const summary = {
  releaseVersion,
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
      result.productManualMissingRequired.length > 0 ||
      result.productManualForbiddenMatches.length > 0 ||
      result.readmeForbiddenMatches.length > 0 ||
      !result.releaseFilesAreExact ||
      !result.hasNoSoftwareOutlineFile ||
      !result.readmeIncludesProductManual ||
      !result.releaseHtmlIsFreshForSource ||
      !result.singleFileHtmlIsFreshForSource ||
      !result.readmeIsFreshForSource ||
      !result.productManualIsFreshForSource ||
      !result.headerCssMatchesDist
  )
) {
  process.exitCode = 1;
}

function verifyBrand(brand) {
  const releaseDir = latestReleaseDir(brand.appName);
  const releaseHtmlPath = path.join(releaseDir, `${brand.appName}-${releaseVersion}.html`);
  const readmePath = path.join(releaseDir, "README-打开说明.txt");
  const productManualName = `${brand.appName}-${releaseVersion}-产品说明书.md`;
  const productManualPath = path.join(releaseDir, productManualName);
  const singleFileHtmlPath = path.join(outputsDir, `${brand.slug}-${releaseVersion}-release`, `${brand.appName}-${releaseVersion}.html`);
  const releaseHtml = fs.readFileSync(releaseHtmlPath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8");
  const productManual = fs.readFileSync(productManualPath, "utf8");
  const singleFileHtml = fs.readFileSync(singleFileHtmlPath, "utf8");
  const releaseStat = fs.statSync(releaseHtmlPath);
  const readmeStat = fs.statSync(readmePath);
  const productManualStat = fs.statSync(productManualPath);
  const singleFileStat = fs.statSync(singleFileHtmlPath);
  const expectedReleaseFiles = [
    path.basename(releaseHtmlPath),
    path.basename(readmePath),
    productManualName
  ].sort();
  const releaseFiles = fs.readdirSync(releaseDir).sort();
  const releaseWorkspaceTitleRule = extractCssRule(releaseHtml, ".engineeringHeader .workspaceTitle");
  const required = [
    `<title>${brand.appName}</title>`,
    `window.__YIOU_RELEASE_BUILD__=true`,
    `window.__YIOU_RELEASE_VERSION__="${releaseVersion}"`,
    `window.__APP_BRAND__="${brand.id}"`,
    brand.appName,
    "高端教育空间声学方案",
    ".engineeringHeader .workspaceTitle",
    "viewport-fit=cover",
    "接口接线图",
    "接口占用表"
  ];
  const productManualRequired = [
    `# ${brand.appName} 产品说明书`,
    `版本：${releaseVersion}`,
    "售前采集",
    "项目档案",
    "设备清单",
    "点位图与系统拓扑图",
    "接口接线图与接口占用表",
    "报告与项目数据",
    "联系 FAE"
  ];
  const productManualForbidden = [...brand.forbidden, "软件大纲", "软件开发大纲"];

  return {
    brand: brand.id,
    releaseDir: path.relative(root, releaseDir),
    releaseHtml: path.relative(root, releaseHtmlPath),
    singleFileHtml: path.relative(root, singleFileHtmlPath),
    releaseHtmlIsFreshForSource: releaseStat.mtimeMs >= newestSourceStat.mtimeMs,
    singleFileHtmlIsFreshForSource: singleFileStat.mtimeMs >= newestSourceStat.mtimeMs,
    readmeIsFreshForSource: readmeStat.mtimeMs >= newestSourceStat.mtimeMs,
    productManualIsFreshForSource: productManualStat.mtimeMs >= newestSourceStat.mtimeMs,
    releaseFiles,
    releaseFilesAreExact: JSON.stringify(releaseFiles) === JSON.stringify(expectedReleaseFiles),
    hasNoSoftwareOutlineFile: !releaseFiles.some((name) => name.includes("软件大纲")),
    headerCssMatchesDist: releaseWorkspaceTitleRule === distWorkspaceTitleRule,
    missingRequired: required.filter((token) => !releaseHtml.includes(token)),
    forbiddenMatches: brand.forbidden.filter((token) => releaseHtml.includes(token)),
    forbiddenAssetMatches: findForbiddenAssetMatches(releaseHtml, brand.forbiddenAssets),
    readmeIncludesProductManual: readme.includes(productManualName),
    readmeForbiddenMatches: brand.forbidden.filter((token) => readme.includes(token)),
    productManualMissingRequired: productManualRequired.filter((token) => !productManual.includes(token)),
    productManualForbiddenMatches: productManualForbidden.filter((token) => productManual.includes(token)),
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
    path.join(root, "scripts", "release-version.mjs"),
    path.join(root, "scripts", "bump-release-version.mjs"),
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
  const pattern = new RegExp(`^${escapeRegExp(appName)}-${escapeRegExp(releaseVersion)}-(\\d{6})-(\\d+)$`);
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
  const releaseAll = scripts["release:all"] ?? "";
  const yinyiPackage = scripts["release:package:yinyi"] ?? "";
  const yinmanPackage = scripts["release:package:yinman"] ?? "";
  return {
    yinyiAutoVersionsOnce:
      /bump-release-version\.mjs --brand yinyi/.test(scripts["release:yinyi"] ?? "") &&
      /release:package:yinyi/.test(scripts["release:yinyi"] ?? ""),
    yinmanAutoVersionsOnce:
      /bump-release-version\.mjs --brand yinman/.test(scripts["release:yinman"] ?? "") &&
      /release:package:yinman/.test(scripts["release:yinman"] ?? ""),
    yinyiRebuildsBeforePackaging:
      /npm\.cmd run build/.test(yinyiPackage) &&
      /build-single-file-release\.mjs --brand yinyi/.test(yinyiPackage) &&
      /build-universal-release\.mjs --brand yinyi/.test(yinyiPackage),
    yinmanRebuildsBeforePackaging:
      /npm\.cmd run build/.test(yinmanPackage) &&
      /build-single-file-release\.mjs --brand yinman/.test(yinmanPackage) &&
      /build-universal-release\.mjs --brand yinman/.test(yinmanPackage),
    allAutoVersionsOnce:
      (releaseAll.match(/bump-release-version\.mjs --brand all/g) ?? []).length === 1,
    allRunsBothBrands:
      /release:package:yinyi/.test(releaseAll) &&
      /release:package:yinman/.test(releaseAll),
    allRunsBehaviorParity:
      /verify:release-behavior/.test(releaseAll),
    allVerifiesMatchingBrandDist: [
      "verify:release-current -- --brand yinyi",
      "verify:release-behavior -- --brand yinyi",
      "verify:release-current -- --brand yinman",
      "verify:release-behavior -- --brand yinman"
    ].every((token) => releaseAll.includes(token))
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function findForbiddenAssetMatches(html, assetNames) {
  return assetNames.filter((assetName) => {
    const assetPath = path.join(root, "src", "assets", assetName);
    if (!fs.existsSync(assetPath)) return false;
    const encoded = fs.readFileSync(assetPath).toString("base64");
    return html.includes(encoded) || html.includes(crypto.createHash("sha256").update(fs.readFileSync(assetPath)).digest("hex"));
  });
}
