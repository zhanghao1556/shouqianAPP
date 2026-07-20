import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const version = "2.0";
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
const outOutline = path.join(outDir, `${brandConfig.appName}-${version}-软件大纲.md`);
const mirrorOutlines = [
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

const outline = `# ${brandConfig.appName}软件开发大纲

## 总方向

这套软件最终不是单纯做“方案生成”，而是做成一套完整链路：

售前采集 -> 项目档案 -> 自动方案 -> 点位图 -> 接线拓扑 -> 建设方案 -> 调试参数 -> 现场反馈

后续开发按这条路线控制边界：

- 当前正式版本为 2.0，重点保证接线、拓扑和报告输出稳定。
- 3.0 解决正式文档输出。
- 4.0 做成核心差异化能力。

## 1.x 售前方案基础版

目标：把售前采集、项目档案、方案清单、点位图跑通，形成最小可用闭环。

主要功能：

- 售前信息采集：房间类型、尺寸、吊顶、用途、扩声需求、现有设备、备注。
- 项目档案管理：客户、学校、项目、房间、联系人、现场记录。
- 自动方案清单：根据采集信息生成设备型号、数量、基础说明。
- 点位图输出：展示阵麦、音箱、主机等安装位置。
- 方案校准记录：保留规则判断依据，方便后续修正。

验收标准：能从一个房间的售前信息，生成一套可沟通的初步方案。

## 2.0 接线、拓扑与报告正式版

目标：让售前方案具备清晰的工程表达和施工沟通价值。

当前 2.0 正式版发布边界：

- 显示售前采集、项目档案、设备清单、点位图、系统拓扑图、接口接线图与接口占用表。
- 支持导入 / 导出 PDF 报告，导出报告包含项目档案、非零设备清单、点位图、系统拓扑图、接口接线图与自动分页的接口占用表，并保留可回导的内部校准数据。
- 接口接线图与接口占用表采用当前页面相同的接口选择和接线结果。
- 接口接线图报告页使用高清输出，放大时仍可辨认端口、线材和端子线芯。
- 隐藏校准台、总文字报告预览、规则变更锁、推荐原因、工程依据和校准依据等内部规则说明。
- 提供电脑 / 手机共用的单文件 HTML，发布包内主文件为“${brandConfig.appName}-${version}.html”。

## 3.0 建设方案生成版

目标：从“单房间方案工具”升级为“完整项目方案工具”。

新增功能：

- 建设方案文档自动生成。
- 多房间、多楼层、多场景汇总。
- 设备清单和项目档案汇总导出。
- 标准方案话术库。
- 项目版本管理和历史记录。
- 不同场景模板：普通教室、合班教室、会议室、报告厅等。

验收标准：能自动生成一份接近正式交付标准的建设方案文档。

## 4.0 售前数据驱动调试版

目标：把售前数据和后期调试打通，形成真正的闭环。

新增功能：

- 根据房间尺寸、混响、材质、使用场景，生成初始调试参数建议。
- 混响大小对应参数建议，比如 AEC、降噪、增益、抑制等级等。
- 阵麦区域自动调整，比如讲台区、学生区、会议桌区、屏蔽区。
- 根据扩声模式自动匹配参数模板。
- 调试参数导出，供现场调试人员使用。
- 现场调试反馈回流，用真实项目反向优化规则。

验收标准：售前录入的信息不仅生成方案，还能直接辅助现场调试。
`;

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outHtml, transformBrandText(html), "utf8");
fs.writeFileSync(outReadme, transformBrandText(readme), "utf8");
fs.writeFileSync(outOutline, transformBrandText(outline), "utf8");
for (const mirrorOutline of mirrorOutlines) {
  fs.mkdirSync(path.dirname(mirrorOutline), { recursive: true });
  fs.writeFileSync(mirrorOutline, transformBrandText(outline), "utf8");
}
writeReleaseZip(outDir, outZip);

console.log(`Universal release dir: ${outDir}`);
console.log(`Universal release zip: ${outZip}`);
console.log(`Universal HTML written: ${outHtml}`);
console.log(`Universal readme written: ${outReadme}`);
console.log(`Universal outline written: ${outOutline}`);

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
if ($entryCount -lt 3) { throw "Release zip has too few entries: $entryCount" }
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
    .replace(/yinyi/g, "yinman")
    .replace(/Yinyi/g, "Yinman")
    .replace(/Yinyi AI Presales Tool/g, "Yinman AI Presales Tool");
}
