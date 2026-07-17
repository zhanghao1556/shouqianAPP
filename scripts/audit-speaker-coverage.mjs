import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workDir = resolve(root, "work", "speaker-coverage-audit");
const bundledRunner = resolve(workDir, "speakerCoverageAuditRunner.mjs");

await mkdir(workDir, { recursive: true });
await build({
  entryPoints: [resolve(root, "scripts", "speakerCoverageAuditRunner.ts")],
  outfile: bundledRunner,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  logLevel: "silent"
});

const runner = await import(`${pathToFileURL(bundledRunner).href}?t=${Date.now()}`);
const result = runner.runSpeakerCoverageSweep();
const jsonPath = resolve(workDir, "speaker-coverage-audit.json");
const csvPath = resolve(workDir, "speaker-coverage-audit.csv");
const markdownPath = resolve(workDir, "speaker-coverage-audit.md");
const rootCausePath = resolve(workDir, "speaker-coverage-root-causes.md");
const previewDir = resolve(workDir, "previews");

await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(csvPath, buildCsv(result), "utf8");
await writeFile(markdownPath, buildMarkdown(result), "utf8");

const rootCauseDefinitions = [
  {
    id: "line-ceiling-afc-grid",
    title: "线阵正面扩声吸顶有效行不足",
    previewCaseId: "boundary-052",
    patternId: "ceiling-responsibility-grid",
    matches: (item) => item.coverage?.rootCauseSignature.includes("|line-front|ceiling|") ?? false,
    trigger: "线阵麦采用front180且选择吸顶音箱，第一排保留点位但不承担线阵本地人声。",
    cause: "当前数量仍按包含第一排的总网格计算，第一排失去AFC后没有补足有效听众区行列。",
    proposal: "首排继续保留但不计入有效AFC网格；从听众区前缘按2m半径独立计算有效行列，再叠加首排并复核16只容量。",
    impact: "仅影响线阵front180+吸顶；阵麦、线阵full360和壁挂不变。"
  },
  {
    id: "ceiling-responsibility-grid",
    title: "吸顶音箱总数与责任区排布脱节",
    previewCaseId: "formal-155",
    patternId: "ceiling-responsibility-grid",
    matches: (item) => item.speakerProductOverride === "ceiling" && !(item.coverage?.rootCauseSignature.includes("|line-front|ceiling|") ?? false),
    trigger: "吸顶音箱按总数拆分前排和后排，再分别计算坐标。",
    cause: "总数虽然接近理论值，但浅房前排减列、舞台监听行或后排均分会形成大于有效衔接距离的空隙。",
    proposal: "按主要听众区边界直接计算行列；监听/舞台行单列，不挤占听众区行数；浅房两行向责任区边缘拉开。",
    impact: "影响吸顶点位网格和可能的数量，不改变2m半径、麦位及壁挂规则。"
  },
  {
    id: "meeting-wall-seat-coverage",
    title: "会议室壁挂未按全部坐席闭合覆盖",
    previewCaseId: "formal-008",
    patternId: "meeting-symmetric-zoned-pairs",
    matches: (item) => item.scenario === "meetingRoom" && item.speakerProductOverride === "wall",
    trigger: "会议室壁挂按固定组数生成，没有逐个校核自动会议坐席。",
    cause: "长窄、宽短及接近方形会议室的坐席轴向不同，固定扇区会漏掉桌端或长边坐席。",
    proposal: "先放一组同纵坐标、左右镜像的壁挂并校核全部坐席；不足时沿纵深成对增加左右镜像组；仅在中轴仍有缺口时增加前墙或后墙中轴补声。",
    impact: "仅影响会议室壁挂数量和方向；会议家具、阵麦和吸顶不变。"
  },
  {
    id: "wall-width-responsibility",
    title: "普通壁挂数量主要看纵深，宽房出现连续空区",
    previewCaseId: "boundary-049",
    patternId: "wall-optimized-responsibility",
    matches: (item) => item.speakerProductOverride === "wall" && item.scenario !== "meetingRoom" &&
      !(item.coverage?.rootCauseSignature.includes("|line-front|wall|") ?? false),
    trigger: "普通壁挂数量主要由房间纵深和固定4/6只档位决定。",
    cause: "房宽没有进入85°责任区闭合判断，固定组数不能稳定补齐中后区。",
    proposal: "按对称责任组逐组生成并计算覆盖；宽向不足时增加侧墙组和前后墙中区组，达到阈值即停止；仍不满足则标记壁挂无法完整覆盖并推荐吸顶。",
    impact: "影响阵麦或线阵full360下的壁挂数量、分组和角度；不改变强制选择能力及吸顶规则。"
  }
];

await mkdir(previewDir, { recursive: true });
const rootCauseResults = await buildRootCauseResults(result, runner, previewDir);
await writeFile(rootCausePath, buildRootCauseMarkdown(result, rootCauseResults), "utf8");

console.log(JSON.stringify({
  caseCount: result.caseCount,
  summaryHash: result.summaryHash,
  statusCounts: result.statusCounts,
  clusterCount: result.clusters.length,
  rootCauseCount: rootCauseResults.length,
  jsonPath,
  csvPath,
  markdownPath,
  rootCausePath,
  previewDir
}, null, 2));

async function buildRootCauseResults(result, runner, previewDir) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  try {
    const items = [];
    for (const definition of rootCauseDefinitions) {
      const matchedCases = result.cases.filter((item) => item.coverage && item.coverage.status !== "pass" && definition.matches(item));
      if (!matchedCases.length) continue;
      const transitions = matchedCases.map((item) => {
        const candidate = runner.evaluatePatternCandidatesForCase(item).find((entry) => entry.id === definition.patternId);
        if (!candidate) throw new Error(`Unknown candidate pattern ${definition.patternId} for ${item.id}`);
        const currentSpeakerCount = item.coverage.activeSpeakerIds.length;
        const candidateSpeakerCount = candidate.coverage.activeSpeakerIds.length;
        const addedSpeakerCount = Math.max(0, candidateSpeakerCount - currentSpeakerCount);
        const improvement = item.coverage.primaryListeningArea.uncoveredRatio - candidate.coverage.primaryListeningArea.uncoveredRatio;
        return {
          caseId: item.id,
          currentStatus: item.coverage.status,
          candidateStatus: candidate.coverage.status,
          currentUncoveredRatio: item.coverage.primaryListeningArea.uncoveredRatio,
          candidateUncoveredRatio: candidate.coverage.primaryListeningArea.uncoveredRatio,
          addedSpeakerCount,
          priceGatePassed: addedSpeakerCount === 0 || (item.coverage.status === "fail" && improvement / addedSpeakerCount >= 0.03)
        };
      });
      const converted = transitions.filter((item) => item.candidateStatus === "pass" && item.priceGatePassed);
      const previewTransition = [...converted].sort((a, b) => b.currentUncoveredRatio - a.currentUncoveredRatio)[0]
        ?? [...transitions].sort((a, b) => (b.currentUncoveredRatio - b.candidateUncoveredRatio) - (a.currentUncoveredRatio - a.candidateUncoveredRatio))[0];
      const previewSource = result.cases.find((item) => item.id === (previewTransition?.caseId ?? definition.previewCaseId));
      if (!previewSource) throw new Error(`Unknown preview case for ${definition.id}`);
      const comparison = runner.getCoveragePreviewComparisonForCase(previewSource, definition.patternId);
      const svg = renderComparisonSvg(definition, comparison);
      const svgPath = resolve(previewDir, `${definition.id}.svg`);
      const pngPath = resolve(previewDir, `${definition.id}.png`);
      await writeFile(svgPath, `${svg}\n`, "utf8");
      const page = await browser.newPage({ viewport: { width: 1600, height: 920 }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;background:#f8fafc}</style>${svg}`);
      await page.locator("svg").screenshot({ path: pngPath });
      await page.close();
      items.push({
        ...definition,
        previewCaseId: comparison.caseId,
        caseCount: matchedCases.length,
        failCount: matchedCases.filter((item) => item.status === "fail").length,
        warningCount: matchedCases.filter((item) => item.status === "warning").length,
        brands: unique(matchedCases.map((item) => item.brandId)),
        scenarios: unique(matchedCases.map((item) => item.scenario)),
        minLength: minimum(matchedCases.map((item) => item.room.length)),
        maxLength: maximum(matchedCases.map((item) => item.room.length)),
        minWidth: minimum(matchedCases.map((item) => item.room.width)),
        maxWidth: maximum(matchedCases.map((item) => item.room.width)),
        worstUncoveredRatio: maximum(matchedCases.map((item) => item.coverage.primaryListeningArea.uncoveredRatio)),
        convertedCaseIds: converted.map((item) => item.caseId),
        remainingCaseIds: transitions.filter((item) => item.candidateStatus !== "pass").map((item) => item.caseId),
        priceRejectedCaseIds: transitions.filter((item) => item.candidateStatus === "pass" && !item.priceGatePassed).map((item) => item.caseId),
        previewAddedSpeakerCount: previewTransition?.addedSpeakerCount ?? 0,
        previewContext: getComparisonContext(comparison),
        currentCoverage: comparison.current.coverage,
        candidateCoverage: comparison.candidate.coverage,
        svgPath,
        pngPath
      });
    }
    return items;
  } finally {
    await browser.close();
  }
}

function buildRootCauseMarkdown(result, rootCauses) {
  const categorized = new Set();
  for (const definition of rootCauseDefinitions) {
    result.cases.filter((item) => item.coverage && item.coverage.status !== "pass" && definition.matches(item)).forEach((item) => categorized.add(item.id));
  }
  const auditableIssues = result.cases.filter((item) => item.coverage && item.coverage.status !== "pass");
  const deferredLineWallCases = auditableIssues.filter((item) => item.coverage.rootCauseSignature.includes("|line-front|wall|"));
  const lines = [
    "# 本地扩声音箱覆盖根因与拟调整建议",
    "",
    `- 审计用例：${result.caseCount}；原始问题签名：${result.clusters.length}；通用根因：${rootCauses.length}`,
    `- 已形成候选规则：${categorized.size}/${auditableIssues.length}例；暂缓自动建议：${deferredLineWallCases.length}例。`,
    `- 吸顶音箱连续大面积缺口：${auditableIssues.filter((item) => item.speakerProductOverride === "ceiling").length}例；相切小缝和衰减边缘不触发增配。`,
    `- 已确认短房线阵壁挂基准：${result.cases.filter((item) => item.coverage?.assessmentBasis === "approved-line-array-short-room-layout").length}例；保留原2/3/4只结构，不因网格边缘红区自动增配。`,
    "- 本轮只判定覆盖不全和会议坐席漏覆盖；多重覆盖率保留在JSON/CSV中，不参与失败判定、候选优选或规则建议。",
    "- 价格门槛：只有当前听音区未覆盖超过10%，且每新增1只音箱至少改善3个百分点，才形成自动增配建议。",
    "- 吸顶音箱仍按2m名义半径出图；审计增加0.35m衰减过渡带，连续缺口不足2㎡不告警，达到4㎡才允许判定为大面积缺口。",
    "- 所有候选只存在于审计模拟器，尚未写入5174/5180正式规则。",
    ""
  ];
  for (const [index, item] of rootCauses.entries()) {
    lines.push(
      `## ${index + 1}. ${item.title}`,
      "",
      `- 命中：${item.caseCount}例（失败${item.failCount}、警告${item.warningCount}），品牌：${item.brands.join("、") || "无"}，场景：${item.scenarios.join("、") || "无"}`,
      `- 尺寸：长${formatRange(item.minLength, item.maxLength)}m，宽${formatRange(item.minWidth, item.maxWidth)}m；最差未覆盖${formatPercent(item.worstUncoveredRatio)}`,
      `- 当前触发：${item.trigger}`,
      `- 根因：${item.cause}`,
      `- 建议规则：${item.proposal}`,
      `- 影响范围：${item.impact}`,
      `- 模拟转为覆盖通过：${item.convertedCaseIds.length}/${item.caseCount}例；${item.convertedCaseIds.join("、") || "无"}`,
      `- 因增配收益不足不建议改：${item.priceRejectedCaseIds.length}例；${item.priceRejectedCaseIds.join("、") || "无"}`,
      `- 仍需下一轮处理：${item.remainingCaseIds.length}例；${item.remainingCaseIds.join("、") || "无"}`,
      `- 代表预览：${item.previewCaseId}；${item.previewContext}；当前未覆盖${formatPercent(item.currentCoverage.primaryListeningArea.uncoveredRatio)}、漏覆盖坐席${item.currentCoverage.seatChecks.filter((seat) => !seat.covered).length}个；拟调整未覆盖${formatPercent(item.candidateCoverage.primaryListeningArea.uncoveredRatio)}、漏覆盖坐席${item.candidateCoverage.seatChecks.filter((seat) => !seat.covered).length}个；新增音箱${item.previewAddedSpeakerCount}只`,
      `- 图片：${item.pngPath}`,
      ""
    );
  }
  lines.push(
    "## 暂缓：线阵长房壁挂",
    "",
    `- 案例：${deferredLineWallCases.map((item) => item.id).join("、") || "无"}`,
    "- 房长不超过10m的现有2/3/4只结构已经作为校准基准，不按网格红区自动加音箱。",
    "- 剩余长房案例中，当前候选会为很小的边缘缺口增加后墙或第二组壁挂，安装收益不足，暂不形成规则建议或A/B图。",
    "- 等线阵长房壁挂单独校准后再进入正式候选；本轮不改该分支。",
    ""
  );
  return `${lines.join("\n")}\n`;
}

function renderComparisonSvg(definition, comparison) {
  const width = 1600;
  const height = 920;
  const currentPanel = renderPanel(comparison.profile, comparison.current, comparison.meetingFurniture, 30, 150, 750, 690, "当前正式规则");
  const candidatePanel = renderPanel(comparison.profile, comparison.candidate, comparison.meetingFurniture, 820, 150, 750, 690, "拟调整预览 / 尚未写入正式规则");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="1600" height="920" fill="#f8fafc"/>
    <text x="40" y="48" font-size="27" font-weight="800" fill="#111827">${escapeXml(definition.title)}</text>
    <text x="40" y="82" font-size="16" fill="#334155">代表用例 ${comparison.caseId} · ${escapeXml(getComparisonContext(comparison))}</text>
    <text x="40" y="106" font-size="15" fill="#334155">房间 长${comparison.profile.roomGeometry.length}m × 宽${comparison.profile.roomGeometry.width}m × 高${comparison.profile.roomGeometry.height}m</text>
    <text x="40" y="132" font-size="15" fill="#475569">建议：${escapeXml(definition.proposal)}</text>
    ${currentPanel}
    ${candidatePanel}
    <g transform="translate(40 880)" font-size="14" fill="#334155">
      <rect x="0" y="-13" width="16" height="16" fill="#fecaca"/><text x="24" y="0">未覆盖</text>
      <rect x="100" y="-13" width="16" height="16" fill="#d1fae5"/><text x="124" y="0">已覆盖</text>
      <rect x="220" y="-13" width="16" height="16" fill="#94a3b8"/><text x="244" y="0">不承担线阵本地人声</text>
    </g>
  </svg>`;
}

function renderPanel(profile, data, meetingFurniture, x, y, panelWidth, panelHeight, title) {
  const roomWidth = profile.roomGeometry.width;
  const roomLength = profile.roomGeometry.length;
  const scale = Math.min((panelWidth - 80) / roomWidth, (panelHeight - 110) / roomLength);
  const renderedWidth = roomWidth * scale;
  const renderedHeight = roomLength * scale;
  const roomX = x + (panelWidth - renderedWidth) / 2;
  const roomY = y + 58 + (panelHeight - 100 - renderedHeight) / 2;
  const activeIds = new Set(data.coverage.activeSpeakerIds);
  const heatmap = data.heatmap.map((sample) => {
    const color = sample.coverageCount === 0 ? "#fecaca" : "#d1fae5";
    const size = Math.max(1, 0.25 * scale + 0.35);
    return `<rect x="${roomX + (sample.position.x - 0.125) * scale}" y="${roomY + (sample.position.y - 0.125) * scale}" width="${size}" height="${size}" fill="${color}" opacity="0.82"/>`;
  }).join("");
  const points = data.points.map((point) => {
    const px = roomX + point.position.x * scale;
    const py = roomY + point.position.y * scale;
    if (point.type === "arrayMic") {
      return `<g><circle cx="${px}" cy="${py}" r="7" fill="#2563eb" stroke="#fff" stroke-width="2"/><text x="${px + 10}" y="${py - 8}" font-size="12" font-weight="700" fill="#1e3a8a">麦</text></g>`;
    }
    const active = activeIds.has(point.id);
    const fill = active ? "#f97316" : "#94a3b8";
    const targetLine = point.target ? `<line x1="${px}" y1="${py}" x2="${roomX + point.target.x * scale}" y2="${roomY + point.target.y * scale}" stroke="${fill}" stroke-width="1.5" stroke-dasharray="5 4"/>` : "";
    return `<g>${targetLine}<rect x="${px - 6}" y="${py - 6}" width="12" height="12" fill="${fill}" stroke="#fff" stroke-width="1.5" transform="rotate(45 ${px} ${py})"/><text x="${px + 9}" y="${py + 4}" font-size="11" font-weight="700" fill="#7c2d12">${active ? "音" : "静"}</text></g>`;
  }).join("");
  const furniture = meetingFurniture ? renderMeetingFurniture(meetingFurniture, roomX, roomY, scale) : "";
  const uncovered = formatPercent(data.coverage.primaryListeningArea.uncoveredRatio);
  const uncoveredSeats = data.coverage.seatChecks.filter((seat) => !seat.covered).length;
  return `<g>
    <rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" rx="6" fill="#fff" stroke="#cbd5e1"/>
    <text x="${x + 24}" y="${y + 34}" font-size="19" font-weight="800" fill="#111827">${escapeXml(title)}</text>
    <text x="${x + panelWidth - 24}" y="${y + 34}" text-anchor="end" font-size="14" fill="#334155">未覆盖 ${uncovered} · 漏覆盖坐席 ${uncoveredSeats} · 有效音箱 ${data.coverage.activeSpeakerIds.length}</text>
    <g>${heatmap}${furniture}<rect x="${roomX}" y="${roomY}" width="${renderedWidth}" height="${renderedHeight}" fill="none" stroke="#111827" stroke-width="2"/>${points}</g>
    <text x="${roomX + renderedWidth / 2}" y="${roomY - 10}" text-anchor="middle" font-size="12" fill="#64748b">前墙</text>
  </g>`;
}

function renderMeetingFurniture(layout, roomX, roomY, scale) {
  const tableWidth = (layout.orientation === "top" ? layout.tableWidth : layout.tableLength) * scale;
  const tableHeight = (layout.orientation === "top" ? layout.tableLength : layout.tableWidth) * scale;
  const tableX = roomX + layout.tableCenter.x * scale - tableWidth / 2;
  const tableY = roomY + layout.tableCenter.y * scale - tableHeight / 2;
  const seats = layout.seats.map((seat) => {
    const x = roomX + seat.position.x * scale;
    const y = roomY + seat.position.y * scale;
    return `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="${seat.leader ? "#fbbf24" : "#e2e8f0"}" stroke="#64748b" stroke-width="1"/>`;
  }).join("");
  return `<g opacity="0.72"><rect x="${tableX}" y="${tableY}" width="${tableWidth}" height="${tableHeight}" rx="4" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.2"/>${seats}</g>`;
}

function unique(values) {
  return [...new Set(values)];
}

function getComparisonContext(comparison) {
  const pickupPattern = comparison.current.points.find((point) => point.type === "arrayMic" && point.pickupKind === "lineArray")?.pickupPattern;
  const microphone = comparison.microphoneSolution === "lineArray"
    ? `线阵麦 ${pickupPattern ?? ""}`.trim()
    : "阵列麦";
  return [
    comparison.brandId === "yinman" ? "音曼" : "音翼",
    {
      meetingRoom: "会议室",
      standardClassroom: "普通教室",
      lectureClassroom: "阶梯教室",
      combinedClassroom: "合班教室",
      auditorium: "报告厅",
      other: "其他场景"
    }[comparison.scenario] ?? comparison.scenario,
    comparison.effectiveScope === "full" ? "全场扩声" : "讲台/区域扩声",
    microphone,
    comparison.speakerProductOverride === "ceiling" ? "吸顶音箱" : "壁挂音箱"
  ].join(" · ");
}

function minimum(values) {
  return values.length ? Math.min(...values) : 0;
}

function maximum(values) {
  return values.length ? Math.max(...values) : 0;
}

function formatRange(min, max) {
  return min === max ? String(min) : `${min}-${max}`;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function buildCsv(result) {
  const header = [
    "id", "phase", "brand", "scenario", "requestedScope", "effectiveScope", "microphone", "speaker", "length", "width", "height",
    "status", "assessmentBasis", "speakerCount", "activeSpeakerCount", "uncoveredRatio", "doubleCoverageRatio", "triplePlusCoverageRatio", "uncoveredSeats", "signature"
  ];
  const rows = result.cases.map((item) => [
    item.id,
    item.phase,
    item.brandId,
    item.scenario,
    item.requestedScope,
    item.effectiveScope,
    item.microphoneSolution,
    item.speakerProductOverride,
    item.room.length,
    item.room.width,
    item.room.height,
    item.status,
    item.coverage?.assessmentBasis ?? "",
    item.speakerCount,
    item.activeSpeakerCount,
    item.coverage?.primaryListeningArea.uncoveredRatio ?? "",
    item.coverage?.primaryListeningArea.doubleCoverageRatio ?? "",
    item.coverage?.primaryListeningArea.triplePlusCoverageRatio ?? "",
    item.coverage?.seatChecks.filter((seat) => !seat.covered).length ?? "",
    item.coverage?.rootCauseSignature ?? ""
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function buildMarkdown(result) {
  const lines = [
    "# 本地扩声音箱覆盖自动审计",
    "",
    `- 固定种子：${result.seed}`,
    `- 可重复摘要哈希：\`${result.summaryHash}\``,
    `- 总用例：${result.caseCount}`,
    `- 阶段：${Object.entries(result.phaseCounts).map(([key, value]) => `${key} ${value}`).join("；")}`,
    `- 状态：${Object.entries(result.statusCounts).map(([key, value]) => `${key} ${value}`).join("；")}`,
    `- 问题聚类：${result.clusters.length}`,
    `- 已确认短房线阵壁挂基准：${result.cases.filter((item) => item.coverage?.assessmentBasis === "approved-line-array-short-room-layout").length}例`,
    "- 本轮失败判定只包含覆盖不全和会议坐席漏覆盖；多重覆盖率仅保留在JSON/CSV原始数据。",
    "- 听音区未覆盖≤5%通过，5%-10%警告，>10%失败；侧墙通道、后墙通道和四角非坐席区不纳入。",
    "- 吸顶2m是名义覆盖半径；审计按0.35m衰减过渡带过滤圆形相切处的小缝，并只处理连续大面积缺口。",
    "",
    "## 问题聚类",
    ""
  ];
  for (const [index, cluster] of result.clusters.entries()) {
    lines.push(
      `### ${index + 1}. ${cluster.signature}`,
      "",
      `- 状态：${cluster.status}；样例数：${cluster.caseCount}；品牌：${cluster.brands.join("、")}`,
      `- 尺寸范围：长 ${cluster.minRoom.length}-${cluster.maxRoom.length}m，宽 ${cluster.minRoom.width}-${cluster.maxRoom.width}m，高 ${cluster.minRoom.height}-${cluster.maxRoom.height}m`,
      `- 最差未覆盖：${formatPercent(cluster.worstUncoveredRatio)}；未覆盖坐席：${cluster.uncoveredSeatCount}`,
      `- 代表用例：${cluster.representativeCaseId}`,
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
