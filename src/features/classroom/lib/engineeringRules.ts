import { classroomProductRules } from "../data/productCatalog";
import { getAppBrand, type AppBrandId } from "../brand";
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
import { generateConnectionLines, hasExistingWirelessHandheld } from "./connectionRules";
import {
  ARRAY_MIC_ONLINE_PICKUP_RADIUS_M,
  generateEngineeringPoints,
  getArrayMicEffectiveAmplificationRadius,
  getArrayMicInstallAdvice,
  getArrayMicInstallLabel,
  getDefaultSpeakerCount,
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
import {
  AUDIO_PROCESSOR_HOST_PRODUCT_ID,
  clampArrayMicCountForBrand,
  generateBrandEngineeringPoints,
  getBrandExternalAmplifierCount,
  getBrandSystemCapability,
  getRequiredArrayMicCount,
  getYinmanHybridProcessorInputDemand,
  getYinmanHybridProcessorTier,
  hasYinmanLineArraySupplements,
  isYinmanLineArrayOnlineCoverageComplete,
  LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
  PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID
} from "./systemCapabilities";
import { validatePointPlan } from "./pointValidation";
import { getLineArrayDecision, getProcessorCapacity, getProcessorInterfaceDemand, getProcessorTier, getProcessorTierName, LINE_ARRAY_PRODUCT_ID } from "./lineArrayRules";
import { getCustomerSolutionSelection } from "./solutionSelection";
import {
  getExistingMicInputDemand,
  getHangingMicProcessorTier,
  getHangingMicRemainingCapacity,
  HANGING_MIC_PRODUCT_ID
} from "./hangingMicRules";
import {
  getEffectiveYinmanMicrophoneSolution,
  getSmallDiscConnectionMode,
  isSmallDiscSolution,
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAX_GENERATED_COUNT,
  SMALL_DISC_USB_CABLE_PRODUCT_ID
} from "./yinmanSmallDiscRules";

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
      profile.acousticEnvironment.furnishingDensity !== "unknown" &&
      (profile.acousticEnvironment.echoObservation ?? "unknown") !== "unknown",
    blocking: true,
    hint: "请选择吊顶、顶面吸声、地面、墙面、软装、玻璃比例、家具布置和拍手测试结果。"
  },
  {
    key: "installation",
    label: "安装与后排补声",
    complete:
      (profile.engineeringConstraints.overheadSpeakerMounting ?? "unknown") !== "unknown" &&
      (profile.scenario !== "auditorium" || (profile.engineeringConstraints.auditoriumRearFillSpeakers ?? "unknown") !== "unknown"),
    blocking: true,
    hint: profile.scenario === "auditorium"
      ? "请选择顶面音箱安装条件和报告厅后排补声情况。"
      : "请选择顶面音箱安装条件。"
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

export const generateEngineeringOutputs = (
  profile: ClassroomProfile,
  quantityOverrides: QuantityOverrides = {},
  brandId: AppBrandId = getAppBrand().id
): GeneratedOutputs => {
  const completeness = getCompleteness(profile);
  const acousticAssessment = getAcousticAssessment(profile);
  const canGenerateCore = hasValidGeometry(profile);
  const initialSolutionSelection = getCustomerSolutionSelection(profile, [], brandId);
  const canGenerateDrawings = canGenerateCore && !initialSolutionSelection.drawingBlocked;
  const usesSmallDisc03 = getEffectiveYinmanMicrophoneSolution(profile, brandId) === "smallDisc03";
  const requiredArrayMicCount = canGenerateDrawings ? getRequiredArrayMicCount(profile, brandId) : 0;
  const defaultPoints = canGenerateDrawings ? generateBrandEngineeringPoints(profile, {}, brandId) : [];
  const defaultProductSelection = canGenerateCore
    ? ensureMinimumProductSelection(
        profile,
        defaultPoints,
        acousticAssessment,
        getProductSelection(profile, defaultPoints, acousticAssessment, brandId),
        brandId
      )
    : [];
  const productSelection = canGenerateCore
    ? syncBrandSystemSelection(
        profile,
        acousticAssessment,
        applyQuantityOverrides(defaultProductSelection, quantityOverrides, brandId),
        brandId
      )
    : [];
  const selectedSpeakerProduct = productSelection.find((item) => item.category === "speaker" && item.quantity > 0);
  const selectedSpeakerCount = selectedSpeakerProduct && quantityOverrides[selectedSpeakerProduct.productId] !== undefined ? selectedSpeakerProduct.quantity : undefined;
  const hasManualSpeakerCount = selectedSpeakerCount !== undefined;
  const points = canGenerateDrawings
    ? generateBrandEngineeringPoints(profile, {
        arrayMicCount: getSelectedArrayMicQuantity(productSelection),
        speakerCount: selectedSpeakerCount,
        speakerProductId: selectedSpeakerProduct && quantityOverrides[selectedSpeakerProduct.productId] !== undefined ? (selectedSpeakerProduct.productId as "CEILING-SPEAKER" | "COLUMN-SPEAKER") : undefined,
        preserveSpeakerCount: hasManualSpeakerCount
      }, brandId)
    : [];
  const solutionSelection = getCustomerSolutionSelection(profile, points, brandId);
  const validationSpeakerProductId = selectedSpeakerProduct?.productId === "CEILING-SPEAKER" || selectedSpeakerProduct?.productId === "COLUMN-SPEAKER"
    ? selectedSpeakerProduct.productId
    : getSpeakerProductId(profile);
  const validationLineArray = getLineArrayDecision(profile, points);
  const requiredSpeakerCount = canGenerateDrawings && !usesSmallDisc03 && shouldGenerateNewSpeakers(profile)
    ? getDefaultSpeakerCount(
        profile,
        validationSpeakerProductId === "COLUMN-SPEAKER",
        validationLineArray.selected ? { mode: validationLineArray.mode, position: validationLineArray.position } : undefined
      )
    : 0;
  const pointValidation = validatePointPlan({
    profile,
    brandId,
    generatedPoints: points,
    requiredArrayMicCount,
    requiredSpeakerCount,
    solutionSelection
  });
  const riskItems = getRiskItems(profile, acousticAssessment, points, brandId);
  const connectionLines = canGenerateDrawings ? generateConnectionLines(profile, productSelection, brandId, points) : [];
  const engineeringBasis: EngineeringBasis[] = [];
  const installationGuide = getInstallationGuide(profile, points);
  const audioPlan = getAudioPlan(profile, points, acousticAssessment, brandId, requiredArrayMicCount);
  const reviewItems: string[] = [];
  const drawings = [
    {
      title: "麦克风与音箱点位图",
      type: "installation" as const,
      notes: [
        "按房间尺寸等比例绘制，前方默认为黑板 / 讲台侧，点位需结合门、窗、投影幕、空调出风口和灯具复核。",
        "蓝色点位用于麦克风拾音，橙色点位用于音箱覆盖；页面可导出 PNG 图片，便于方案沟通和归档。"
      ]
    },
    { title: "接口接线图", type: "wiring" as const, notes: ["按产品资料生成接口级连接关系，无需销售补充线路路径。"] },
    { title: "系统拓扑图", type: "topology" as const, notes: ["展示外接设备、麦克风、电脑 / 录播平台和音箱之间的系统链路。"] }
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
    reportText: report.reportText,
    pointValidation,
    solutionSelection
  };
};

const getAudioPlan = (
  profile: ClassroomProfile,
  points: GeneratedPoint[],
  acousticAssessment: AcousticAssessment,
  brandId: AppBrandId,
  requiredArrayMicCount: number
): AudioPlan => {
  const area = getRoomArea(profile);
  const arrayCount = points.filter((point) => point.type === "arrayMic").length;
  const usesHangingMic = points.some((point) => point.pickupKind === "hangingMic");
  const usesSmallDisc01 = points.some((point) => point.pickupKind === "smallDisc01");
  const usesSmallDisc03 = points.some((point) => point.pickupKind === "smallDisc03");
  const usesSmallDisc = usesSmallDisc01 || usesSmallDisc03;
  const smallDiscRadius = points.find((point) => point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc03")?.coverageRadius ?? 5;
  const hasOnline = profile.needs.some((need) => ["videoConference", "interactiveClass", "recording", "remoteTeaching"].includes(need));
  const hasLocalAmp = profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");
  const capability = getBrandSystemCapability(brandId);
  const oversizedForFullRoomAmp = !usesSmallDisc && requiredArrayMicCount > capability.maxArrayMicCount;
  const mode = usesSmallDisc03
    ? "录音巡课拾音方案"
    : usesSmallDisc01
      ? hasLocalAmp ? "小圆盘阵麦内置处理扩声方案" : "小圆盘阵麦线上拾音方案"
      : getAudioMode(profile, area, arrayCount, capability.maxArrayMicCount, oversizedForFullRoomAmp);
  const tuning = usesSmallDisc03
    ? [
        "确认每段超五类纯铜网线按T568B制作，逐段检查级联与音频扩展器连接。",
        "在讲台、会议桌等主要录音或巡课位置试听，确认录播或巡课设备输入电平稳定。"
      ]
    : usesSmallDisc01
      ? [
          "确认主麦、从麦级联以及USB直连或音频扩展器链路，逐段检查供电和音频连接。",
          "本地扩声先校准主麦内置处理，再调整教学模拟功放主机和壁挂音箱音量。",
          "验收时分别测试主要拾音位置、远端音频和本地壁挂音箱覆盖。"
        ]
      : [
          "调试前确认阵列麦主机固件和调试软件版本，完成设备联网、供电、USB / 模拟音频链路检查。",
          `按场景选择声场模式：${mode}。需要同时线上采集和本地扩声时，优先选择兼容拾音与扩音的模式。`,
          "先执行一键自适应声场调音，再微调输入、输出、均衡、反馈抑制和噪声抑制参数。",
          "调音完成后保存 Flash / 场景参数；若接入中控或遥控器，现场复核模式切换和音量控制。",
          "验收时分别测试教师常用站位、学生发言区、远端平台声音、本地扩声音量和啸叫余量。"
        ];

  return {
    mode,
    summary: usesSmallDisc03
      ? "本方案采用小圆盘阵麦服务录音或巡课，麦克风级联后共用一台音频扩展器接入录播或巡课设备。"
      : usesSmallDisc01
        ? "本方案采用小圆盘阵麦内置处理；本地扩声经教学模拟功放主机驱动壁挂音箱，线上音频按所选USB直连或音频扩展器接入。"
      : usesHangingMic
      ? "本方案由吊麦配合智能音频处理主机完成讲台区域拾音和本地扩声；每只吊麦独占一路带供电MIC输入。"
      : brandId === "yinman"
      ? "本方案由大圆盘阵麦配合智能音频处理主机完成拾音、音频处理和无源音箱驱动，形成完整课堂音频链路。"
      : "本方案以智能天花阵列麦克风作为课堂音频核心，集成拾音、音频处理和功放能力，结合波束成形、多波束动态跟踪、AFC 反馈抑制、ANS 自动噪声抑制、AEC 回声消除和 AGC 自动增益，减少外置处理设备和复杂布线。",
    pickupGoal: usesSmallDisc
      ? `按${smallDiscRadius.toFixed(1)}m拾音半径覆盖讲台、会议桌等主要活动区域，不以房间边角作为增加麦克风的依据。`
      : usesHangingMic
      ? "吊麦仅服务讲台区域拾音与扩声，按3m半径复核覆盖，不承担全场或线上互动拾音。"
      : hasOnline
      ? oversizedForFullRoomAmp
        ? `面向远程互动、录播或会议平台，后场以线上拾音为主；线上拾音半径按 ${ARRAY_MIC_ONLINE_PICKUP_RADIUS_M}m 作为点位复核依据，优先保证教师区和后场发言清晰。`
        : "面向远程互动、录播或会议平台，优先保证教师授课区与学生发言区语音清晰，降低反射声和环境噪声对远端听感的影响。"
      : "当前未选择线上采集类需求，拾音主要作为扩声和后续平台接入预留。若后续增加录播或远程互动，需要补充平台接口确认。",
    amplificationGoal: usesSmallDisc03
      ? "当前为录音或巡课拾音方案，不配置本地扩声音箱。"
      : usesSmallDisc01
        ? hasLocalAmp ? "本地扩声只采用壁挂音箱，由小圆盘阵麦内置处理后经教学模拟功放主机驱动。" : "当前不配置本地扩声，壁挂音箱不进入方案。"
      : hasLocalAmp
      ? oversizedForFullRoomAmp
        ? brandId === "yinyi"
          ? `按当前房间尺寸和一主四从上限评估，已超出 5 只阵麦可承担的全场本地扩声范围；本方案优先做${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"}，后排以线上拾音和平台收声为主，避免全场扩声造成声压不均、啸叫余量不足和调试复杂度过高。`
          : `按当前房间尺寸和 ${capability.maxArrayMicCount} 只阵麦能力上限评估，已超出可承担的全场本地扩声范围；本方案优先做${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"}，后排以线上拾音和平台收声为主。`
        : getEffectiveAmplificationScope(profile) === "full"
        ? "扩声目标为全教室均匀覆盖，后场补声音箱会影响前后排声压差。"
        : profile.scenario === "auditorium"
          ? "扩声目标以居中舞台区域为主，保证舞台发言和表演声音自然覆盖主要听音区。"
          : "扩声目标以讲台 / 教师活动区为主，保证教师声音自然覆盖主要听音区。"
      : "当前未选择本地扩声需求，音箱输出仅作为可选配置或后续扩展项。",
    areaBoundary: usesSmallDisc01
      ? "按主要拾音区域自动配置1只主麦和从麦；超过3只从麦时继续出图并转专项复核。"
      : usesSmallDisc03
        ? "按主要录音或巡课区域自动配置麦克风；超过3只时继续出图并转专项复核。"
        : getAreaBoundary(profile, area, arrayCount, brandId, requiredArrayMicCount),
    environmentBoundary: `建议背景噪声不高于 45dBSPL，混响时间控制在 800ms 以内；若采用精品分区均衡扩音模式，建议混响时间控制在 600ms 以内。当前声学评估为：${acousticAssessment.label}。`,
    tuning
  };
};

const getAudioMode = (profile: ClassroomProfile, area: number, arrayCount: number, maxArrayMicCount: number, oversized: boolean) => {
  if (!profile.needs.includes("localAmplification") && profile.needs.some((need) => ["videoConference", "recording", "remoteTeaching"].includes(need))) {
    return "标准教室单收音方案";
  }
  if (profile.needs.includes("localAmplification") && !profile.needs.some((need) => ["videoConference", "recording", "remoteTeaching"].includes(need))) {
    if (oversized) return `超出 ${maxArrayMicCount} 麦上限的讲台扩声方案`;
    return area <= 120 && getEffectiveAmplificationScope(profile) === "podium" ? "标准教室单扩音方案" : "标准教室扩音方案";
  }
  if (oversized) return `超大空间${profile.scenario === "auditorium" ? "舞台" : "讲台"}扩声 + 后场线上拾音方案`;
  if (arrayCount >= 2 || getEffectiveAmplificationScope(profile) === "full") return "精品教室分区均衡扩音方案";
  return "标准教室扩音和收音兼容方案";
};

const getEffectiveAmplificationScopeText = (profile: ClassroomProfile) => {
  const collected = getAmplificationScopeText(profile);
  if (isSmallDiscSolution(getEffectiveYinmanMicrophoneSolution(profile, "yinman"))) return collected;
  if (!isOversizedForFullRoomAmplification(profile)) return collected;
  return `${collected}（按 5 麦上限评估，提示无法做全场扩声，建议改为${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"} + 全场线上拾音）`;
};

const getAreaBoundary = (
  profile: ClassroomProfile,
  area: number,
  arrayCount: number,
  brandId: AppBrandId,
  requiredArrayMicCount: number
) => {
  const capability = getBrandSystemCapability(brandId);
  if (area <= 0) return "待补充房间尺寸后判断声场适用边界。";
  if (area < 60) return "面积小于 60 平方米，智能天花阵列麦克风可用但产品价值不易完全发挥，仍需结合客户预算判断扩声收益。";
  if (area <= 80) return "面积处于 60-80 平方米，适合单麦方案；后排听感和拾音清晰度需在复勘或调试时确认。";
  if (requiredArrayMicCount > capability.maxArrayMicCount) {
    if (brandId === "yinyi") {
      return `按房间长宽估算，若坚持全场本地扩声约需 ${getRequiredArrayMicCountForFullRoomAmplification(profile)} 只阵麦，已超过一主四从 5 只上限；提示无法做全场扩声，建议改为${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"} + 全场线上拾音，并按 ${ARRAY_MIC_ONLINE_PICKUP_RADIUS_M}m 线上拾音半径复核。`;
    }
    return `按房间长宽估算，当前约需 ${requiredArrayMicCount} 只阵麦，已超过 ${capability.maxArrayMicCount} 只能力上限；建议改为${profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声"} + 全场线上拾音，并按 ${capability.onlinePickupRadiusM}m 线上拾音半径复核。`;
  }
  if (getEffectiveAmplificationScope(profile) === "podium" && !profile.needs.some((need) => ["recording", "videoConference", "interactiveClass"].includes(need))) {
    return profile.scenario === "auditorium"
      ? "当前为舞台区域扩声且无明确线上拾音 / 录播 / 互动需求，默认优先单麦服务舞台区；如后续要求后排发言或全场拾音，再评估补充从麦。"
      : "当前为讲台区域扩声且无明确线上拾音 / 录播 / 互动需求，默认优先单麦服务教师区；如后续要求后排发言或全场拾音，再评估补充从麦。";
  }
  if (profile.roomGeometry.length <= 9) return arrayCount >= 2 ? "房间纵深小于等于约 9m，当前因互动、后排发言或特殊采集需求增加从麦；复勘时重点确认后排座位、两侧座位和啸叫余量。" : "房间纵深小于等于约 9m，主麦安装在前墙约 3m 后，按 5m 最佳理想扩声距离可优先单麦覆盖教师区与主要听音区。";
  if (profile.roomGeometry.length <= 16) return arrayCount >= 2 ? "房间纵深约 9-16m，已增加从麦用于补强中后区；5m 是最佳理想扩声距离而非硬边界，复勘时需重点试听中后区清晰度。" : "房间纵深约 9-16m，当前仍为单麦方案，需现场复核后排听感；若全场扩声、录播或学生发言要求较高，建议评估 2 麦。";
  if (area <= 150) return arrayCount >= 3 ? "房间纵深超过 16m，已按 3 麦级联覆盖前场、中区和后场；需复核中后区发言和两侧座位覆盖。" : "房间纵深超过 16m，中后区与后场座位会影响阵麦数量。";
  return "面积超过 150 平方米，单套智能天花阵列麦克风和吸顶音箱难以完全覆盖，建议拆分声区或转为专项声场设计。";
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
      ? point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02" || point.pickupKind === "smallDisc03"
        ? point.installHeight ? `吊杆安装，建议约${point.installHeight.toFixed(1)}m` : "吊杆安装，按现场高度复核"
      : point.pickupKind === "hangingMic"
        ? "吊装安装，按现场高度复核"
        : point.pickupKind === "lineArray"
          ? point.installationMode === "podium"
          ? "讲台摆放，建议约1.1m"
          : point.installationMode === "tabletop"
            ? "会议桌摆放，建议约0.75m"
            : point.installHeight
              ? `吊挂安装，建议约${point.installHeight.toFixed(1)}m`
              : "吊挂安装，按现场高度复核"
        : getArrayMicInstallLabel(profile)
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
        ? point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02" || point.pickupKind === "smallDisc03"
          ? `拾音面朝向主要活动区，按${(point.coverageRadius ?? 5).toFixed(1)}m半径覆盖。`
        : point.pickupKind === "hangingMic"
          ? "拾音面朝向讲台主要活动区，按3m半径覆盖。"
        : point.pickupKind === "lineArray"
          ? point.pickupPattern === "front180" ? "正面朝向责任活动区，形成完整180度正面声幕。" : "面向会议桌主要发言区，按5m半径覆盖。"
        : profile.amplificationScope === "podium"
          ? "阵列麦位于教师主要活动区前方约 0.5-1m，拾音面兼顾授课走动和黑板板书位置；如讲台在左右侧，可小幅偏移但不脱离主活动区。"
          : "阵列麦按主要拾音区域居中覆盖，兼顾讲台、教师走动区和学生发言方向。"
        : isWallSpeaker
          ? `壁挂安装，支架支持水平和俯仰调节，按点位图朝向主要听音区，${angleText}`
          : isCeilingSpeaker
          ? "规则房间优先按矩形网格均匀分布，形成均匀扩声覆盖；无感扩声为单声道，不区分左右声道，按前后排顺序分配 SPK1 / SPK2 / SPK3 / SPK4。"
          : isBack
          ? "后场补声音箱朝向学生区前中部，音量作为补声，不压过前场。"
          : "前场音箱朝向主要听音区，单声道分组保持对称覆盖。",
      avoidance: isMic
        ? point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02" || point.pickupKind === "smallDisc03"
          ? "采用吊杆固定，避开空调风口、强噪声设备、音箱正前方和灯具检修口；级联网线单段不超过20m。"
        : point.pickupKind === "hangingMic"
          ? "避开空调风口、强噪声设备、音箱正前方和灯具检修口；每只独占一路带供电MIC输入。"
        : point.pickupKind === "lineArray"
          ? `${point.installationMode === "podium" ? "优先放在讲台上并靠近讲话位置。" : point.installationMode === "tabletop" ? "放在会议桌主要发言区并保持拾音面无遮挡。" : "吊挂点保持拾音正面朝向责任区。"}避开空调风口、强噪声设备，网线禁止接PoE。`
          : `${getArrayMicInstallAdvice(profile)}避开投影机、空调出风口、强噪声设备和灯具检修口；不要贴近墙角或门口。`
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
  acousticAssessment: AcousticAssessment,
  brandId: AppBrandId
): ProductRecommendation[] => {
  const lineArray = getLineArrayDecision(profile);
  const useLineArrayProduct = lineArray.selected || lineArray.requested;
  const requestedMicrophoneSolution = profile.engineeringConstraints.microphoneSolution ?? "auto";
  const microphoneSolution = requestedMicrophoneSolution === "hangingMic" && brandId !== "yinman" ? "auto" : requestedMicrophoneSolution;
  const effectiveMicrophoneSolution = getEffectiveYinmanMicrophoneSolution(profile, brandId);
  const usesHybridLineArray = hasYinmanLineArraySupplements(points);
  const smallDiscConnectionMode = getSmallDiscConnectionMode(profile);
  const hasLegacySound = Boolean(profile.existingDevices.legacySoundSystem.trim());
  const needsAuditoriumRearFill = needsAuditoriumRearFillSpeakers(profile);
  const speakerProductId = getSpeakerProductId(profile);
  return classroomProductRules
    .filter((rule) => {
      if (effectiveMicrophoneSolution === "smallDisc03" && (rule.category === "speaker" || rule.category === "amplifier")) return false;
      if (rule.productId === SMALL_DISC_01_PRODUCT_ID) return brandId === "yinman" && effectiveMicrophoneSolution === "smallDisc01";
      if (rule.productId === SMALL_DISC_02_PRODUCT_ID) return brandId === "yinman" && (effectiveMicrophoneSolution === "smallDisc01" || usesHybridLineArray);
      if (rule.productId === SMALL_DISC_03_PRODUCT_ID) return brandId === "yinman" && effectiveMicrophoneSolution === "smallDisc03";
      if (rule.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID) {
        return brandId === "yinman" && (effectiveMicrophoneSolution === "smallDisc03" || (effectiveMicrophoneSolution === "smallDisc01" && smallDiscConnectionMode === "extender"));
      }
      if (rule.productId === SMALL_DISC_USB_CABLE_PRODUCT_ID) {
        return brandId === "yinman" && effectiveMicrophoneSolution === "smallDisc01" && smallDiscConnectionMode === "usb" && profile.needs.some((need) => need === "videoConference" || need === "interactiveClass" || need === "remoteTeaching");
      }
      if (rule.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID) return brandId === "yinman" && usesHybridLineArray;
      if (rule.productId === HANGING_MIC_PRODUCT_ID) return brandId === "yinman" && microphoneSolution === "hangingMic";
      if (rule.productId === "DT2-Pro" && (microphoneSolution === "hangingMic" || isSmallDiscSolution(effectiveMicrophoneSolution))) return false;
      if (rule.productId === "WIRELESS-HANDHELD") return true;
      if (rule.category === "speaker" || rule.category === "amplifier") return shouldGenerateNewSpeakers(profile);
      return profile.needs.some((need) => rule.applyWhen.includes(need));
    })
    .map((rule) => {
      let quantity = 1;
      const arrayCount = points.filter((item) => item.type === "arrayMic").length;
      const lineArrayCount = points.filter((item) => item.pickupKind === "lineArray").length;
      const smallDisc02Count = points.filter((item) => item.pickupKind === "smallDisc02").length;
      const speakerCount = points.filter((item) => item.type === "speaker").length;

      if (rule.productId === "DT2-Pro") quantity = lineArray.requested && !lineArray.selected ? 0 : Math.max(1, useLineArrayProduct ? lineArrayCount : arrayCount);
      if (rule.productId === HANGING_MIC_PRODUCT_ID) quantity = arrayCount;
      if (rule.productId === SMALL_DISC_01_PRODUCT_ID) quantity = 1;
      if (rule.productId === SMALL_DISC_02_PRODUCT_ID) quantity = usesHybridLineArray ? smallDisc02Count : Math.max(0, arrayCount - 1);
      if (rule.productId === SMALL_DISC_03_PRODUCT_ID) quantity = arrayCount;
      if (rule.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID || rule.productId === SMALL_DISC_USB_CABLE_PRODUCT_ID || rule.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID) quantity = 1;
      if (rule.productId === "CEILING-SPEAKER" || rule.productId === "COLUMN-SPEAKER") {
        quantity = (hasLegacySound && profile.scenario === "auditorium" && !needsAuditoriumRearFill) || rule.productId !== speakerProductId ? 0 : clampSpeakerQuantity(speakerCount);
      }
      if (rule.productId === "WIRELESS-HANDHELD") quantity = hasExistingWirelessHandheld(profile) ? 0 : acousticAssessment.risk === "high" ? 1 : 0;
      if (rule.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID) {
        quantity = hasLegacySound && profile.scenario === "auditorium" && !needsAuditoriumRearFill ? 0 : getExternalAmplifierCountForSpeakers(speakerCount);
      }

      return {
        productId: rule.productId === "DT2-Pro" && useLineArrayProduct
          ? LINE_ARRAY_PRODUCT_ID
          : brandId === "yinman" && rule.productId === "DT2-Pro" ? PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID : rule.productId,
        name: rule.productId === "DT2-Pro" && useLineArrayProduct
          ? "智能线阵麦克风"
          : brandId === "yinman" && rule.productId === "DT2-Pro" ? "大圆盘阵麦" : rule.name,
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
  selection: ProductRecommendation[],
  brandId: AppBrandId
): ProductRecommendation[] => {
  if (selection.length > 0) return selection;
  if (!hasValidGeometry(profile)) return selection;

  const arrayCount = Math.max(1, points.filter((item) => item.type === "arrayMic").length);
  const fallbackProductId = "DT2-Pro";
  const rule = classroomProductRules.find((item) => item.productId === fallbackProductId) ?? classroomProductRules.find((item) => item.productId === "DT2");
  if (!rule) return selection;

  return [
    {
      productId: brandId === "yinman" ? PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID : rule.productId,
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

const applyQuantityOverrides = (
  selection: ProductRecommendation[],
  overrides: QuantityOverrides,
  brandId: AppBrandId
): ProductRecommendation[] => {
  const usesLineArray = selection.some((item) => item.productId === LINE_ARRAY_PRODUCT_ID && item.quantity > 0);
  return selection.map((item) => {
    const override = overrides[item.productId];
    if (
      override === undefined ||
      (usesLineArray && (item.productId === SMALL_DISC_02_PRODUCT_ID || item.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID))
    ) return item;
    const quantity = item.category === "speaker"
      ? clampSpeakerQuantity(override)
      : item.category === "pickup"
        ? item.productId === LINE_ARRAY_PRODUCT_ID
          ? Math.min(2, Math.max(0, Math.round(override)))
          : item.productId === HANGING_MIC_PRODUCT_ID
            ? Math.min(6, Math.max(0, Math.round(override)))
            : item.productId === SMALL_DISC_01_PRODUCT_ID
              ? 1
              : item.productId === SMALL_DISC_02_PRODUCT_ID || item.productId === SMALL_DISC_03_PRODUCT_ID
                ? Math.min(SMALL_DISC_MAX_GENERATED_COUNT, Math.max(0, Math.round(override)))
            : clampArrayMicCountForBrand(override, brandId)
        : Math.max(0, Math.round(override));
    return {
      ...item,
      quantity
    };
  });
};

const syncBrandSystemSelection = (
  profile: ClassroomProfile,
  _acousticAssessment: AcousticAssessment,
  selection: ProductRecommendation[],
  brandId: AppBrandId
): ProductRecommendation[] => {
  const speakerCount = selection.find((item) => item.category === "speaker" && item.quantity > 0)?.quantity ?? 0;
  const usesSmallDisc01 = selection.some((item) => item.productId === SMALL_DISC_01_PRODUCT_ID && item.quantity > 0);
  const usesSmallDisc03 = selection.some((item) => item.productId === SMALL_DISC_03_PRODUCT_ID && item.quantity > 0);
  const amplifierCount = shouldGenerateNewSpeakers(profile)
    ? usesSmallDisc01 && speakerCount > 0 ? 1 : getBrandExternalAmplifierCount(speakerCount, brandId)
    : 0;
  let selectionWithoutSystemDevices = selection.filter(
    (item) => item.productId !== EXTERNAL_AMPLIFIER_PRODUCT_ID && item.productId !== AUDIO_PROCESSOR_HOST_PRODUCT_ID
  );
  const lineArrayCount = selectionWithoutSystemDevices.find((item) => item.productId === LINE_ARRAY_PRODUCT_ID)?.quantity ?? 0;
  const hybridSupplementCount = selectionWithoutSystemDevices.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity ?? 0;
  const usesHybridLineArray = lineArrayCount > 0 && hybridSupplementCount > 0;
  const hangingMic = selectionWithoutSystemDevices.find((item) => item.productId === HANGING_MIC_PRODUCT_ID);
  const newWirelessInputDemand = selectionWithoutSystemDevices.some((item) => item.productId === "WIRELESS-HANDHELD" && item.quantity > 0) ? 1 : 0;
  const processorTier = usesHybridLineArray
    ? getYinmanHybridProcessorTier(profile, newWirelessInputDemand)
    : hangingMic
    ? getHangingMicProcessorTier(profile, hangingMic.quantity, newWirelessInputDemand)
    : getProcessorTier(profile, brandId, lineArrayCount, speakerCount);
  const processorCapacity = getProcessorCapacity(processorTier);
  if (hangingMic) {
    const remainingCapacity = getHangingMicRemainingCapacity(profile, processorTier, newWirelessInputDemand);
    selectionWithoutSystemDevices = selectionWithoutSystemDevices.map((item) => item.productId === HANGING_MIC_PRODUCT_ID
      ? { ...item, quantity: Math.min(item.quantity, remainingCapacity) }
      : item);
  }
  const hangingMicInputDemand = selectionWithoutSystemDevices.find((item) => item.productId === HANGING_MIC_PRODUCT_ID)?.quantity ?? 0;
  const totalHangingMicInputDemand = getExistingMicInputDemand(profile) + newWirelessInputDemand + hangingMicInputDemand;

  const rule = classroomProductRules.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID);
  const amplifierSelection = rule
    ? [{
        productId: rule.productId,
        name: rule.name,
        category: rule.category,
        quantity: amplifierCount,
        why: "",
        where: getWhereText(profile, rule.installation),
        wiring: rule.wiring,
        basis: ""
      } satisfies ProductRecommendation]
    : [];
  const requiresExternalProcessor = brandId === "yinman"
    ? !usesSmallDisc01 && !usesSmallDisc03 && Boolean(getSelectedArrayMicQuantity(selectionWithoutSystemDevices))
    : lineArrayCount > 0;
  const processorSelection = requiresExternalProcessor
    ? [{
        productId: AUDIO_PROCESSOR_HOST_PRODUCT_ID,
        name: getProcessorTierName(processorTier),
        category: "processor" as const,
        quantity: 1,
        why: "",
        where: "安装在讲台设备区或弱电机柜，集中完成阵麦接入、音频处理和无源音箱驱动。",
        wiring: usesHybridLineArray
          ? `线阵麦经信号转换器占用MIC1与MIC2；${hybridSupplementCount}只补充拾音阵麦在麦克风端级联后共用EXTMIC。当前MIC输入总需求为${getYinmanHybridProcessorInputDemand(profile, newWirelessInputDemand)}路，处理器MIC容量为${processorCapacity}路。`
          : lineArrayCount > 0
          ? `每只线阵麦使用独立网线接入阵麦接口，禁止接PoE；当前处理器接口容量为${processorCapacity}路。`
          : hangingMic
            ? `每只吊麦独占一路MIC输入并由MIC口直接供电；吊麦、利旧麦克风和新增无线接收机当前合计占用${totalHangingMicInputDemand}路MIC输入，处理器MIC容量为${processorCapacity}路。${processorTier === "sixMic" ? "六麦处理器带独立触摸屏，可控制音箱音量及麦克风静音/开音。" : "MIC接口够用时优先采用价格更低的双麦处理器。"}`
            : "每只阵麦使用独立网线直连主机；主机直接驱动前 8 只无源音箱，9-16 只时通过教学模拟功放主机扩展。",
        basis: ""
      } satisfies ProductRecommendation]
    : [];

  return [
    ...selectionWithoutSystemDevices,
    ...processorSelection,
    ...amplifierSelection
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

const getRiskItems = (profile: ClassroomProfile, acousticAssessment: AcousticAssessment, points: GeneratedPoint[], brandId: AppBrandId) => {
  const risks: string[] = [];
  const usesStandaloneSmallDisc = points.some((point) => point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc03");
  const usesHybridLineArray = hasYinmanLineArraySupplements(points);
  const usesAlternativePickupChain = usesStandaloneSmallDisc || usesHybridLineArray;
  const hybridCoverageComplete = isYinmanLineArrayOnlineCoverageComplete(profile, points);
  const hybridNewWirelessInputDemand = !hasExistingWirelessHandheld(profile) && acousticAssessment.risk === "high" ? 1 : 0;
  const lineArray = getLineArrayDecision(profile);
  if (lineArray.requested && !lineArray.selected) risks.push("该方案无法完整覆盖，建议改选阵麦");
  else if (lineArray.requested && lineArray.coverageWarning && !hybridCoverageComplete) risks.push("线阵麦线上拾音无法全覆盖，需现场复核或补充拾音设备。");
  else if (lineArray.requested && !lineArray.recommended) risks.push("当前线阵麦为非推荐选择，建议阵麦。");
  if (lineArray.selected) {
    const speakerCount = points.filter((point) => point.type === "speaker").length;
    const tier = usesHybridLineArray
      ? getYinmanHybridProcessorTier(profile, hybridNewWirelessInputDemand)
      : getProcessorTier(profile, brandId, lineArray.count, speakerCount);
    const capacity = getProcessorCapacity(tier);
    const demand = usesHybridLineArray
      ? getYinmanHybridProcessorInputDemand(profile, hybridNewWirelessInputDemand)
      : getProcessorInterfaceDemand(profile, speakerCount);
    if (tier !== "highPerformance" && demand > capacity) {
      risks.push(`处理器接口需求超过${capacity}路，需外扩或现场复勘。`);
    }
  }
  if ((profile.engineeringConstraints.microphoneSolution ?? "auto") === "hangingMic") {
    const selection = getCustomerSolutionSelection(profile, points, brandId);
    if (selection.microphone.hangingMicCapacityWarning) risks.push(selection.microphone.hangingMicCapacityWarning);
  }
  const speakerOverride = profile.engineeringConstraints.speakerProductOverride ?? "auto";
  if (acousticAssessment.risk === "high") risks.push(`${acousticAssessment.label}会影响阵麦拾音清晰度。`);
  if (speakerOverride === "ceiling") {
    risks.push("吸顶选择会影响顶面安装、开孔、检修和维护条件。");
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
  if (profile.engineeringConstraints.ceiling === "exposed" && profile.needs.includes("localAmplification")) {
    risks.push("无吊顶条件会影响阵麦安装高度。");
  }
  if ((profile.acousticEnvironment.glassCoverage ?? (profile.acousticEnvironment.hasGlassWall ? "large" : "none")) === "large") {
    risks.push("大面积玻璃会影响阵麦拾音清晰度。");
  }
  if (profile.needs.includes("recording") && !profile.existingDevices.recordingHost) risks.push("录播主机信息会影响阵麦音频接入方式。");
  if (profile.existingDevices.legacySoundSystem.trim()) risks.push(`已填写${getLegacySoundSystemText(profile)}会影响接口、电平、功率和负载匹配。`);
  if (!usesAlternativePickupChain && isOversizedForFullRoomAmplification(profile)) {
    risks.push(`房间尺寸会影响阵麦全场扩声能力，约需 ${getRequiredArrayMicCountForFullRoomAmplification(profile)} 只阵麦。`);
  }
  const effectiveArrayMicRadius = getArrayMicEffectiveAmplificationRadius(profile);
  if (!usesAlternativePickupChain && points.filter((point) => point.type === "arrayMic").some((point) => profile.roomGeometry.length - point.position.y > effectiveArrayMicRadius * 1.6)) {
    risks.push("后场距离会影响阵麦扩声清晰度和语音还原度。");
  }
  const arrayMicCount = points.filter((point) => point.type === "arrayMic").length;
  if (!usesAlternativePickupChain && arrayMicCount <= 2 && profile.roomGeometry.length > 16 && getUsableArrayMicDepth(profile, points) > effectiveArrayMicRadius * 2.4) {
    risks.push("房间纵深会影响中后区阵麦拾音覆盖。");
  }
  if ((profile.existingDevices.legacySpeakerPoints ?? []).length) {
    risks.push(`已标记 ${(profile.existingDevices.legacySpeakerPoints ?? []).length} 个利旧音箱点位会影响阵麦啸叫余量。`);
  }
  if ((profile.existingDevices.legacySpeakerPoints ?? []).some((point) => point.type === "wall" && point.wallAdjustability !== "universal")) {
    risks.push("利旧壁挂可调角度会影响阵麦啸叫余量。");
  }
  if (hasSpeakerCapacityOverflow(points.filter((item) => item.type === "speaker").length)) {
    risks.push("音箱点位数量会影响阵列麦主机 / 扩展功放配置。");
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
  "接口信息会影响阵列麦主机接入和功放输出。",
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
    item: "智能天花阵列麦克风点位",
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
    basis: "智能天花阵列麦克风产品资料、无线手持麦接口说明、功放输出端子定义",
    result: `${connectionCount} 条接口级连接`
  },
  ...selection.map((item) => ({
    item: item.name,
    basis: item.basis,
    result: `${item.quantity} 台 / 只`
  }))
];
