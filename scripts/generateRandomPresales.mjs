import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workDir = resolve(root, "work", "random-presales");
const outputDir = resolve(root, "outputs", "random-presales");
const bundledRunner = resolve(workDir, "randomPresalesRunner.mjs");

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "")
  .replace("T", "_");

const serialize = (value) => JSON.stringify(value, null, 2);

const table = (rows) => {
  if (!rows.length) return "无";
  return rows.map((item) => `- ${item}`).join("\n");
};

await mkdir(workDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

await build({
  entryPoints: [resolve(root, "scripts", "randomPresalesRunner.ts")],
  outfile: bundledRunner,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: false,
  logLevel: "silent"
});

const runner = await import(`${pathToFileURL(bundledRunner).href}?t=${Date.now()}`);
const { profile, outputs, generatedAt } = runner.generateRandomPresalesCase();

const baseName = `random_presales_${timestamp}`;
const profilePath = resolve(outputDir, `${baseName}_采集.json`);
const reportPath = resolve(outputDir, `${baseName}_报告.md`);
const reviewPath = resolve(outputDir, `${baseName}_校准摘要.md`);

const area = profile.roomGeometry.length * profile.roomGeometry.width;
const reviewText = [
  `# 随机售前采集校准摘要`,
  ``,
  `生成时间：${generatedAt}`,
  ``,
  `## 采集样本`,
  ``,
  `- 项目：${profile.projectName}`,
  `- 客户：${profile.customerName}`,
  `- 场景：${profile.scenario}`,
  `- 需求：${profile.needs.join("、")}`,
  `- 尺寸：${profile.roomGeometry.length}m x ${profile.roomGeometry.width}m x ${profile.roomGeometry.height}m，约 ${area.toFixed(1)} 平方米`,
  `- 扩声范围：${profile.amplificationScope}`,
  `- 外接设备：录播/平台=${profile.existingDevices.recordingHost || "无"}；电脑=${profile.existingDevices.computer || "无"}；原扩声=${profile.existingDevices.legacySoundSystem || "无"}；原无线麦=${profile.existingDevices.legacyWirelessMic || "无"}`,
  ``,
  `## 系统输出摘要`,
  ``,
  `- 是否满足生成条件：${outputs.isFinalReady ? "是" : "否"}`,
  `- 音频模式：${outputs.audioPlan.mode}`,
  `- 声学判断：${outputs.acousticAssessment.label}`,
  `- 推荐产品：${outputs.productSelection.map((item) => `${item.name} x ${item.quantity}`).join("；") || "无"}`,
  `- 点位数量：${outputs.generatedPoints.length}`,
  `- 接线条目：${outputs.connectionLines.length}`,
  ``,
  `## 风险提示`,
  ``,
  table(outputs.riskItems),
  ``,
  `## 复勘确认项`,
  ``,
  table(outputs.reviewItems),
  ``,
  `## 交付文件`,
  ``,
  `- 采集 JSON：${profilePath}`,
  `- 方案报告：${reportPath}`
].join("\n");

await writeFile(profilePath, `${serialize(profile)}\n`, "utf8");
await writeFile(reportPath, `${outputs.reportText}\n`, "utf8");
await writeFile(reviewPath, `${reviewText}\n`, "utf8");

console.log(JSON.stringify({ profilePath, reportPath, reviewPath }, null, 2));
