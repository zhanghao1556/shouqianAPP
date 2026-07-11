import { classroomProductRules } from "../data/productCatalog";
import {
  ceilingAcousticTreatmentLabels,
  echoObservationLabels,
  floorMaterialLabels,
  furnishingDensityLabels,
  glassCoverageLabels,
  softTreatmentLabels,
  wallMaterialLabels
} from "../data/initialProfile";
import type {
  AcousticAssessment,
  AudioPlan,
  ClassroomProfile,
  CompletenessItem,
  EngineeringBasis,
  GeneratedOutputs,
  GeneratedPoint,
  InstallationGuideItem,
  ProductRecommendation,
  QuantityOverrides
} from "../types";
import { needsAuditoriumRearFillSpeakers } from "./auditoriumRules";
import { generateConnectionLines } from "./connectionRules";
import {
  ARRAY_MIC_ONLINE_PICKUP_RADIUS_M,
  generateEngineeringPoints,
  getArrayMicEffectiveAmplificationRadius,
  getArrayMicInstallAdvice,
  getArrayMicInstallLabel,
  getEffectiveAmplificationScope,
  getMeetingWallSpeakerCenterFillPairCount,
  getRequiredArrayMicCountForFullRoomAmplification,
  getRoomArea,
  hasValidGeometry,
  isOversizedForFullRoomAmplification,
  shouldGenerateNewSpeakers
} from "./drawingEngine";
import { getAmplificationScopeText, getLegacyDeviceSummary, getLegacySoundSystemText, getNeedText, getScenarioText } from "./profileText";
import { getAcousticAssessment } from "./reverberationRules";
import {
  clampSpeakerQuantity,
  EXTERNAL_AMPLIFIER_PRODUCT_ID,
  getExternalAmplifierCountForSpeakers,
  getSpeakerProductId,
  hasRecommendedSpeakerSystemOverflow,
  hasSpeakerCapacityOverflow
} from "./speakerRules";

export { getAcousticAssessment } from "./reverberationRules";

export const getCompleteness = (profile: ClassroomProfile): CompletenessItem[] => [
  {
    key: "projectName",
    label: "项目名称",
    complete: profile.projectName.trim().length > 0,
    blocking: false,
    hint: "用于报告封面和项目档案。"
  },
  {
    key: "scenario",
    label: "使用场景",
    complete: profile.scenario !== "other" || profile.customScenario.trim().length > 0,
    blocking: false,
    hint: "已选择其他场景，请补充自定义场景。"
  },
  {
    key: "needs",
    label: "使用需求",
    complete: profile.needs.length > 0 && (!profile.needs.includes("other") || profile.customNeed.trim().length > 0),
    blocking: false,
    hint: profile.needs.includes("other") ? "已选择其他需求，请补充自定义需求。" : "至少选择一个需求后才能选型。"
  },
  {
    key: "geometry",
    label: "房间长宽高",
    complete: hasValidGeometry(profile),
    blocking: true,
    hint: "缺少尺寸时不生成数量和点位。"
  },
  {
    key: "acoustic",
    label: "现场声学环境",
    complete:
      profile.engineeringConstraints.ceiling !== "unknown" &&
      profile.acousticEnvironment.floorMaterial !== "unknown" &&
      profile.acousticEnvironment.wallMaterial !== "unknown" &&
      profile.acousticEnvironment.softTreatment !== "unknown" &&
      (profile.acousticEnvironment.ceilingAcousticTreatment ?? "unknown") !== "unknown" &&
      (profile.acousticEnvironment.glassCoverage ?? "unknown") !== "unknown" &&
      profile.acousticEnvironment.furnishingDensity !== "unknown",
    blocking: false,
    hint: "确认吊顶、顶面吸声、地面、墙面、软装、玻璃比例和家具布置。"
  },
  {
    key: "external",
    label: "外接设备",
    complete:
      !profile.needs.includes("recording") ||
      Boolean(profile.existingDevices.recordingHost.trim() || profile.existingDevices.computer.trim()),
    blocking: false,
    hint: "选择录播时建议确认录播主机或平台。"
  }
];

export const getAiPrompt = (_profile: ClassroomProfile, completeness: CompletenessItem[], risks: string[]) => {
  const blocking = completeness.filter((item) => item.blocking && !item.complete);
  if (blocking.length > 0) return `先补齐“${blocking[0].label}”：${blocking[0].hint}`;
  if (risks.length > 0) return `方案条件已具备。我发现 ${risks.length} 个需要确认的声场 / 接口点：${risks[0]}`;
  return "音翼阵麦、音箱和接口级图纸已具备生成条件。下方可查看选型、点位图、接线图、拓扑图和报告。";
};

export const generateEngineeringOutputs = (profile: ClassroomProfile, quantityOverrides: QuantityOverrides = {}): GeneratedOutputs => {
  const completeness = getCompleteness(profile);
  const acousticAssessment = getAcousticAssessment(profile);
  const canGenerateCore = hasValidGeometry(profile);
  const defaultPoints = canGenerateCore ? generateEngineeringPoints(profile) : [];
  const defaultProductSelection = canGenerateCore ? ensureMinimumProductSelection(profile, defaultPoints, acousticAssessment, getProductSelection(profile, defaultPoints, acousticAssessment)) : [];
  const productSelection = syncExternalAmplifierSelection(
    profile,
    acousticAssessment,
    applyQuantityOverrides(defaultProductSelection, quantityOverrides)
  );
  const selectedSpeakerProduct = productSelection.find((item) => item.category === "speaker" && item.quantity > 0);
  const selectedSpeakerCount = selectedSpeakerProduct && quantityOverrides[selectedSpeakerProduct.productId] !== undefined ? selectedSpeakerProduct.quantity : undefined;
  const hasManualSpeakerCount = selectedSpeakerCount !== undefined;
  const points = canGenerateCore
    ? generateEngineeringPoints(profile, {
        arrayMicCount: getSelectedArrayMicQuantity(productSelection),
        speakerCount: selectedSpeakerCount,
        speakerProductId: selectedSpeakerProduct && quantityOverrides[selectedSpeakerProduct.productId] !== undefined ? (selectedSpeakerProduct.productId as "CEILING-SPEAKER" | "COLUMN-SPEAKER") : undefined,
        preserveSpeakerCount: hasManualSpeakerCount
      })
    : [];
  const riskItems = getRiskItems(profile, acousticAssessment, points);
  const connectionLines = canGenerateCore ? generateConnectionLines(profile, productSelection) : [];
  const engineeringBasis: EngineeringBasis[] = [];
  const installationGuide: InstallationGuideItem[] = [];
  const audioPlan = getAudioPlan(profile, points, acousticAssessment);
  const reviewItems: string[] = [];
  const drawings = [
    {
      title: "阵麦与音箱点位图",
      type: "installation" as const,
      notes: [
        "按房间尺寸等比例绘制，前方默认为黑板 / 讲台侧，点位需结合门、窗、投影幕、空调出风口和灯具复核。",
        "蓝色点位用于阵列麦拾音，橙色点位用于音箱覆盖；页面可导出 PNG 图片，便于方案沟通和归档。"
      ]
    },
    { title: "接口接线图", type: "wiring" as const, notes: ["按产品资料生成接口级连接关系，无需销售补充线路路径。"] },
    { title: "系统拓扑图", type: "topology" as const, notes: ["展示外接设备、DT 阵列麦、电脑 / 录播平台和音箱之间的系统链路。"] }
  ];
  const report = {
    pdfReportModel: {
      title: profile.projectName || "音翼售前方案",
      subtitle: "内部测试版",
      generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      sections: []
    },
    reportText: ""
  };

  return {
    isFinalReady: canGenerateCore,
    completeness,
    generatedPoints: points,
    connectionLines,
    productSelection,
    engineeringBasis,
    installationGuide,
    audioPlan,
    acousticAssessment,
    riskItems,
    reviewItems,
    drawings,
    pdfReportModel: report.pdfReportModel,
    reportText: report.reportText
  };
};

const getAudioPlan = (profile: ClassroomProfile, points: GeneratedPoint[], acousticAssessment: AcousticAssessment): AudioPlan => {
  const area = getRoomArea(profile);
  const arrayCount = points.filter((point) => point.type === "arrayMic").length;
  const hasOnline = profile.needs.some((need) => ["videoConference", "interactiveClass", "recording", "remoteTeaching"].includes(need));
  const hasLocalAmp = profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");
  const oversizedForFullRoomAmp = isOversizedForFullRoomAmplification(profile);
  const mode = getAudioMode(profile, area, arrayCount);

  return {
    mode,
    summary:
      "本方案以 DT 阵列麦作为课堂音频核心，集成拾音、音频处理和功放能力，结合波束成形、多波束动态跟踪、AFC 反馈抑制、ANS 自动噪声抑制、AEC 回声消除和 AGC 自动增益，减少外置处理设备和复杂布线。",
    pickupGoal: hasOnline
      ? oversizedForFullRoomAmp
        ? `面向远程互动、录播或会议平台，后场以线上拾音为主；线上拾音半径按 ${ARRAY_MIC_ONLINE_PICKUP_RADIUS_M}m 作为点位复核依据，优先保证教师区和后场发言清晰。`
        : "面向远程互动、录播或会议平台，优先保证教师授课区与学生发言区语音清晰，降低反射声和环境噪声对远端听感的影响。"
      : "当前未选择线上采集类需求，拾音主要作为扩声和后续平台接入预留。若后续增加录播或远程互动，需要补充平台接口确认。",
    amplificationGoal: hasLocalAmp
      ? oversizedForFullRoomAmp
        ? `按当前房间尺寸和一主四从上限评估，已超出 5 只阵麦可承担的全场本地扩声范围；本方案优先做${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"}，后排以线上拾音和平台收声为主，避免全场扩声造成声压不均、啸叫余量不足和调试复杂度过高。`
        : getEffectiveAmplificationScope(profile) === "full"
        ? "扩声目标为全教室均匀覆盖，后场补声音箱会影响前后排声压差。"
        : profile.scenario === "auditorium"
          ? "扩声目标以居中舞台区域为主，保证舞台发言和表演声音自然覆盖主要听音区。"
          : "扩声目标以讲台 / 教师活动区为主，保证教师声音自然覆盖主要听音区。"
      : "当前未选择本地扩声需求，音箱输出仅作为可选配置或后续扩展项。",
    areaBoundary: getAreaBoundary(profile, area, arrayCount),
    environmentBoundary: `建议背景噪声不高于 45dBSPL，混响时间控制在 800ms 以内；若采用精品分区均衡扩音模式，建议混响时间控制在 600ms 以内。当前声学评估为：${acousticAssessment.label}。`,
    tuning: [
      "调试前确认 DT 固件和调试软件版本，完成设备联网、供电、USB / 模拟音频链路检查。",
      `按场景选择声场模式：${mode}。需要同时线上采集和本地扩声时，优先选择兼容拾音与扩音的模式。`,
      "先执行一键自适应声场调音，再微调输入、输出、均衡、反馈抑制和噪声抑制参数。",
      "调音完成后保存 Flash / 场景参数；若接入中控或遥控器，现场复核模式切换和音量控制。",
      "验收时分别测试教师常用站位、学生发言区、远端平台声音、本地扩声音量和啸叫余量。"
    ]
  };
};

const getAudioMode = (profile: ClassroomProfile, area: number, arrayCount: number) => {
  if (!profile.needs.includes("localAmplification") && profile.needs.some((need) => ["videoConference", "recording", "remoteTeaching"].includes(need))) {
    return "标准教室单收音方案";
  }
  if (profile.needs.includes("localAmplification") && !profile.needs.some((need) => ["videoConference", "recording", "remoteTeaching"].includes(need))) {
    if (isOversizedForFullRoomAmplification(profile)) return "超出 5 麦上限的讲台扩声方案";
    return area <= 120 && getEffectiveAmplificationScope(profile) === "podium" ? "标准教室单扩音方案" : "标准教室扩音方案";
  }
  if (isOversizedForFullRoomAmplification(profile)) return `超大空间${profile.scenario === "auditorium" ? "舞台" : "讲台"}扩声 + 后场线上拾音方案`;
  if (arrayCount >= 2 || getEffectiveAmplificationScope(profile) === "full") return "精品教室分区均衡扩音方案";
  return "标准教室扩音和收音兼容方案";
};

const getEffectiveAmplificationScopeText = (profile: ClassroomProfile) => {
  const collected = getAmplificationScopeText(profile);
  if (!isOversizedForFullRoomAmplification(profile)) return collected;
  return `${collected}（按 5 麦上限评估，提示无法做全场扩声，建议改为${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"} + 全场线上拾音）`;
};

const getAreaBoundary = (profile: ClassroomProfile, area: number, arrayCount: number) => {
  if (area <= 0) return "待补充房间尺寸后判断声场适用边界。";
  if (area < 60) return "面积小于 60 平方米，DT 阵列麦可用但产品价值不易完全发挥，仍需结合客户预算判断扩声收益。";
  if (area <= 80) return "面积处于 60-80 平方米，适合单麦方案；后排听感和拾音清晰度需在复勘或调试时确认。";
  if (isOversizedForFullRoomAmplification(profile)) {
    return `按房间长宽估算，若坚持全场本地扩声约需 ${getRequiredArrayMicCountForFullRoomAmplification(profile)} 只阵麦，已超过一主四从 5 只上限；提示无法做全场扩声，建议改为${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"} + 全场线上拾音，并按 ${ARRAY_MIC_ONLINE_PICKUP_RADIUS_M}m 线上拾音半径复核。`;
  }
  if (getEffectiveAmplificationScope(profile) === "podium" && !profile.needs.some((need) => ["recording", "videoConference", "interactiveClass"].includes(need))) {
    return profile.scenario === "auditorium"
      ? "当前为舞台区域扩声且无明确线上拾音 / 录播 / 互动需求，默认优先单麦服务舞台区；如后续要求后排发言或全场拾音，再评估补充从麦。"
      : "当前为讲台区域扩声且无明确线上拾音 / 录播 / 互动需求，默认优先单麦服务教师区；如后续要求后排发言或全场拾音，再评估补充从麦。";
  }
  if (profile.roomGeometry.length <= 9) return arrayCount >= 2 ? "房间纵深小于等于约 9m，当前因互动、后排发言或特殊采集需求增加从麦；复勘时重点确认后排座位、两侧座位和啸叫余量。" : "房间纵深小于等于约 9m，主麦安装在前墙约 3m 后，按 5m 最佳理想扩声距离可优先单麦覆盖教师区与主要听音区。";
  if (profile.roomGeometry.length <= 16) return arrayCount >= 2 ? "房间纵深约 9-16m，已增加从麦用于补强中后区；5m 是最佳理想扩声距离而非硬边界，复勘时需重点试听中后区清晰度。" : "房间纵深约 9-16m，当前仍为单麦方案，需现场复核后排听感；若全场扩声、录播或学生发言要求较高，建议评估 2 麦。";
  if (area <= 150) return arrayCount >= 3 ? "房间纵深超过 16m，已按 3 麦级联覆盖前场、中区和后场；需复核中后区发言和两侧座位覆盖。" : "房间纵深超过 16m，中后区与后场座位会影响阵麦数量。";
  return "面积超过 150 平方米，单套 DT 阵列麦和吸顶音箱难以完全覆盖，建议拆分声区或转为专项声场设计。";
};

export const getInstallationGuide = (profile: ClassroomProfile, points: GeneratedPoint[]): InstallationGuideItem[] =>
  points.map((point) => {
    const x = point.position.x.toFixed(1);
    const y = point.position.y.toFixed(1);
    const isMic = point.type === "arrayMic";
    const isWallSpeaker = point.type === "speaker" && point.label.includes("壁挂音柱");
    const isCeilingSpeaker = point.type === "speaker" && point.label.includes("吸顶音箱");
    const isBack = point.id.includes("back");
    const height = isMic
      ? getArrayMicInstallLabel(profile)
      : isCeilingSpeaker && profile.engineeringConstraints.ceiling === "suspended"
        ? `嵌入吊顶 ${point.installHeight ? `${point.installHeight.toFixed(1)}m` : ""}`.trim()
        : point.installHeight
          ? `${point.installHeight.toFixed(1)}m`
          : "按设备安装说明复核";
    const angleText =
      point.horizontalAngle !== undefined && point.downTiltAngle !== undefined
        ? `水平摆角约 ${point.horizontalAngle > 0 ? `左摆 ${point.horizontalAngle}` : point.horizontalAngle < 0 ? `右摆 ${Math.abs(point.horizontalAngle)}` : "正向 0"}°，向下倾斜约 ${point.downTiltAngle}°。`
        : "";
    return {
      id: point.id,
      point: point.label,
      location: `距左墙约 ${x}m，距前墙 / 黑板一体机侧约 ${y}m`,
      installHeight: height,
      orientation: isMic
        ? profile.amplificationScope === "podium"
          ? "阵列麦位于教师主要活动区前方约 0.5-1m，拾音面兼顾授课走动和黑板板书位置；如讲台在左右侧，可小幅偏移但不脱离主活动区。"
          : "阵列麦按主要拾音区域居中覆盖，兼顾讲台、教师走动区和学生发言方向。"
        : isWallSpeaker
          ? `侧墙壁挂安装，支架支持水平和俯仰调节，默认朝向主要听音区，${angleText}`
          : isCeilingSpeaker
          ? "规则房间优先按矩形网格均匀分布，形成均匀扩声覆盖；无感扩声为单声道，不区分左右声道，按前后排顺序分配 SPK1 / SPK2 / SPK3 / SPK4。"
          : isBack
          ? "后场补声音箱朝向学生区前中部，音量作为补声，不压过前场。"
          : "前场音箱朝向主要听音区，单声道分组保持对称覆盖。",
      avoidance: isMic
        ? `${getArrayMicInstallAdvice(profile)}避开投影机、空调出风口、强噪声设备和灯具检修口；不要贴近墙角或门口。`
        : isWallSpeaker
          ? "避开门扇开启范围、窗帘盒、投影幕、玻璃反射面和阵列麦正前方；现场可微调水平摆角和下倾角。"
          : isCeilingSpeaker
          ? "吸顶音箱必须与阵列麦保持 2m 以上距离；每组音箱间距按点位图标注复核。避开灯具、检修口、空调风口、投影机和梁位，现场优先保持规则均布。"
          : "避开门扇开启范围、窗帘盒、投影幕和易啸叫的麦克风正前方。",
      acceptance: isMic
        ? `${point.reason} 复勘时用客户常用站位试讲，确认远端 / 录播端语音清晰。`
        : `${point.reason} 调试时从前排到后排走动听音，确认覆盖均匀且无明显啸叫。`
    };
  });

const getProductSelection = (
  profile: ClassroomProfile,
  points: ReturnType<typeof generateEngineeringPoints>,
  acousticAssessment: AcousticAssessment
): ProductRecommendation[] => {
  const hasLegacySound = Boolean(profile.existingDevices.legacySoundSystem.trim());
  const needsAuditoriumRearFill = needsAuditoriumRearFillSpeakers(profile);
  const speakerProductId = getSpeakerProductId(profile);
  return classroomProductRules
    .filter(
      (rule) =>
        rule.productId === "WIRELESS-HANDHELD" ||
        (rule.category === "speaker" || rule.category === "amplifier"
          ? shouldGenerateNewSpeakers(profile)
          : profile.needs.some((need) => rule.applyWhen.includes(need)))
    )
    .map((rule) => {
      let quantity = 1;
      const arrayCount = points.filter((item) => item.type === "arrayMic").length;
      const speakerCount = points.filter((item) => item.type === "speaker").length;

      if (rule.productId === "DT2-Pro") quantity = Math.max(1, arrayCount);
      if (rule.productId === "CEILING-SPEAKER" || rule.productId === "COLUMN-SPEAKER") {
        quantity = (hasLegacySound && profile.scenario === "auditorium" && !needsAuditoriumRearFill) || rule.productId !== speakerProductId ? 0 : clampSpeakerQuantity(speakerCount);
      }
      if (rule.productId === "WIRELESS-HANDHELD") quantity = profile.existingDevices.legacyWirelessMic.trim() ? 0 : acousticAssessment.risk === "high" ? 1 : 0;
      if (rule.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID) {
        quantity = hasLegacySound && profile.scenario === "auditorium" && !needsAuditoriumRearFill ? 0 : getExternalAmplifierCountForSpeakers(speakerCount);
      }

      return {
        productId: rule.productId,
        name: rule.name,
        category: rule.category,
        quantity,
        why: "",
        where: getWhereText(profile, rule.installation),
        wiring: rule.wiring,
        basis: "",
        missingConfirmation: profile.needs.includes("recording") && !profile.existingDevices.recordingHost ? "需要确认录播主机或平台信息。" : undefined
      };
    });
};

const ensureMinimumProductSelection = (
  profile: ClassroomProfile,
  points: ReturnType<typeof generateEngineeringPoints>,
  _acousticAssessment: AcousticAssessment,
  selection: ProductRecommendation[]
): ProductRecommendation[] => {
  if (selection.length > 0) return selection;
  if (!hasValidGeometry(profile)) return selection;

  const arrayCount = Math.max(1, points.filter((item) => item.type === "arrayMic").length);
  const fallbackProductId = "DT2-Pro";
  const rule = classroomProductRules.find((item) => item.productId === fallbackProductId) ?? classroomProductRules.find((item) => item.productId === "DT2");
  if (!rule) return selection;

  return [
    {
      productId: rule.productId,
      name: rule.name,
      category: rule.category,
      quantity: arrayCount,
      why: "",
      where: getWhereText(profile, rule.installation),
      wiring: rule.wiring,
      basis: "",
      missingConfirmation: "部分采集信息待补充，当前按基础阵列麦方案兜底生成，正式落地前需复勘确认。"
    }
  ];
};

const applyQuantityOverrides = (selection: ProductRecommendation[], overrides: QuantityOverrides): ProductRecommendation[] =>
  selection.map((item) => {
    const override = overrides[item.productId];
    if (override === undefined) return item;
    const quantity = item.category === "speaker" ? clampSpeakerQuantity(override) : Math.max(0, Math.round(override));
    return {
      ...item,
      quantity
    };
  });

const syncExternalAmplifierSelection = (
  profile: ClassroomProfile,
  _acousticAssessment: AcousticAssessment,
  selection: ProductRecommendation[]
): ProductRecommendation[] => {
  const speakerCount = selection.find((item) => item.category === "speaker")?.quantity ?? 0;
  const amplifierCount = shouldGenerateNewSpeakers(profile) ? getExternalAmplifierCountForSpeakers(speakerCount) : 0;
  const selectionWithoutAmplifier = selection.filter((item) => item.productId !== EXTERNAL_AMPLIFIER_PRODUCT_ID);

  const rule = classroomProductRules.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID);
  if (!rule) return selectionWithoutAmplifier;

  return [
    ...selectionWithoutAmplifier,
    {
      productId: rule.productId,
      name: rule.name,
      category: rule.category,
      quantity: amplifierCount,
      why: "",
      where: getWhereText(profile, rule.installation),
      wiring: rule.wiring,
      basis: ""
    }
  ];
};

const getSelectedArrayMicQuantity = (selection: ProductRecommendation[]) =>
  selection.filter((item) => item.category === "pickup").reduce((sum, item) => sum + item.quantity, 0) || undefined;

const getWhereText = (profile: ClassroomProfile, defaultText: string) => {
  if (needsAuditoriumRearFillSpeakers(profile)) {
    return `报告厅保留原音频系统，新增音柱仅用于后排补声；舞台区域和前场监听不新增配置。${defaultText}`;
  }
  if (profile.existingDevices.legacySoundSystem.trim() && profile.scenario === "auditorium") return `已填写${getLegacySoundSystemText(profile)}，新增音箱暂不配置；需复核原系统接入点、功率/负载和声场覆盖。${defaultText}`;
  if (profile.existingDevices.legacySoundSystem.trim()) return `已填写${getLegacySoundSystemText(profile)}，仍按正常规则生成新增音箱点位；若已标记利旧音箱点位，利旧壁挂覆盖新增吸顶达到 32.25% 或其他利旧覆盖达到 60% 的新增点位会被利旧点位替代。${defaultText}`;
  return defaultText;
};

const getRiskItems = (profile: ClassroomProfile, acousticAssessment: AcousticAssessment, points: GeneratedPoint[]) => {
  const risks: string[] = [];
  const speakerOverride = profile.engineeringConstraints.speakerProductOverride ?? "auto";
  if (acousticAssessment.risk === "high") risks.push(`${acousticAssessment.label}会影响阵麦拾音清晰度。`);
  if (speakerOverride === "ceiling") {
    risks.push("推荐吸顶选择会影响吊顶、开孔、检修和维护条件。");
  }
  if (speakerOverride === "wall") {
    risks.push("推荐壁挂选择会影响墙面承重、走线和覆盖均匀性。");
  }
  if (profile.engineeringConstraints.ceiling === "exposed" && getSpeakerProductId(profile) === "CEILING-SPEAKER") {
    risks.push("无吊顶条件会影响吸顶音箱安装。");
  }
  if (
    profile.scenario === "meetingRoom" &&
    getSpeakerProductId(profile) === "COLUMN-SPEAKER" &&
    getMeetingWallSpeakerCenterFillPairCount(profile) > 0
  ) {
    risks.push(`房间跨距约 ${Math.max(profile.roomGeometry.length, profile.roomGeometry.width).toFixed(1)}m，会影响壁挂中区听感。`);
  }
  if (profile.engineeringConstraints.ceiling === "suspended" && profile.roomGeometry.height > 3.6) {
    risks.push("吊顶高度会影响阵麦和吸顶音箱安装高度。");
  }
  if (profile.engineeringConstraints.ceiling === "exposed" && profile.needs.includes("localAmplification")) {
    risks.push("无吊顶条件会影响阵麦安装高度。");
  }
  if ((profile.acousticEnvironment.glassCoverage ?? (profile.acousticEnvironment.hasGlassWall ? "large" : "none")) === "large") {
    risks.push("大面积玻璃会影响阵麦拾音清晰度。");
  }
  if (profile.needs.includes("recording") && !profile.existingDevices.recordingHost) risks.push("录播主机信息会影响阵麦音频接入方式。");
  if (profile.existingDevices.legacySoundSystem.trim()) risks.push(`已填写${getLegacySoundSystemText(profile)}会影响接口、电平、功率和负载匹配。`);
  if (isOversizedForFullRoomAmplification(profile)) {
    risks.push(`房间尺寸会影响阵麦全场扩声能力，约需 ${getRequiredArrayMicCountForFullRoomAmplification(profile)} 只阵麦。`);
  }
  const effectiveArrayMicRadius = getArrayMicEffectiveAmplificationRadius(profile);
  if (points.filter((point) => point.type === "arrayMic").some((point) => profile.roomGeometry.length - point.position.y > effectiveArrayMicRadius * 1.6)) {
    risks.push("后场距离会影响阵麦扩声清晰度和语音还原度。");
  }
  const arrayMicCount = points.filter((point) => point.type === "arrayMic").length;
  if (arrayMicCount <= 2 && profile.roomGeometry.length > 16 && getUsableArrayMicDepth(profile, points) > effectiveArrayMicRadius * 2.4) {
    risks.push("房间纵深会影响中后区阵麦拾音覆盖。");
  }
  if ((profile.existingDevices.legacySpeakerPoints ?? []).length) {
    risks.push(`已标记 ${(profile.existingDevices.legacySpeakerPoints ?? []).length} 个利旧音箱点位会影响阵麦啸叫余量。`);
  }
  if ((profile.existingDevices.legacySpeakerPoints ?? []).some((point) => point.type === "wall" && point.wallAdjustability !== "universal")) {
    risks.push("利旧壁挂可调角度会影响阵麦啸叫余量。");
  }
  if (hasSpeakerCapacityOverflow(points.filter((item) => item.type === "speaker").length)) {
    risks.push("音箱点位数量会影响 DT / 扩展功放配置。");
  }
  const speakerCount = points.filter((item) => item.type === "speaker").length;
  if (hasRecommendedSpeakerSystemOverflow(speakerCount)) {
    risks.push("音箱点位数量会影响系统分区配置。");
  } else if (getSpeakerProductId(profile) === "COLUMN-SPEAKER" && speakerCount >= 16) {
    risks.push("壁挂音箱数量会影响系统分区配置。");
  }
  if (profile.existingDevices.legacyWirelessMic.trim()) risks.push("利旧手持麦信息会影响接收机接口确认。");
  if (profile.engineeringConstraints.hasCentralAirConditioner && !(profile.engineeringConstraints.centralAirConditionerPoints ?? []).length) {
    risks.push("中央空调位置会影响阵麦选点。");
  }
  if ((profile.engineeringConstraints.centralAirConditionerPoints ?? []).length) {
    risks.push("中央空调距离会影响阵麦语音还原度。");
  }
  return risks;
};

const getUsableArrayMicDepth = (profile: ClassroomProfile, points: GeneratedPoint[]) => {
  const mics = points.filter((point) => point.type === "arrayMic");
  if (mics.length < 2) return profile.roomGeometry.length;
  const sorted = [...mics].sort((a, b) => a.position.y - b.position.y);
  return sorted[sorted.length - 1].position.y - sorted[0].position.y;
};

export const getReviewItems = (profile: ClassroomProfile, completeness: CompletenessItem[], acousticAssessment: AcousticAssessment) => [
  ...completeness.filter((item) => !item.complete).map((item) => `${item.label}会影响方案完整性。`),
  `混响风险“${acousticAssessment.label}”会影响阵麦拾音清晰度。`,
  "阵麦主从位置会影响教师区和学生区拾音覆盖。",
  "阵麦数量会影响后场和两侧座位拾音覆盖。",
  `扩声范围“${getEffectiveAmplificationScopeText(profile)}”会影响音箱数量和点位。`,
  "已有设备信息会影响系统接入方式。",
  "接口信息会影响 DT 接入和功放输出。",
  profile.needs.includes("recording")
    ? "录播平台信息会影响阵麦音频接入方式。"
    : "录播扩展信息会影响阵麦音频接入方式。"
];

export const getEngineeringBasis = (
  profile: ClassroomProfile,
  selection: ProductRecommendation[],
  points: ReturnType<typeof generateEngineeringPoints>,
  acousticAssessment: AcousticAssessment,
  connectionCount: number
): EngineeringBasis[] => [
  {
    item: "使用场景",
    basis: "售前采集",
    result: getScenarioText(profile)
  },
  {
    item: "使用需求",
    basis: "售前采集",
    result: getNeedText(profile)
  },
  {
    item: "空间面积",
    basis: "房间长 x 宽",
    result: hasValidGeometry(profile) ? `${getRoomArea(profile).toFixed(1)} 平方米` : "待补充尺寸"
  },
  {
    item: "扩声范围",
    basis: "本地扩声二级选项",
    result: getEffectiveAmplificationScopeText(profile)
  },
  {
    item: "利旧设备",
    basis: "外接设备采集",
    result: getLegacyDeviceSummary(profile)
  },
  {
    item: "混响风险",
    basis: [
      floorMaterialLabels[profile.acousticEnvironment.floorMaterial],
      wallMaterialLabels[profile.acousticEnvironment.wallMaterial],
      ceilingAcousticTreatmentLabels[profile.acousticEnvironment.ceilingAcousticTreatment ?? "unknown"],
      softTreatmentLabels[profile.acousticEnvironment.softTreatment],
      glassCoverageLabels[profile.acousticEnvironment.glassCoverage ?? (profile.acousticEnvironment.hasGlassWall ? "large" : "none")],
      furnishingDensityLabels[profile.acousticEnvironment.furnishingDensity],
      echoObservationLabels[profile.acousticEnvironment.echoObservation ?? "unknown"]
    ].join("、"),
    result: acousticAssessment.label
  },
  {
    item: "DT 阵列麦点位",
    basis: "教师活动区、录播 / 互动需求、教室面积、混响风险",
    result: points.filter((item) => item.type === "arrayMic").map((item) => item.label).join("、") || "未选择阵列麦需求"
  },
  {
    item: "音箱点位",
    basis: "房间长宽比例、宽度、扩声范围、SPK 输出容量和利旧设备情况",
    result: profile.existingDevices.legacySoundSystem.trim() && profile.scenario === "auditorium"
      ? `${getLegacySoundSystemText(profile)}，暂不新增音箱点位；利旧点位 ${(profile.existingDevices.legacySpeakerPoints ?? []).length} 个`
      : points.filter((item) => item.type === "speaker").map((item) => item.label).join("、") || "未选择扩声"
  },
  {
    item: "接口连接",
    basis: "DT 系列说明书、WP1 手持麦接口说明、功放输出端子定义",
    result: `${connectionCount} 条接口级连接`
  },
  ...selection.map((item) => ({
    item: item.name,
    basis: item.basis,
    result: `${item.quantity} 台 / 只`
  }))
];
