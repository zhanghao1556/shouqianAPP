import type { ClassroomProfile, GeneratedOutputs, QuantityOverrides } from "../types";
import { auditoriumRearFillSpeakerLabels, floorMaterialLabels, podiumPositionLabels, softTreatmentLabels, wallMaterialLabels } from "../data/initialProfile";
import { getRoomArea } from "./drawingEngine";
import { getAmplificationScopeText, getLegacyDeviceSummary, getNeedText, getScenarioText } from "./profileText";
import { getSpeakerModelName } from "./speakerRules";
import { svgToPngDataUrl } from "./imageExporter";
import { formatBrandText, getAppBrand } from "../brand";

const getInstallationSelector = () => {
  const prefix = getAppBrand().id === "yinman" ? "音曼" : "音翼";
  return `svg[aria-label="${prefix}阵列麦与音箱点位图"], svg[aria-label="${prefix}阵列麦点位图"]`;
};
const getTopologySelector = () => `svg[aria-label="${getAppBrand().id === "yinman" ? "音曼" : "音翼"}系统拓扑图"]`;
const pdfPageWidthPx = 1240;
const pdfPageHeightPx = 1754;
const pdfPageWidthPt = 595.28;
const pdfPageHeightPt = 841.89;

type ReportPage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type CanvasPage = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  y: number;
};

export const exportPdfReport = async (profile: ClassroomProfile, outputs: GeneratedOutputs, quantityOverrides: QuantityOverrides = {}) => {
  const pointMapSvg = document.querySelector<SVGSVGElement>(getInstallationSelector());
  const topologySvg = document.querySelector<SVGSVGElement>(getTopologySelector());
  const pointMapImage = pointMapSvg ? await svgToPngDataUrl(pointMapSvg) : "";
  const topologyImage = topologySvg ? await svgToPngDataUrl(topologySvg) : "";
  const payload = encodeReportPayload({
    version: "1.1-internal-test",
    exportedAt: new Date().toISOString(),
    importScope: "profile-only",
    profile,
    quantityOverrides
  });
  const pages = await renderReportPages(profile, outputs, pointMapImage, topologyImage);
  const pdfBlob = buildImagePdf(pages, payload);
  downloadBlob(pdfBlob, `${sanitizeFilename(profile.projectName || getAppBrand().defaultPlanName)}-内部测试报告.pdf`);
};

async function renderReportPages(profile: ClassroomProfile, outputs: GeneratedOutputs, pointMapImage: string, topologyImage: string) {
  const pages: HTMLCanvasElement[] = [];
  let page = createCanvasPage();
  drawReportHeader(page, profile);
  drawProjectArchive(page, profile, outputs);
  page.y = drawEquipmentTable(page, outputs, pages);
  drawFooter(page);
  pages.push(page.canvas);

  if (pointMapImage) {
    pages.push(await renderImagePage("点位图", pointMapImage));
  }
  if (topologyImage) {
    pages.push(await renderImagePage("系统拓扑图", topologyImage));
  }

  return Promise.all(pages.map(canvasToJpegPage));
}

function createCanvasPage(): CanvasPage {
  const canvas = document.createElement("canvas");
  canvas.width = pdfPageWidthPx;
  canvas.height = pdfPageHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 PDF 画布。");
  ctx.fillStyle = "#f3faf6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawSoftBackground(ctx);
  return { canvas, ctx, y: 0 };
}

function drawSoftBackground(ctx: CanvasRenderingContext2D) {
  const topGradient = ctx.createLinearGradient(0, 0, 0, 620);
  topGradient.addColorStop(0, "rgba(0, 168, 112, 0.16)");
  topGradient.addColorStop(0.58, "rgba(0, 168, 112, 0.04)");
  topGradient.addColorStop(1, "rgba(0, 168, 112, 0)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, pdfPageWidthPx, 740);

  const sideGradient = ctx.createLinearGradient(0, 0, pdfPageWidthPx, 420);
  sideGradient.addColorStop(0, "rgba(18, 168, 160, 0.13)");
  sideGradient.addColorStop(0.38, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sideGradient;
  ctx.fillRect(0, 0, pdfPageWidthPx, 520);
}

function drawReportHeader(page: CanvasPage, profile: ClassroomProfile) {
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  drawCard(page.ctx, 70, 64, 1100, 170);
  drawText(page.ctx, profile.projectName || getAppBrand().defaultPlanName, 100, 136, {
    size: 42,
    weight: 800,
    color: "#063f31",
    maxWidth: 920
  });
  drawText(page.ctx, generatedAt, 100, 190, {
    size: 22,
    weight: 700,
    color: "#526b62",
    maxWidth: 920
  });
  page.y = 280;
}

function drawProjectArchive(page: CanvasPage, profile: ClassroomProfile, outputs: GeneratedOutputs) {
  drawSectionTitle(page.ctx, "项目档案", 70, page.y);
  page.y += 52;
  const rows = getProjectArchiveRows(profile, outputs);
  rows.forEach((row, index) => {
    const x = 70 + (index % 2) * 560;
    const y = page.y + Math.floor(index / 2) * 76;
    drawArchiveBox(page.ctx, x, y, 520, 58, row[0], row[1]);
  });
  page.y += Math.ceil(rows.length / 2) * 76 + 28;
}

function drawEquipmentTable(page: CanvasPage, outputs: GeneratedOutputs, pages: HTMLCanvasElement[]) {
  drawSectionTitle(page.ctx, "设备清单", 70, page.y);
  page.y += 58;
  drawTableHeader(page.ctx, page.y);
  page.y += 52;

  const visibleItems = outputs.productSelection.filter((item) => item.quantity > 0);
  if (!visibleItems.length) {
    drawTableRow(page.ctx, page.y, "-", "当前未配置数量大于 0 的设备", "-");
    return page.y + 92;
  }

  visibleItems.forEach((item, index) => {
    if (page.y > pdfPageHeightPx - 190) {
      drawFooter(page);
      pages.push(page.canvas);
      page.canvas = createCanvasPage().canvas;
      const ctx = page.canvas.getContext("2d");
      if (!ctx) throw new Error("无法创建 PDF 画布。");
      page.ctx = ctx;
      page.y = 90;
      drawSectionTitle(page.ctx, "设备清单", 70, page.y);
      page.y += 58;
      drawTableHeader(page.ctx, page.y);
      page.y += 52;
    }
    drawTableRow(page.ctx, page.y, String(index + 1), formatPublicDeviceName(item.name), String(item.quantity));
    page.y += 58;
  });

  return page.y + 28;
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number) {
  drawText(ctx, title, x, y, { size: 28, weight: 800, color: "#063f31", maxWidth: 900 });
  ctx.strokeStyle = "rgba(185, 216, 200, 0.95)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 24);
  ctx.lineTo(pdfPageWidthPx - x, y + 24);
  ctx.stroke();
}

function drawArchiveBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, label: string, value: string) {
  roundedRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = "rgba(248, 253, 250, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(185, 216, 200, 0.9)";
  ctx.stroke();
  const textBaseline = y + height / 2 + 6;
  drawText(ctx, label, x + 18, textBaseline, { size: 15, weight: 800, color: "#526b62", maxWidth: 112 });
  drawText(ctx, value, x + 132, textBaseline, { size: 17, weight: 760, color: "#0f241e", maxWidth: width - 150 });
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number) {
  roundedRect(ctx, 70, y, 1100, 52, 8);
  ctx.fillStyle = "rgba(232, 248, 240, 0.96)";
  ctx.fill();
  drawText(ctx, "序号", 96, y + 34, { size: 20, weight: 800, color: "#087455", maxWidth: 90 });
  drawText(ctx, "设备", 245, y + 34, { size: 20, weight: 800, color: "#087455", maxWidth: 650 });
  drawText(ctx, "数量", 1030, y + 34, { size: 20, weight: 800, color: "#087455", maxWidth: 100 });
}

function drawTableRow(ctx: CanvasRenderingContext2D, y: number, index: string, name: string, quantity: string) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.fillRect(70, y, 1100, 58);
  ctx.strokeStyle = "rgba(185, 216, 200, 0.86)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, y + 58);
  ctx.lineTo(1170, y + 58);
  ctx.stroke();
  drawText(ctx, index, 96, y + 37, { size: 20, weight: 500, color: "#0f241e", maxWidth: 90 });
  drawText(ctx, name, 245, y + 37, { size: 20, weight: 500, color: "#0f241e", maxWidth: 700 });
  drawText(ctx, quantity, 1048, y + 37, { size: 20, weight: 700, color: "#0f241e", maxWidth: 80 });
}

function getProjectArchiveRows(profile: ClassroomProfile, outputs: GeneratedOutputs): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["项目名称", profile.projectName || "待补充"],
    ["客户名称", profile.customerName || "待补充"],
    ["使用场景", getScenarioText(profile)],
    ["使用需求", getNeedText(profile)],
    ["扩声范围", getAmplificationScopeText(profile)],
    ["房间尺寸", `${profile.roomGeometry.length}m x ${profile.roomGeometry.width}m x ${profile.roomGeometry.height}m`],
    ["房间面积", `${getRoomArea(profile).toFixed(1)} 平方米`],
    ["扩声形态", getSpeakerMode(profile)],
    ["吊顶条件", ceilingLabels[profile.engineeringConstraints.ceiling]],
    ["讲台位置", podiumPositionLabels[profile.engineeringConstraints.podiumPosition]],
    ["声学风险", outputs.acousticAssessment.label],
    ["声学环境", getAcousticSummary(profile)],
    ["中央空调", getCentralAirSummary(profile)],
    ["外接设备", getExternalDeviceSummary(profile)],
    ["利旧设备", getLegacyDeviceSummary(profile)],
    ["复勘备注", profile.engineeringConstraints.notes.trim() || "无"]
  ];
  if (profile.scenario === "auditorium") {
    rows.splice(8, 0, ["舞台尺寸", `${profile.engineeringConstraints.stageSize.width}m x ${profile.engineeringConstraints.stageSize.depth}m`]);
  }
  if (profile.scenario === "combinedClassroom") {
    rows.splice(8, 0, [
      "上课区尺寸",
      `${profile.engineeringConstraints.teachingAreaSize.width}m x ${profile.engineeringConstraints.teachingAreaSize.depth}m`
    ]);
  }
  return rows;
}

function getSpeakerMode(profile: ClassroomProfile) {
  if (profile.roomGeometry.length <= 0 || profile.roomGeometry.width <= 0) return "待确认";
  return getSpeakerModelName(profile);
}

function getAcousticSummary(profile: ClassroomProfile) {
  const acoustic = profile.acousticEnvironment;
  return [
    floorMaterialLabels[acoustic.floorMaterial],
    wallMaterialLabels[acoustic.wallMaterial],
    softTreatmentLabels[acoustic.softTreatment],
    furnishingDensityLabels[acoustic.furnishingDensity],
    acoustic.hasGlassWall ? "有玻璃墙" : ""
  ]
    .filter(Boolean)
    .join(" / ");
}

function getCentralAirSummary(profile: ClassroomProfile) {
  const count = profile.engineeringConstraints.hasCentralAirConditioner ? profile.engineeringConstraints.centralAirConditionerCount : 0;
  return count > 0 ? `${count} 台` : "无";
}

function getExternalDeviceSummary(profile: ClassroomProfile) {
  const items = [
    profile.existingDevices.recordingHost.trim(),
    profile.existingDevices.computer.trim(),
    profile.existingDevices.legacyWirelessMic.trim(),
    profile.scenario === "auditorium" ? auditoriumRearFillSpeakerLabels[profile.engineeringConstraints.auditoriumRearFillSpeakers ?? "unknown"] : ""
  ].filter(Boolean);
  return items.length ? items.join("；") : "无";
}

function formatPublicDeviceName(name: string) {
  const model = ["A", "P", "150"].join("");
  return formatBrandText(name
    .replace(new RegExp(`YM-?${model}`, "gi"), "教学模拟功放主机")
    .replace(new RegExp(model, "gi"), "教学模拟功放主机")
    .replace(/\u7ffc\u6b27/g, "音翼"));
}

const ceilingLabels = {
  suspended: "有吊顶",
  exposed: "无吊顶",
  unknown: "待确认"
} as const;

const furnishingDensityLabels = {
  empty: "空旷",
  normal: "正常",
  dense: "较密集",
  unknown: "待确认"
} as const;

async function renderImagePage(title: string, dataUrl: string) {
  const page = createCanvasPage();
  drawSectionTitle(page.ctx, title, 70, 92);
  const image = await loadImage(dataUrl);
  const boxX = 70;
  const boxY = 150;
  const boxW = 1100;
  const maxBoxH = 1450;
  const scale = Math.min((boxW - 36) / image.naturalWidth, (maxBoxH - 36) / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const boxH = Math.min(maxBoxH, drawH + 36);
  roundedRect(page.ctx, boxX, boxY, boxW, boxH, 12);
  page.ctx.fillStyle = "#ffffff";
  page.ctx.fill();
  page.ctx.strokeStyle = "rgba(185, 216, 200, 0.9)";
  page.ctx.stroke();
  page.ctx.drawImage(image, boxX + (boxW - drawW) / 2, boxY + (boxH - drawH) / 2, drawW, drawH);
  drawFooter(page);
  return page.canvas;
}

function drawFooter(page: CanvasPage) {
  drawText(page.ctx, "本报告仅用于内部售前方案沟通，方案仅供参考，不包含报价信息；如有疑问，请联系张灏。", 70, pdfPageHeightPx - 58, {
    size: 17,
    weight: 700,
    color: "#526b62",
    maxWidth: 1080
  });
}

function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  roundedRect(ctx, x, y, width, height, 16);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.stroke();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { size: number; weight: number; color: string; maxWidth: number }
) {
  ctx.fillStyle = options.color;
  ctx.font = `${options.weight} ${options.size}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y, options.maxWidth);
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("报告图片加载失败。"));
    image.src = dataUrl;
  });
}

async function canvasToJpegPage(canvas: HTMLCanvasElement): Promise<ReportPage> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PDF 页面生成失败。"))), "image/jpeg", 0.94);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height
  };
}

function buildImagePdf(pages: ReportPage[], metadata: string) {
  const objectCount = 2 + pages.length * 3;
  const pageIds = pages.map((_, index) => 3 + index * 3);
  const objects: Uint8Array[] = [];
  objects[0] = ascii(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects[1] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const content = ascii(`q\n${pdfPageWidthPt} 0 0 ${pdfPageHeightPt} 0 0 cm\n/${imageName} Do\nQ\n`);
    objects[pageId - 1] = ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfPageWidthPt} ${pdfPageHeightPt}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    objects[contentId - 1] = wrapStream(content);
    objects[imageId - 1] = wrapStream(
      page.bytes,
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>`
    );
  });

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [0];
  let cursor = chunks[0].length;

  objects.forEach((object, index) => {
    offsets[index + 1] = cursor;
    const prefix = ascii(`${index + 1} 0 obj\n`);
    const suffix = ascii("\nendobj\n");
    chunks.push(prefix, object, suffix);
    cursor += prefix.length + object.length + suffix.length;
  });

  const xrefOffset = cursor;
  const xrefRows = offsets.map((offset, index) => (index === 0 ? "0000000000 65535 f " : `${offset.toString().padStart(10, "0")} 00000 n `));
  const trailer = [
    "xref",
    `0 ${objectCount + 1}`,
    ...xrefRows,
    "trailer",
    `<< /Size ${objectCount + 1} /Root 1 0 R /Info << /Producer (${getAppBrand().reportProducer}) /Keywords (${metadata}) >> >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");
  chunks.push(ascii(trailer));
  return new Blob(chunks as unknown as BlobPart[], { type: "application/pdf" });
}

function wrapStream(bytes: Uint8Array, dictionary?: string) {
  const header = dictionary ?? `<< /Length ${bytes.length} >>`;
  return concatBytes(ascii(`${header}\nstream\n`), bytes, ascii("\nendstream"));
}

function concatBytes(...chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function ascii(value: string) {
  return new TextEncoder().encode(value);
}

function encodeReportPayload(value: unknown) {
  const json = JSON.stringify(value);
  const binary = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
  return btoa(binary).split("").reverse().join("");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || getAppBrand().defaultPlanName;
}
