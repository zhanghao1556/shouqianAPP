import type { ProductRule } from "../types";

const area = (length?: number, width?: number) => (length && width ? length * width : 0);
const pickupCount = (spaceArea: number) => {
  if (!spaceArea) return 0;
  if (spaceArea <= 45) return 1;
  if (spaceArea <= 90) return 2;
  if (spaceArea <= 150) return 3;
  return 4;
};

export const productRules: ProductRule[] = [
  {
    productId: "YM-AJ200",
    name: "音曼智能 AI 音频处理器 AJ200",
    category: "processor",
    matchedScenarios: ["meeting", "classroom"],
    matchedNeeds: ["videoConference", "interactiveClass", "localAmplification", "remoteTeaching"],
    source: "音曼智能AI音频处理器白皮书AJ200.docx / AJ200整机规格书.doc",
    quantityRule: () => 1,
    reason: (profile) =>
      profile.scenario === "meeting" ? "适合中小型会议和远程协作的音频处理核心。" : "适合普通教室的教学扩声与互动课堂音频处理。"
  },
  {
    productId: "YM-AJ600",
    name: "音曼智能 AI 语音主机 AJ600/AJ610",
    category: "processor",
    matchedScenarios: ["lecture", "auditorium", "classroom"],
    matchedNeeds: ["recording", "localAmplification", "interactiveClass", "remoteTeaching"],
    source: "音曼智能AI音频处理器白皮书AJ600.docx / YM-AJ600 &AJ610安装手册.docx",
    quantityRule: () => 1,
    reason: () => "用于较复杂空间的多设备接入、扩声、录播和远程教学音频汇聚。"
  },
  {
    productId: "YM-Ring01",
    name: "Ring01 智能天顶音阵主麦",
    category: "pickup",
    matchedScenarios: ["meeting", "classroom"],
    matchedNeeds: ["videoConference", "interactiveClass", "recording", "remoteTeaching"],
    source: "Ring01整机规格书.doc / YM-Ring01安装手册.docx",
    quantityRule: (profile) => Math.max(1, pickupCount(area(profile.space.length, profile.space.width))),
    reason: () => "适合吊顶安装的天顶拾音，减少桌面设备占用并覆盖发言区域。"
  },
  {
    productId: "YM-Ring02",
    name: "Ring02 智能天顶麦克风从麦",
    category: "pickup",
    matchedScenarios: ["meeting", "classroom", "lecture"],
    matchedNeeds: ["interactiveClass", "recording", "remoteTeaching"],
    source: "Ring02整机规格书.doc / Ring02使用说明书.docx",
    quantityRule: (profile) => Math.max(0, pickupCount(area(profile.space.length, profile.space.width)) - 1),
    reason: () => "与主麦组合扩展拾音覆盖，适合更大教室或多发言区域。"
  },
  {
    productId: "YM-Ring03",
    name: "Ring03 智能降噪麦克风",
    category: "pickup",
    matchedScenarios: ["meeting", "other"],
    matchedNeeds: ["videoConference", "recording"],
    source: "Ring03整机规格书.doc / 音曼智能降噪麦克风白皮书Ring03.docx",
    quantityRule: (profile) => (area(profile.space.length, profile.space.width) <= 50 ? 1 : 2),
    reason: () => "适合会议场景的降噪拾音，降低空调、玻璃反射等环境噪声影响。"
  },
  {
    productId: "YM-DT2-Pro",
    name: "DT2 Pro 智能语音阵列麦克风",
    category: "pickup",
    matchedScenarios: ["classroom", "lecture"],
    matchedNeeds: ["interactiveClass", "recording", "remoteTeaching"],
    source: "DT2 Pro阵列麦说明书.docx / ClassIn Mic DT2 Pro白皮书.docx",
    quantityRule: (profile) => Math.max(1, Math.ceil(area(profile.space.length, profile.space.width) / 70)),
    reason: () => "适合教学空间的阵列拾音，兼顾教师活动区和学生互动声音采集。"
  },
  {
    productId: "YM-SA110",
    name: "SA110 智能线阵麦克风",
    category: "pickup",
    matchedScenarios: ["lecture", "auditorium"],
    matchedNeeds: ["localAmplification", "recording"],
    source: "SA110整机规格书.doc / 智能线阵麦克风SA110白皮书.docx",
    quantityRule: (profile) => Math.max(1, Math.ceil(area(profile.space.length, profile.space.width) / 100)),
    reason: () => "适合较大空间的线阵拾音，兼顾扩声和录播采集。"
  },
  {
    productId: "YY-POWER-AMP",
    name: "教学模拟功放主机",
    category: "amplifier",
    matchedScenarios: ["classroom", "lecture", "auditorium"],
    matchedNeeds: ["localAmplification", "interactiveClass"],
    source: "教学模拟功放主机产品规格书.docx",
    quantityRule: () => 1,
    reason: () => "作为本地扩声链路的功放核心，适合教学扩声和报告厅基础扩声。"
  },
  {
    productId: "YM-MX11",
    name: "音曼教学专用线阵音箱 YM-MX11",
    category: "speaker",
    matchedScenarios: ["classroom", "lecture", "auditorium"],
    matchedNeeds: ["localAmplification", "interactiveClass"],
    source: "音曼教学专用线阵音箱（YM-MX11）规格书.docx",
    quantityRule: (profile) => {
      const spaceArea = area(profile.space.length, profile.space.width);
      if (!spaceArea) return 0;
      return spaceArea > 120 ? 4 : 2;
    },
    reason: () => "提供教室和报告厅前场扩声覆盖，常规采用左右声道或前后补声布置。"
  },
  {
    productId: "YM-AWM301",
    name: "AWM301/WP1 无线手持麦克风系统",
    category: "wireless",
    matchedScenarios: ["classroom", "lecture", "auditorium", "meeting"],
    matchedNeeds: ["wirelessMic", "localAmplification"],
    source: "AWM301_T/R整机规格书.doc / WP1手持麦安装注意事项.docx",
    quantityRule: (profile) => (profile.scenario === "auditorium" ? 2 : 1),
    reason: () => "满足主持、临时发言和互动问答的移动拾音需求。"
  },
  {
    productId: "YY-URO1",
    name: "YY-URO1 USB 网线传输器",
    category: "accessory",
    matchedScenarios: ["meeting", "classroom", "lecture", "auditorium"],
    matchedNeeds: ["videoConference", "recording", "remoteTeaching"],
    source: "YY-URO1 USB网线传输器使用手册.docx",
    quantityRule: (profile) => (profile.space.externalDevices.length > 0 || profile.needs.includes("recording") ? 1 : 0),
    reason: () => "用于延长 USB 或外接设备链路，降低前后场设备布线限制。"
  },
  {
    productId: "YM-LB102",
    name: "LB102 小振膜电容麦克风",
    category: "pickup",
    matchedScenarios: ["auditorium", "other"],
    matchedNeeds: ["recording", "localAmplification"],
    source: "音曼小振膜电容麦克风-LB102参数（铜管）.pdf",
    quantityRule: (profile) => (profile.needs.includes("recording") ? 2 : 0),
    reason: () => "适合作为特殊录音或舞台区域的补充拾音。"
  }
];
