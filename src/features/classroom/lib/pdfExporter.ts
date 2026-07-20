import type { ClassroomProfile, GeneratedOutputs, QuantityOverrides } from "../types";
import {
  auditoriumRearFillSpeakerLabels,
  ceilingAcousticTreatmentLabels,
  echoObservationLabels,
  floorMaterialLabels,
  furnishingDensityLabels,
  glassCoverageLabels,
  podiumPositionLabels,
  softTreatmentLabels,
  wallMaterialLabels
} from "../data/initialProfile";
import { getRoomArea } from "./drawingEngine";
import { getAmplificationScopeText, getLegacyDeviceSummary, getNeedText, getScenarioText } from "./profileText";
import { getSpeakerModelName } from "./speakerRules";
import { svgToPngDataUrl } from "./imageExporter";
import { formatBrandText, getAppBrand } from "../brand";
import { getCustomerPointValidationStatus } from "./pointValidation";
import type { InterfaceWiringUsageRow, RecordingInputSelections } from "./interfaceWiring";

const getInstallationSelector = () => {
  const prefix = getAppBrand().id === "yinman" ? "音曼" : "音翼";
  return `svg[aria-label^="${prefix}"][aria-label$="点位图"]`;
};
const getTopologySelector = () => `svg[aria-label="${getAppBrand().id === "yinman" ? "音曼" : "音翼"}系统拓扑图"]`;
const getInterfaceWiringSelector = () => `svg[aria-label="${getAppBrand().id === "yinman" ? "音曼" : "音翼"}接口接线图"]`;
const isInterfaceWiringEnabled = () => getAppBrand().id === "yinman"
  ? __ENABLE_YINMAN_INTERFACE_WIRING__
  : __ENABLE_YINYI_INTERFACE_WIRING__;
const pdfPageWidthPx = 1240;
const pdfPageHeightPx = 1754;
const pdfPageWidthPt = 595.28;
const pdfPageHeightPt = 841.89;
const interfaceWiringImageScale = 4;
const interfaceWiringPageScale = 2;

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

type ReportTheme = {
  background: string;
  heading: string;
  muted: string;
  ink: string;
  accent: string;
  border: string;
  surface: string;
  tableHeader: string;
  topGradient: string;
  topGradientSoft: string;
  sideGradient: string;
};

const getReportTheme = (): ReportTheme => getAppBrand().id === "yinman"
  ? {
      background: "#f3f7ff",
      heading: "#123a72",
      muted: "#536987",
      ink: "#17243a",
      accent: "#245fc9",
      border: "rgba(171, 193, 232, 0.92)",
      surface: "rgba(250, 252, 255, 0.9)",
      tableHeader: "rgba(233, 241, 255, 0.96)",
      topGradient: "rgba(79, 125, 255, 0.18)",
      topGradientSoft: "rgba(79, 125, 255, 0.04)",
      sideGradient: "rgba(20, 164, 184, 0.1)"
    }
  : {
      background: "#f3faf6",
      heading: "#063f31",
      muted: "#526b62",
      ink: "#0f241e",
      accent: "#087455",
      border: "rgba(185, 216, 200, 0.9)",
      surface: "rgba(248, 253, 250, 0.88)",
      tableHeader: "rgba(232, 248, 240, 0.96)",
      topGradient: "rgba(0, 168, 112, 0.16)",
      topGradientSoft: "rgba(0, 168, 112, 0.04)",
      sideGradient: "rgba(18, 168, 160, 0.13)"
    };

export const exportPdfReport = async (
  profile: ClassroomProfile,
  outputs: GeneratedOutputs,
  quantityOverrides: QuantityOverrides = {},
  recordingInputSelections: RecordingInputSelections = {}
) => {
  const pointMapSvg = document.querySelector<SVGSVGElement>(getInstallationSelector());
  const topologySvg = document.querySelector<SVGSVGElement>(getTopologySelector());
  const pointMapImage = pointMapSvg ? await svgToPngDataUrl(pointMapSvg) : "";
  const topologyImage = topologySvg ? await svgToPngDataUrl(topologySvg) : "";
  let interfaceWiringImage = "";
  let interfaceWiringRows: InterfaceWiringUsageRow[] = [];
  if (isInterfaceWiringEnabled()) {
    const interfaceWiringSvg = await waitForInterfaceWiringSvg();
    interfaceWiringImage = interfaceWiringSvg
      ? await svgToPngDataUrl(interfaceWiringSvg, { scale: interfaceWiringImageScale })
      : "";
    interfaceWiringRows = await buildInterfaceWiringReportRows(profile, outputs, recordingInputSelections);
  }
  const payload = encodeReportPayload({
    version: "2.0",
    exportedAt: new Date().toISOString(),
    importScope: "profile-only",
    profile,
    quantityOverrides
  });
  const pages = await renderReportPages(
    profile,
    outputs,
    pointMapImage,
    topologyImage,
    interfaceWiringImage,
    interfaceWiringRows
  );
  const pdfBlob = buildImagePdf(pages, payload);
  downloadBlob(pdfBlob, `${sanitizeFilename(profile.projectName || getAppBrand().defaultPlanName)}-售前方案报告.pdf`);
};

async function waitForInterfaceWiringSvg() {
  if (!isInterfaceWiringEnabled()) return null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const svg = document.querySelector<SVGSVGElement>(getInterfaceWiringSelector());
    if (svg) return svg;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  return null;
}

async function buildInterfaceWiringReportRows(
  profile: ClassroomProfile,
  outputs: GeneratedOutputs,
  recordingInputSelections: RecordingInputSelections
) {
  if (!isInterfaceWiringEnabled()) return [];
  const { buildInterfaceWiringModel, getInterfaceWiringUsageRows } = await import("./interfaceWiring");
  const brandId = getAppBrand().id;
  const model = buildInterfaceWiringModel({
    profile,
    outputs,
    brandId,
    recordingInputSelections
  });
  return getInterfaceWiringUsageRows(model);
}

async function renderReportPages(
  profile: ClassroomProfile,
  outputs: GeneratedOutputs,
  pointMapImage: string,
  topologyImage: string,
  interfaceWiringImage: string,
  interfaceWiringRows: InterfaceWiringUsageRow[]
) {
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
  if (isInterfaceWiringEnabled()) {
    if (!interfaceWiringImage) throw new Error("接口接线图尚未生成，请稍后重试导出。");
    pages.push(await renderImagePage("接口接线图", interfaceWiringImage, {
      renderScale: interfaceWiringPageScale,
      jpegQuality: 0.98
    }));
    pages.push(...renderInterfaceUsagePages(interfaceWiringRows));
  }

  pages.forEach((canvas, index) => drawPageNumber(canvas, index + 1, pages.length));
  return Promise.all(pages.map(canvasToJpegPage));
}

function createCanvasPage(renderScale = 1): CanvasPage {
  const theme = getReportTheme();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pdfPageWidthPx * renderScale);
  canvas.height = Math.round(pdfPageHeightPx * renderScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 PDF 画布。");
  if (renderScale !== 1) ctx.scale(renderScale, renderScale);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, pdfPageWidthPx, pdfPageHeightPx);
  drawSoftBackground(ctx, theme);
  return { canvas, ctx, y: 0 };
}

function drawSoftBackground(ctx: CanvasRenderingContext2D, theme: ReportTheme) {
  const topGradient = ctx.createLinearGradient(0, 0, 0, 620);
  topGradient.addColorStop(0, theme.topGradient);
  topGradient.addColorStop(0.58, theme.topGradientSoft);
  topGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, pdfPageWidthPx, 740);

  const sideGradient = ctx.createLinearGradient(0, 0, pdfPageWidthPx, 420);
  sideGradient.addColorStop(0, theme.sideGradient);
  sideGradient.addColorStop(0.38, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sideGradient;
  ctx.fillRect(0, 0, pdfPageWidthPx, 520);
}

function drawReportHeader(page: CanvasPage, profile: ClassroomProfile) {
  const theme = getReportTheme();
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  drawCard(page.ctx, 70, 64, 1100, 170);
  drawText(page.ctx, `${getAppBrand().appName} · 售前工程方案`, 100, 104, {
    size: 18,
    weight: 800,
    color: theme.accent,
    maxWidth: 920
  });
  drawText(page.ctx, profile.projectName || getAppBrand().defaultPlanName, 100, 157, {
    size: 40,
    weight: 800,
    color: theme.heading,
    maxWidth: 920
  });
  drawText(page.ctx, generatedAt, 100, 205, {
    size: 20,
    weight: 700,
    color: theme.muted,
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
  const theme = getReportTheme();
  drawText(ctx, title, x, y, { size: 28, weight: 800, color: theme.heading, maxWidth: 900 });
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 24);
  ctx.lineTo(pdfPageWidthPx - x, y + 24);
  ctx.stroke();
}

function drawArchiveBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, label: string, value: string) {
  const theme = getReportTheme();
  roundedRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = theme.surface;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.stroke();
  const textBaseline = y + height / 2 + 6;
  drawText(ctx, label, x + 18, textBaseline, { size: 15, weight: 800, color: theme.muted, maxWidth: 112 });
  drawWrappedText(ctx, value, x + 132, y, width - 150, height, { size: 17, weight: 760, color: theme.ink });
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number) {
  const theme = getReportTheme();
  roundedRect(ctx, 70, y, 1100, 52, 8);
  ctx.fillStyle = theme.tableHeader;
  ctx.fill();
  drawText(ctx, "序号", 96, y + 34, { size: 20, weight: 800, color: theme.accent, maxWidth: 90 });
  drawText(ctx, "设备", 245, y + 34, { size: 20, weight: 800, color: theme.accent, maxWidth: 650 });
  drawText(ctx, "数量", 1030, y + 34, { size: 20, weight: 800, color: theme.accent, maxWidth: 100 });
}

function drawTableRow(ctx: CanvasRenderingContext2D, y: number, index: string, name: string, quantity: string) {
  const theme = getReportTheme();
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.fillRect(70, y, 1100, 58);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, y + 58);
  ctx.lineTo(1170, y + 58);
  ctx.stroke();
  drawText(ctx, index, 96, y + 37, { size: 20, weight: 500, color: theme.ink, maxWidth: 90 });
  drawText(ctx, name, 245, y + 37, { size: 20, weight: 500, color: theme.ink, maxWidth: 700 });
  drawText(ctx, quantity, 1048, y + 37, { size: 20, weight: 700, color: theme.ink, maxWidth: 80 });
}

function getProjectArchiveRows(profile: ClassroomProfile, outputs: GeneratedOutputs): Array<[string, string]> {
  const selectedProcessor = outputs.productSelection.find((item) => item.category === "processor" && item.quantity > 0);
  const rows: Array<[string, string]> = [
    ["项目名称", profile.projectName || "待补充"],
    ["客户名称", profile.customerName || "待补充"],
    ["使用场景", getScenarioText(profile)],
    ["使用需求", getNeedText(profile)],
    ["扩声范围", getAmplificationScopeText(profile)],
    ["房间尺寸", `${profile.roomGeometry.length}m x ${profile.roomGeometry.width}m x ${profile.roomGeometry.height}m`],
    ["房间面积", `${getRoomArea(profile).toFixed(1)} 平方米`],
    ["扩声形态", getSpeakerMode(profile)],
    ["麦克风选型", getSelectionArchiveValue(outputs.solutionSelection.microphone)],
    ["麦克风提示", getSelectionArchiveNote(outputs.solutionSelection.microphone)],
    ["音箱选型", getSelectionArchiveValue(outputs.solutionSelection.speaker)],
    ["音箱提示", getSelectionArchiveNote(outputs.solutionSelection.speaker, outputs.solutionSelection.speaker.requiresSpecialReview)],
    ["处理器选型", selectedProcessor ? formatPublicDeviceName(selectedProcessor.name) : "待确认"],
    ["顶面音箱安装", overheadSpeakerMountingLabels[profile.engineeringConstraints.overheadSpeakerMounting ?? "unknown"]],
    ["吊顶条件", ceilingLabels[profile.engineeringConstraints.ceiling]],
    ["讲台位置", podiumPositionLabels[profile.engineeringConstraints.podiumPosition]],
    [
      "声学风险",
      `${outputs.acousticAssessment.label} / ${outputs.acousticAssessment.source === "measured" ? "实测" : "估算"} RT60 ${outputs.acousticAssessment.estimatedRt.toFixed(2)}s`
    ],
    ["声学环境", getAcousticSummary(profile)],
    ["中央空调", getCentralAirSummary(profile)],
    ["外接设备", getExternalDeviceSummary(profile)],
    ["利旧设备", getLegacyDeviceSummary(profile)],
    ["复勘备注", profile.engineeringConstraints.notes.trim() || "无"]
  ];
  const pointValidationStatus = getCustomerPointValidationStatus(outputs.pointValidation);
  if (pointValidationStatus) {
    rows.push(["方案状态", pointValidationStatus]);
  }
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

function getSelectionArchiveValue(choice: { selectedLabel: string; recommendedLabel: string; isNonRecommended: boolean; userSelected: boolean }) {
  if (choice.isNonRecommended) return `${choice.selectedLabel}（客户选择；系统推荐：${choice.recommendedLabel}）`;
  return choice.userSelected ? `${choice.selectedLabel}（客户选择，与系统推荐一致）` : `${choice.selectedLabel}（系统推荐）`;
}

function getSelectionArchiveNote(
  choice: { selectedLabel: string; isNonRecommended: boolean },
  requiresSpecialReview = false
) {
  const review = requiresSpecialReview ? "需专项复核；" : "";
  if (!choice.isNonRecommended && !requiresSpecialReview) return "采用系统推荐";
  const detail = choice.selectedLabel.includes("线阵麦")
    ? "优势：教师区定向；注意：覆盖宽度与接口容量"
    : choice.selectedLabel.includes("阵列麦")
      ? "优势：全场覆盖与扩展；注意：安装位置与多麦配合"
      : choice.selectedLabel.includes("吸顶")
        ? "优势：覆盖均匀；注意：顶面安装与避让"
        : "优势：安装检修直观；注意：墙面、均匀性与啸叫";
  return `${review}${detail}`;
}

function getSpeakerMode(profile: ClassroomProfile) {
  if (profile.roomGeometry.length <= 0 || profile.roomGeometry.width <= 0) return "待确认";
  return getSpeakerModelName(profile);
}

const overheadSpeakerMountingLabels = {
  available: "可安装",
  unavailable: "不可安装",
  unknown: "待确认"
} as const;

function getAcousticSummary(profile: ClassroomProfile) {
  const acoustic = profile.acousticEnvironment;
  return [
    floorMaterialLabels[acoustic.floorMaterial],
    wallMaterialLabels[acoustic.wallMaterial],
    ceilingAcousticTreatmentLabels[acoustic.ceilingAcousticTreatment ?? "unknown"],
    softTreatmentLabels[acoustic.softTreatment],
    furnishingDensityLabels[acoustic.furnishingDensity],
    glassCoverageLabels[acoustic.glassCoverage ?? (acoustic.hasGlassWall ? "large" : "none")],
    echoObservationLabels[acoustic.echoObservation ?? "unknown"],
    acoustic.measuredRt60 ? `实测 RT60 ${acoustic.measuredRt60.toFixed(2)}s` : ""
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
  return formatPublicReportText(name
    .replace(new RegExp(`YM-?${model}`, "gi"), "教学模拟功放主机")
    .replace(new RegExp(model, "gi"), "教学模拟功放主机"));
}

function formatPublicReportText(value: string) {
  return formatBrandText(value
    .replace(/AJ(?:200|350|600)/gi, "智能音频处理主机")
    .replace(/SA110/gi, "智能线阵麦克风")
    .replace(/RING08/gi, "大圆盘阵麦")
    .replace(/\u7ffc\u6b27/g, "音翼"));
}

const ceilingLabels = {
  suspended: "有吊顶",
  exposed: "无吊顶",
  unknown: "待确认"
} as const;

async function renderImagePage(
  title: string,
  dataUrl: string,
  options: { renderScale?: number; jpegQuality?: number } = {}
) {
  const theme = getReportTheme();
  const page = createCanvasPage(options.renderScale ?? 1);
  page.canvas.dataset.pdfJpegQuality = String(options.jpegQuality ?? 0.94);
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
  page.ctx.strokeStyle = theme.border;
  page.ctx.stroke();
  page.ctx.drawImage(image, boxX + (boxW - drawW) / 2, boxY + (boxH - drawH) / 2, drawW, drawH);
  drawFooter(page);
  return page.canvas;
}

type InterfaceUsageColumnKey = "reference" | "device" | "port" | "interfaceType" | "cable" | "method";

const interfaceUsageColumns: Array<{ key: InterfaceUsageColumnKey; title: string; width: number }> = [
  { key: "reference", title: "编号", width: 70 },
  { key: "device", title: "设备（从 / 到）", width: 200 },
  { key: "port", title: "接口（从 / 到）", width: 175 },
  { key: "interfaceType", title: "接口形式（从 / 到）", width: 210 },
  { key: "cable", title: "线材", width: 105 },
  { key: "method", title: "接线方式", width: 340 }
];

function renderInterfaceUsagePages(rows: InterfaceWiringUsageRow[]) {
  const pages: HTMLCanvasElement[] = [];
  let page = createInterfaceUsagePage(false);
  if (!rows.length) {
    drawText(page.ctx, "当前方案没有可生成的接口占用记录。", 90, page.y + 58, {
      size: 20,
      weight: 700,
      color: getReportTheme().muted,
      maxWidth: 1000
    });
  }

  rows.forEach((row) => {
    const cells = getInterfaceUsageCellLines(page.ctx, row);
    const rowHeight = Math.max(78, Math.max(...Object.values(cells).map((lines) => lines.length)) * 21 + 26);
    if (page.y + rowHeight > pdfPageHeightPx - 105) {
      drawFooter(page);
      pages.push(page.canvas);
      page = createInterfaceUsagePage(true);
    }
    drawInterfaceUsageRow(page.ctx, page.y, rowHeight, cells, row.confirmed);
    page.y += rowHeight;
  });

  drawFooter(page);
  pages.push(page.canvas);
  return pages;
}

function createInterfaceUsagePage(continued: boolean) {
  const page = createCanvasPage();
  drawSectionTitle(page.ctx, continued ? "接口占用表（续）" : "接口占用表", 70, 92);
  page.y = 150;
  drawInterfaceUsageHeader(page.ctx, page.y);
  page.y += 58;
  return page;
}

function drawInterfaceUsageHeader(ctx: CanvasRenderingContext2D, y: number) {
  const theme = getReportTheme();
  ctx.fillStyle = theme.tableHeader;
  ctx.fillRect(70, y, 1100, 58);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(70, y, 1100, 58);
  let x = 70;
  interfaceUsageColumns.forEach((column, index) => {
    if (index > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 58);
      ctx.stroke();
    }
    drawText(ctx, column.title, x + 10, y + 36, {
      size: 15,
      weight: 800,
      color: theme.accent,
      maxWidth: column.width - 20
    });
    x += column.width;
  });
}

function getInterfaceUsageCellLines(ctx: CanvasRenderingContext2D, row: InterfaceWiringUsageRow) {
  const size = 15;
  const weight = 600;
  const width = (key: InterfaceUsageColumnKey) => interfaceUsageColumns.find((column) => column.key === key)!.width - 20;
  const pair = (from: string, to: string, key: InterfaceUsageColumnKey) => [
    ...getWrappedLines(ctx, `从 ${formatPublicReportText(from)}`, width(key), size, weight),
    ...getWrappedLines(ctx, `到 ${formatPublicReportText(to)}`, width(key), size, weight)
  ];
  return {
    reference: [String(row.referenceNumber)],
    device: pair(row.fromDevice, row.toDevice, "device"),
    port: pair(row.fromPort, row.toPort, "port"),
    interfaceType: pair(row.fromInterfaceType, row.toInterfaceType, "interfaceType"),
    cable: getWrappedLines(ctx, formatPublicReportText(row.cableType), width("cable"), size, weight),
    method: getWrappedLines(ctx, formatPublicReportText(row.connectionMethod), width("method"), size, weight)
  } satisfies Record<InterfaceUsageColumnKey, string[]>;
}

function drawInterfaceUsageRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  height: number,
  cells: Record<InterfaceUsageColumnKey, string[]>,
  confirmed: boolean
) {
  const theme = getReportTheme();
  ctx.fillStyle = confirmed ? "rgba(255, 255, 255, 0.88)" : "rgba(255, 248, 230, 0.94)";
  ctx.fillRect(70, y, 1100, height);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(70, y, 1100, height);
  let x = 70;
  interfaceUsageColumns.forEach((column, index) => {
    if (index > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height);
      ctx.stroke();
    }
    ctx.fillStyle = theme.ink;
    ctx.font = `${column.key === "reference" ? 800 : 600} 15px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif`;
    ctx.textBaseline = "alphabetic";
    cells[column.key].forEach((line, lineIndex) => {
      ctx.fillText(line, x + 10, y + 22 + lineIndex * 21, column.width - 20);
    });
    x += column.width;
  });
}

function drawPageNumber(canvas: HTMLCanvasElement, pageNumber: number, totalPages: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawText(ctx, `${pageNumber} / ${totalPages}`, 1080, pdfPageHeightPx - 58, {
    size: 16,
    weight: 800,
    color: getReportTheme().muted,
    maxWidth: 90
  });
}

function drawFooter(page: CanvasPage) {
  const theme = getReportTheme();
  drawText(page.ctx, "本报告仅用于售前方案沟通，方案仅供参考，不包含报价信息；如有疑问，请联系FAE。", 70, pdfPageHeightPx - 58, {
    size: 17,
    weight: 700,
    color: theme.muted,
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

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  height: number,
  options: { size: number; weight: number; color: string }
) {
  let size = options.size;
  let lines = getWrappedLines(ctx, text, maxWidth, size, options.weight);
  while (lines.length > 2 && size > 14) {
    size -= 1;
    lines = getWrappedLines(ctx, text, maxWidth, size, options.weight);
  }
  if (lines.length > 2) {
    lines = [lines[0], fitTextWithEllipsis(ctx, lines.slice(1).join(""), maxWidth)];
  }
  const lineHeight = size + 4;
  const firstBaseline = y + (height - lines.length * lineHeight) / 2 + size;
  ctx.fillStyle = options.color;
  ctx.font = `${options.weight} ${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, index) => ctx.fillText(line, x, firstBaseline + index * lineHeight));
}

function getWrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number) {
  ctx.font = `${weight} ${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif`;
  const lines: string[] = [];
  let line = "";
  Array.from(text).forEach((character) => {
    const candidate = line + character;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  });
  if (line || !lines.length) lines.push(line);
  return lines;
}

function fitTextWithEllipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let value = text;
  while (value && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
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
  const quality = Number(canvas.dataset.pdfJpegQuality ?? 0.94);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PDF 页面生成失败。"))), "image/jpeg", quality);
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
