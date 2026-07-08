import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const releaseDate = "260708";
const source = path.join(root, "outputs", "yinyi-ai-presales-tool-1.1-internal-test", "音翼AI售前工具-1.1-内部测试版.html");
const outDirName = `音翼AI售前工具-1.1-内部测试版-${releaseDate}`;
const outDir = path.join(root, "outputs", outDirName);
const outHtml = path.join(outDir, "音翼AI售前工具-1.1.html");
const outReadme = path.join(outDir, "README-打开说明.txt");
const outOutline = path.join(outDir, "音翼AI售前工具-1.1-软件大纲.md");
const mirrorOutlines = [
  path.join(root, "outputs", "音翼AI售前工具-1.1-软件大纲.md"),
  path.join(root, "outputs", "yinyi-ai-presales-tool-1.1-internal-test", "音翼AI售前工具-1.1-软件大纲.md")
];

if (!fs.existsSync(source)) {
  throw new Error(`Source single-file release was not found: ${source}`);
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

html = html.replace(/<title>.*?<\/title>/, "<title>音翼AI售前工具</title>");

html = html.replace(
  '<div id="root"></div>',
  `<div id="root">
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;background:#f5f7fb;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
        <div style="max-width:520px;border:1px solid #dbe3ef;border-radius:16px;background:#fff;padding:24px;box-shadow:0 14px 36px rgba(15,23,42,.08);line-height:1.7;">
          <h1 style="margin:0 0 12px;font-size:22px;">音翼AI售前工具</h1>
          <p style="margin:0 0 10px;">页面正在加载。如果长时间停留在这里，说明当前预览器限制了本地 HTML 脚本执行。</p>
          <p style="margin:0;">iOS 建议先保存到“文件”再用 Safari 打开；安卓 / 鸿蒙建议用系统浏览器、Chrome、Edge 或华为浏览器打开，不建议长期使用微信 / QQ 文件预览。</p>
        </div>
      </div>
    </div>`
);

const readme = `音翼AI售前工具 1.1 内部测试版（${releaseDate}）

交付文件：
- 音翼AI售前工具-1.1.html

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

const outline = `# 音翼AI售前工具软件开发大纲

## 总方向

这套软件最终不是单纯做“方案生成”，而是做成一套完整链路：

售前采集 -> 项目档案 -> 自动方案 -> 点位图 -> 接线拓扑 -> 建设方案 -> 调试参数 -> 现场反馈

后续开发按这条路线控制边界：

- 当前优先保证 1.1 稳定。
- 2.0 开始补工程表达能力。
- 3.0 解决正式文档输出。
- 4.0 做成核心差异化能力。

## 1.1 售前方案基础版

目标：把售前采集、项目档案、方案清单、点位图跑通，形成最小可用闭环。

主要功能：

- 售前信息采集：房间类型、尺寸、吊顶、用途、扩声需求、现有设备、备注。
- 项目档案管理：客户、学校、项目、房间、联系人、现场记录。
- 自动方案清单：根据采集信息生成设备型号、数量、基础说明。
- 点位图输出：展示阵麦、音箱、主机等安装位置。
- 方案校准记录：保留规则判断依据，方便后续修正。

验收标准：能从一个房间的售前信息，生成一套可沟通的初步方案。

当前 1.1 内部测试版发布边界：

- 显示售前采集、项目档案、设备清单、点位图和系统拓扑图。
- 支持导入 / 导出 PDF 报告，导出报告包含项目档案、非零设备清单、点位图、系统拓扑图，并保留可回导的内部校准数据。
- 隐藏校准台、接线图、拓扑图、总文字报告预览、规则变更锁、推荐原因、工程依据和校准依据等内部规则说明。
- 提供电脑 / 手机共用的单文件 HTML，发布包内主文件为“音翼AI售前工具-1.1.html”。

## 2.0 接线与拓扑图版

目标：让方案具备施工指导价值。

新增功能：

- 接线图：展示主机、阵麦、音箱、功放、Line Out、SPK 等连接关系。
- 拓扑图：展示整套系统的信号流和设备结构。
- 接口占用统计：自动说明哪些接口已占用，哪些需要扩展设备。
- 施工备注：线材、安装方式、特殊注意事项。

验收标准：售前方案可以继续流转给施工或技术人员，不需要重新解释系统结构。

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
fs.writeFileSync(outHtml, html, "utf8");
fs.writeFileSync(outReadme, readme, "utf8");
fs.writeFileSync(outOutline, outline, "utf8");
for (const mirrorOutline of mirrorOutlines) {
  fs.mkdirSync(path.dirname(mirrorOutline), { recursive: true });
  fs.writeFileSync(mirrorOutline, outline, "utf8");
}

console.log(`Universal release dir: ${outDir}`);
console.log(`Universal HTML written: ${outHtml}`);
console.log(`Universal readme written: ${outReadme}`);
console.log(`Universal outline written: ${outOutline}`);
