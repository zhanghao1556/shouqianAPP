import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getReleaseVersion } from "./release-version.mjs";

const root = process.cwd();
const version = getReleaseVersion(root);
const brand = getArgValue("--brand") || "yinyi";
const brandConfig = getBrandConfig(brand);
const releasePrefix = `${brandConfig.appName}-${version}`;
const releaseDate = formatReleaseDate(new Date());
const releaseIndex = getNextReleaseIndex(releaseDate);
const releaseLabel = `${releaseDate}-${releaseIndex}`;
const source = path.join(root, "outputs", `${brandConfig.slug}-${version}-release`, `${brandConfig.appName}-${version}.html`);
const outDirName = `${releasePrefix}-${releaseLabel}`;
const outDir = path.join(root, "outputs", outDirName);
const outZip = path.join(root, "outputs", `${outDirName}.zip`);
const outHtml = path.join(outDir, `${brandConfig.appName}-${version}.html`);
const outReadme = path.join(outDir, "README-打开说明.txt");
const productManualFileName = `${brandConfig.appName}-${version}-产品说明书.md`;
const outProductManual = path.join(outDir, productManualFileName);
const mirrorProductManuals = [
  path.join(root, "outputs", productManualFileName),
  path.join(root, "outputs", `${brandConfig.slug}-${version}-release`, productManualFileName)
];
const legacyOutlinePaths = [
  path.join(root, "outputs", `${brandConfig.appName}-${version}-软件大纲.md`),
  path.join(root, "outputs", `${brandConfig.slug}-${version}-release`, `${brandConfig.appName}-${version}-软件大纲.md`)
];

if (!fs.existsSync(source)) {
  throw new Error(`Source single-file release was not found: ${source}`);
}

function formatReleaseDate(date) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function getBrandConfig(value) {
  if (value === "yinman") {
    return {
      id: "yinman",
      slug: "yinman-ai-presales-tool",
      appName: "音曼AI售前工具",
      companyName: "音曼"
    };
  }
  return {
    id: "yinyi",
    slug: "yinyi-ai-presales-tool",
    appName: "音翼AI售前工具",
    companyName: "音翼科技"
  };
}

function getNextReleaseIndex(dateLabel) {
  const outputsDir = path.join(root, "outputs");
  if (!fs.existsSync(outputsDir)) return 1;
  const pattern = new RegExp(`^${escapeRegExp(releasePrefix)}-${dateLabel}-(\\d+)$`);
  const indexes = fs
    .readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(pattern)?.[1])
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let html = fs.readFileSync(source, "utf8");

html = html.replace(
  /<meta name="viewport" content="[^"]*"\s*\/?>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />'
);

if (!html.includes('name="format-detection"')) {
  html = html.replace(
    /(<meta name="viewport" content="[^"]*"\s*\/?>)/,
    '$1\n    <meta name="format-detection" content="telephone=no" />'
  );
}

if (!html.includes('name="theme-color"')) {
  html = html.replace(
    /(<meta name="format-detection" content="telephone=no"\s*\/?>)/,
    '$1\n    <meta name="theme-color" content="#0b5cad" />'
  );
}

html = transformBrandText(html.replace(/<title>.*?<\/title>/, `<title>${brandConfig.appName}</title>`));

html = html.replace(
  '<div id="root"></div>',
  `<div id="root">
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;background:#f5f7fb;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
        <div style="max-width:520px;border:1px solid #dbe3ef;border-radius:16px;background:#fff;padding:24px;box-shadow:0 14px 36px rgba(15,23,42,.08);line-height:1.7;">
          <h1 style="margin:0 0 12px;font-size:22px;">${brandConfig.appName}</h1>
          <p style="margin:0 0 10px;">页面正在加载。如果长时间停留在这里，说明当前预览器限制了本地 HTML 脚本执行。</p>
          <p style="margin:0;">iOS 建议先保存到“文件”再用 Safari 打开；安卓 / 鸿蒙建议用系统浏览器、Chrome、Edge 或华为浏览器打开，不建议长期使用微信 / QQ 文件预览。</p>
        </div>
      </div>
    </div>`
);

const readme = `${brandConfig.appName} ${version} 正式版（${releaseLabel}）

交付文件：
- ${brandConfig.appName}-${version}.html
- ${productManualFileName}

打开方式：
1. 电脑：直接用 Chrome、Edge、Safari 等浏览器打开 HTML 文件。
2. 安卓 / 鸿蒙：用系统浏览器、Chrome、Edge、华为浏览器等打开。
3. iOS：建议先保存到“文件”，再用 Safari 打开。
4. 不建议长期使用微信、QQ 等内置文件预览器，它们可能限制导入报告、导出报告或本地存储。

说明：
- 这是电脑和手机共用的单文件网页。
- 图片、样式和脚本都内置在 HTML 中，不需要安装依赖。
- 导出报告会直接下载 PDF 到浏览器默认下载目录。
- 如需多人稳定访问，后续可以把同一个 HTML 放到 HTTPS 静态网页地址。
`;

const productManual = `# ${brandConfig.appName} 产品说明书

版本：${version}

发布标识：${releaseLabel}

## 1 产品用途

本产品用于智能音频项目的售前信息采集与工程方案输出。用户填写房间、场景、需求、现场条件和已有设备后，可获得设备清单、点位图、系统拓扑图、接口接线图、接口占用表及 PDF 方案报告。

## 2 运行环境

- 电脑端建议使用最新版 Chrome、Edge 或 Safari。
- 安卓 / 鸿蒙建议使用系统浏览器、Chrome、Edge 或华为浏览器。
- iOS 建议先把 HTML 文件保存到“文件”，再用 Safari 打开。
- 单文件版本可离线打开；导入、导出和本地草稿需要浏览器允许文件下载与本地存储。

## 3 基本操作流程

1. 打开“${brandConfig.appName}-${version}.html”。
2. 填写项目名称、客户名称和房间长宽高。
3. 选择使用场景、使用需求、现场条件和外接设备。
4. 查看项目档案完整度与复勘提醒，补齐未确认参数。
5. 核对系统推荐的麦克风、音箱及其他设备数量；有明确现场条件时可手动调整。
6. 依次核对点位图、系统拓扑图、接口接线图和接口占用表。
7. 导出 PDF 报告并保存项目资料。

## 4 主要功能

### 4.1 售前采集

采集使用场景、功能需求、房间尺寸、吊顶与声学条件、已有设备和现场备注。房间尺寸、需求和现场条件会同步影响设备清单与图纸结果。

### 4.2 项目档案

汇总项目、客户、场景、尺寸、扩声范围和声学提示，并显示仍需补充的参数。复勘提醒用于标识可能影响拾音、扩声、安装或接口确认的现场条件。

### 4.3 设备清单

显示当前方案采用的通用设备名称和数量。手动调整数量后，点位图、拓扑图、接线图和接口占用表会按当前方案重新生成。

### 4.4 点位图与系统拓扑图

点位图显示阵列麦克风、音箱和讲台等位置及工程标注；系统拓扑图显示设备之间的信号方向、线材类型和数量。

### 4.5 接口接线图与接口占用表

接口接线图按设备背面接口显示线材两端、编号和接头形式；接口占用表与图中编号一一对应，列出设备、接口、线材和接线方式。

### 4.6 报告与项目数据

导出报告包含项目档案、设备清单和当前图纸。导入由本产品导出的项目资料后，应重新核对项目名称、房间尺寸、需求、数量和全部图纸。

## 5 使用注意事项

- 每次修改房间尺寸、需求、现场条件或设备数量后，都要重新核对全部输出。
- 图纸与清单用于售前方案沟通，最终安装位置、供电、负载和施工条件应结合现场复勘确认。
- 接入原有音频系统、复杂接口或特殊安装结构时，建议联系 FAE 处理。
- 不建议长期使用微信、QQ 等内置文件预览器，以免导入、导出或本地存储受限。

## 6 技术支持

反馈问题时，请同时提供项目参数、问题所在页面、相关图纸和复现步骤，以便快速核对。
`;

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outHtml, transformBrandText(html), "utf8");
fs.writeFileSync(outReadme, transformBrandText(readme), "utf8");
fs.writeFileSync(outProductManual, transformBrandText(productManual), "utf8");
for (const mirrorProductManual of mirrorProductManuals) {
  fs.mkdirSync(path.dirname(mirrorProductManual), { recursive: true });
  fs.writeFileSync(mirrorProductManual, transformBrandText(productManual), "utf8");
}
for (const legacyOutlinePath of legacyOutlinePaths) {
  fs.rmSync(legacyOutlinePath, { force: true });
}
const expectedReleaseFiles = [
  path.basename(outHtml),
  path.basename(outReadme),
  path.basename(outProductManual)
].sort();
const actualReleaseFiles = fs.readdirSync(outDir).sort();
if (JSON.stringify(actualReleaseFiles) !== JSON.stringify(expectedReleaseFiles)) {
  throw new Error(`Unexpected release files: ${actualReleaseFiles.join(", ")}`);
}
writeReleaseZip(outDir, outZip);

console.log(`Universal release dir: ${outDir}`);
console.log(`Universal release zip: ${outZip}`);
console.log(`Universal HTML written: ${outHtml}`);
console.log(`Universal readme written: ${outReadme}`);
console.log(`Universal product manual written: ${outProductManual}`);

function writeReleaseZip(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  const command = `
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath ${quotePowerShell(sourceDir)} -DestinationPath ${quotePowerShell(zipPath)} -CompressionLevel Optimal
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead(${quotePowerShell(zipPath)})
$entryCount = $zip.Entries.Count
$zip.Dispose()
if ($entryCount -ne 3) { throw "Release zip must contain exactly 3 entries: $entryCount" }
`;

  const result = spawnSync("pwsh", ["-NoProfile", "-Command", command], { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    const fallback = spawnSync("powershell", ["-NoProfile", "-Command", command], { stdio: "pipe", encoding: "utf8" });
    if (fallback.status !== 0) {
      throw new Error(`Failed to create release zip:\n${result.stderr || result.stdout}\n${fallback.stderr || fallback.stdout}`);
    }
  }
}

function quotePowerShell(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function transformBrandText(value) {
  if (brandConfig.id !== "yinman") return value;
  return value
    .replace(/DT2 Pro 智能语音阵列麦克风/g, "智能天花阵列麦克风")
    .replace(/DT2 pro 智能语音阵列麦克风/gi, "智能天花阵列麦克风")
    .replace(/DT2 Pro/g, "智能天花阵列麦克风")
    .replace(/智能语音阵列麦克风/g, "智能天花阵列麦克风")
    .replace(/音翼科技/g, "音曼")
    .replace(/音翼/g, "音曼")
    .replace(/Yinyi AI Presales Tool/g, "Yinman AI Presales Tool");
}
