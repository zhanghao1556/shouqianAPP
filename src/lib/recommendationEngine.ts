import { needLabels, scenarioLabels } from "../data/questionFlow";
import { productRules } from "../data/products";
import type { DiagramNode, DiagramSpec, GeneratedOutputs, ProjectProfile, QuantityRow } from "../types";
import { getMissingFields, getRiskHints, localAiAdvisor } from "./aiAdvisor";

const area = (profile: ProjectProfile) =>
  profile.space.length && profile.space.width ? profile.space.length * profile.space.width : 0;

const hasNeedMatch = (profile: ProjectProfile, ruleNeeds: string[]) =>
  profile.needs.some((need) => ruleNeeds.includes(need));

export const generateOutputs = (profile: ProjectProfile): GeneratedOutputs => {
  const missingFields = getMissingFields(profile);
  const warnings = [
    ...missingFields.map((field) => `需要补充${field}后，相关计算会更准确。`),
    ...getRiskHints(profile)
  ];

  const selected = productRules
    .filter((rule) => {
      const scenarioMatch = profile.scenario ? rule.matchedScenarios.includes(profile.scenario) : true;
      const needMatch = profile.needs.length ? hasNeedMatch(profile, rule.matchedNeeds) : false;
      return scenarioMatch && needMatch;
    })
    .map((rule) => ({
      productId: rule.productId,
      name: rule.name,
      category: rule.category,
      quantity: rule.quantityRule(profile),
      reason: rule.reason(profile),
      source: rule.source
    }))
    .filter((item) => item.quantity > 0);

  const quantityTable: QuantityRow[] = [
    {
      item: "空间面积",
      quantity: area(profile) ? `${area(profile).toFixed(1)}㎡` : "待确认",
      basis: "由房间长宽计算，影响拾音与音箱数量。"
    },
    ...selected.map((item) => ({
      item: item.name,
      quantity: item.quantity,
      basis: item.reason
    }))
  ];

  const installationMap = buildInstallationMap(profile);
  const wiringDiagram = buildWiringDiagram(profile);
  const topologyDiagram = buildTopologyDiagram(profile);
  const cablingPlan = buildCablingPlan(profile);
  const projectReport = localAiAdvisor.polishReport(buildReport(profile, selected, quantityTable, warnings));

  return {
    productSelection: selected,
    quantityTable,
    installationMap,
    wiringDiagram,
    topologyDiagram,
    cablingPlan,
    projectReport,
    warnings
  };
};

const buildInstallationMap = (profile: ProjectProfile): DiagramSpec => {
  const nodes: DiagramNode[] = [
    { id: "podium", label: "讲台", x: 50, y: 18, kind: "room" as const },
    { id: "processor", label: "音频主机", x: 50, y: 30, kind: "processor" as const },
    { id: "mic1", label: "拾音点 1", x: 35, y: 48, kind: "pickup" as const },
    { id: "mic2", label: "拾音点 2", x: 65, y: 48, kind: "pickup" as const },
    { id: "spkL", label: "左音箱", x: 18, y: 24, kind: "speaker" as const },
    { id: "spkR", label: "右音箱", x: 82, y: 24, kind: "speaker" as const }
  ];

  if (profile.space.acPositions.length > 0) {
    nodes.push({ id: "ac", label: "空调/风口", x: 84, y: 68, kind: "device" as const });
  }
  if (profile.space.glassWalls.length > 0) {
    nodes.push({ id: "glass", label: "玻璃墙", x: 12, y: 56, kind: "room" as const });
  }
  if (profile.needs.includes("wirelessMic")) {
    nodes.push({ id: "wireless", label: "无线手持", x: 50, y: 72, kind: "wireless" as const });
  }

  return {
    title: "安装点位图",
    nodes,
    edges: [],
    note: "按房间俯视图示意点位，正式施工需结合梁位、吊顶、强弱电和声学环境复核。"
  };
};

const buildWiringDiagram = (profile: ProjectProfile): DiagramSpec => ({
  title: "接线图",
  nodes: [
    { id: "mic", label: "拾音设备", x: 16, y: 45, kind: "pickup" },
    { id: "host", label: "AI 音频主机", x: 42, y: 45, kind: "processor" },
    { id: "amp", label: "功放/处理", x: 64, y: 32, kind: "amplifier" },
    { id: "speaker", label: "音箱", x: 86, y: 32, kind: "speaker" },
    { id: "external", label: profile.needs.includes("recording") ? "录播/会议终端" : "电脑/外接设备", x: 72, y: 66, kind: "device" }
  ],
  edges: [
    { from: "mic", to: "host", label: "音频输入" },
    { from: "host", to: "amp", label: "线路输出" },
    { from: "amp", to: "speaker", label: "扬声器线" },
    { from: "host", to: "external", label: "USB/Line/网络" }
  ],
  note: "接线关系为售前示意，接口类型需按最终设备型号确认。"
});

const buildTopologyDiagram = (profile: ProjectProfile): DiagramSpec => ({
  title: "系统拓扑图",
  nodes: [
    { id: "users", label: "教师/参会人", x: 12, y: 50, kind: "room" },
    { id: "pickup", label: "拾音阵列", x: 30, y: 50, kind: "pickup" },
    { id: "core", label: "AI 音频核心", x: 50, y: 50, kind: "processor" },
    { id: "playback", label: "扩声系统", x: 70, y: 34, kind: "speaker" },
    { id: "platform", label: profile.needs.includes("remoteTeaching") ? "远程教学平台" : "会议/录播平台", x: 72, y: 66, kind: "device" },
    { id: "ops", label: "调试/运维", x: 50, y: 82, kind: "device" }
  ],
  edges: [
    { from: "users", to: "pickup", label: "语音" },
    { from: "pickup", to: "core", label: "采集" },
    { from: "core", to: "playback", label: "扩声" },
    { from: "core", to: "platform", label: "音频传输" },
    { from: "ops", to: "core", label: "参数调试" }
  ],
  note: "拓扑用于说明系统角色和数据流，不表示实际端口数量。"
});

const buildCablingPlan = (profile: ProjectProfile) => {
  const plan = [
    "拾音设备至音频主机优先走弱电桥架或吊顶内穿管，避免与强电线缆长距离并行。",
    "音频主机至功放/音箱链路按前场左右声道规划，报告厅或阶梯教室预留后场补声线缆。",
    "外接电脑或视频会议终端靠近主机布置；录播主机按音频线接入，距离较远时复核音频延长方案。",
    "施工完成后进行增益、回声消除、降噪和反馈抑制调试。"
  ];
  if (profile.space.acPositions.length > 0) plan.push("拾音点应避开空调风口，必要时在报告中标注噪声复核点。");
  if (profile.space.glassWalls.length > 0) plan.push("玻璃墙区域建议增加窗帘、软包或调整音箱指向以降低反射声。");
  if (profile.space.ceiling === "no") plan.push("无吊顶空间需采用吊架、壁装或桌面拾音替代方式。");
  return plan;
};

const buildReport = (
  profile: ProjectProfile,
  selected: GeneratedOutputs["productSelection"],
  quantityTable: QuantityRow[],
  warnings: string[]
) => {
  const scenario = profile.scenario ? scenarioLabels[profile.scenario] : "待确认";
  const needs = profile.needs.length ? profile.needs.map((need) => needLabels[need]).join("、") : "待确认";
  const size =
    profile.space.length && profile.space.width && profile.space.height
      ? `${profile.space.length}m x ${profile.space.width}m x ${profile.space.height}m，约 ${area(profile).toFixed(1)}㎡`
      : "待确认";

  return [
    "售前初步项目报告",
    "",
    `一、项目档案：本项目场景为${scenario}，核心需求为${needs}。空间尺寸为${size}。`,
    `二、现场条件：吊顶为${profile.space.ceiling ?? "待确认"}，讲台位置为${profile.space.podium ?? "待确认"}，外接设备为${
      profile.space.externalDevices.length ? profile.space.externalDevices.join("、") : "待确认"
    }。`,
    "三、推荐产品：",
    selected.length
      ? selected.map((item) => `- ${item.name} x ${item.quantity}：${item.reason}`).join("\n")
      : "- 暂无法完整选型，请先补充场景、需求和空间信息。",
    "四、数量依据：",
    quantityTable.map((row) => `- ${row.item}：${row.quantity}，${row.basis}`).join("\n"),
    "五、施工建议：拾音点避开强噪声源，音箱覆盖主要听音区，主机靠近外接设备布置，强弱电分离走线。",
    warnings.length ? `六、风险提示：${warnings.join(" ")}` : "六、风险提示：暂无明显风险，仍建议现场复勘确认。"
  ].join("\n");
};
