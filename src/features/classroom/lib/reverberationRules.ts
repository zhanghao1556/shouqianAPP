import type {
  AcousticAssessment,
  AcousticAssessmentConfidence,
  CeilingAcousticTreatment,
  ClassroomProfile,
  FloorMaterial,
  FurnishingDensity,
  GlassCoverage,
  ReverberationRisk,
  SoftTreatment,
  WallMaterial
} from "../types";

interface NumberRange {
  min: number;
  max: number;
}

interface ReverberationReference {
  targetRt: number;
  highRiskRt: number;
  reference: string;
}

interface AbsorptionInputs {
  floor: NumberRange;
  ceiling: NumberRange;
  wall: NumberRange;
  glassFraction: NumberRange;
  glass: NumberRange;
  treatmentFraction: NumberRange;
  treatment: NumberRange;
  furnishing: NumberRange;
}

const SABINE_METRIC_CONSTANT = 0.161;
const MIN_ESTIMATED_RT = 0.2;
const MAX_ESTIMATED_RT = 8;

const floorAbsorption: Record<FloorMaterial, NumberRange> = {
  tile: { min: 0.01, max: 0.03 },
  wood: { min: 0.05, max: 0.15 },
  carpet: { min: 0.15, max: 0.45 },
  unknown: { min: 0.01, max: 0.45 }
};

const wallAbsorption: Record<WallMaterial, NumberRange> = {
  painted: { min: 0.03, max: 0.08 },
  hard: { min: 0.01, max: 0.04 },
  acoustic: { min: 0.35, max: 0.7 },
  unknown: { min: 0.01, max: 0.7 }
};

const ceilingAbsorption: Record<CeilingAcousticTreatment, NumberRange> = {
  hard: { min: 0.03, max: 0.08 },
  partial: { min: 0.18, max: 0.45 },
  acoustic: { min: 0.45, max: 0.8 },
  unknown: { min: 0.03, max: 0.8 }
};

const glassFraction: Record<GlassCoverage, NumberRange> = {
  none: { min: 0.08, max: 0.2 },
  partial: { min: 0.08, max: 0.2 },
  large: { min: 0.25, max: 0.55 },
  unknown: { min: 0, max: 0.55 }
};

const treatmentAbsorption: Record<SoftTreatment, { fraction: NumberRange; coefficient: NumberRange }> = {
  none: { fraction: { min: 0, max: 0 }, coefficient: { min: 0, max: 0 } },
  curtains: { fraction: { min: 0.1, max: 0.3 }, coefficient: { min: 0.25, max: 0.55 } },
  acousticPanels: { fraction: { min: 0.15, max: 0.45 }, coefficient: { min: 0.45, max: 0.85 } },
  mixed: { fraction: { min: 0.12, max: 0.35 }, coefficient: { min: 0.3, max: 0.7 } },
  unknown: { fraction: { min: 0, max: 0.35 }, coefficient: { min: 0.2, max: 0.75 } }
};

const furnishingAbsorption: Record<FurnishingDensity, NumberRange> = {
  empty: { min: 0.01, max: 0.04 },
  normal: { min: 0.06, max: 0.14 },
  dense: { min: 0.12, max: 0.22 },
  unknown: { min: 0.01, max: 0.2 }
};

export const getAcousticAssessment = (profile: ClassroomProfile): AcousticAssessment => {
  const environment = profile.acousticEnvironment;
  const roomVolume = getRoomVolume(profile);
  const reference = getReverberationReference(profile, roomVolume);
  const measuredRt60 = getValidMeasuredRt60(environment.measuredRt60);
  const estimated = measuredRt60 === undefined ? estimateRtRange(profile) : { nominal: measuredRt60, min: measuredRt60, max: measuredRt60 };
  const source = measuredRt60 === undefined ? "estimated" : "measured";
  const confidence = getAssessmentConfidence(profile, source);
  let risk = classifyRt(estimated.nominal, reference);

  if (environment.echoObservation === "obvious") risk = "high";
  if (environment.echoObservation === "tail" && risk === "low") risk = "medium";
  if (confidence === "low" && risk === "low") risk = "medium";

  const factors = getAssessmentFactors(profile);
  const reasons = getAssessmentReasons(profile, risk, source, confidence, estimated, reference);
  const suggestions = getAssessmentSuggestions(risk, confidence, source);

  return {
    risk,
    label: risk === "high" ? "混响风险大" : risk === "medium" ? "混响风险中" : "混响风险小",
    source,
    confidence,
    roomVolume: roundOne(roomVolume),
    targetRt: reference.targetRt,
    highRiskRt: reference.highRiskRt,
    estimatedRt: roundTwo(estimated.nominal),
    estimatedRtRange: { min: roundTwo(estimated.min), max: roundTwo(estimated.max) },
    reference: reference.reference,
    factors,
    reasons,
    suggestions
  };
};

export const getReverberationRisk = (profile: ClassroomProfile): ReverberationRisk => getAcousticAssessment(profile).risk;

export const getRoomVolume = (profile: ClassroomProfile) => {
  const { length, width, height } = profile.roomGeometry;
  return length > 0 && width > 0 && height > 0 ? length * width * height : 0;
};

function getReverberationReference(profile: ClassroomProfile, roomVolume: number): ReverberationReference {
  const speechCritical =
    profile.needs.some((need) => need === "videoConference" || need === "interactiveClass" || need === "recording" || need === "remoteTeaching") ||
    /视频会议|互动|录播|远程/.test(profile.customNeed);

  if (profile.scenario === "meetingRoom") {
    return { targetRt: 0.6, highRiskRt: 0.8, reference: "会议 / 视频会议语音目标 0.6s，BB93 上限 0.8s" };
  }

  if (profile.scenario === "standardClassroom" || profile.scenario === "combinedClassroom") {
    if (speechCritical) {
      const targetRt = roomVolume <= 300 ? 0.6 : 0.8;
      return { targetRt, highRiskRt: roundOne(targetRt + 0.2), reference: "GB 50118 语言及多媒体教室空场中频混响时间" };
    }
    const targetRt = roomVolume <= 200 ? 0.8 : 1;
    return { targetRt, highRiskRt: roundOne(targetRt + 0.2), reference: "GB 50118 普通教室空场 500Hz-1000Hz 混响时间" };
  }

  if (profile.scenario === "lectureClassroom") {
    const targetRt = roomVolume <= 500 ? 0.8 : 1;
    return { targetRt, highRiskRt: roundOne(targetRt + 0.2), reference: "BB93 小型 / 大型讲堂中频混响时间" };
  }

  if (profile.scenario === "auditorium") {
    return { targetRt: 1, highRiskRt: 1.2, reference: "BB93 多用途厅语音使用中频混响时间范围" };
  }

  return { targetRt: 0.8, highRiskRt: 1, reference: "一般语音交流空间参考目标" };
}

function estimateRtRange(profile: ClassroomProfile) {
  const { length, width, height } = profile.roomGeometry;
  const volume = Math.max(0.1, length * width * height);
  const floorArea = Math.max(0.1, length * width);
  const wallArea = Math.max(0.1, 2 * (length + width) * height);
  const environment = profile.acousticEnvironment;
  const treatment = treatmentAbsorption[environment.softTreatment ?? "unknown"];
  const inputs: AbsorptionInputs = {
    floor: floorAbsorption[environment.floorMaterial ?? "unknown"],
    ceiling: ceilingAbsorption[environment.ceilingAcousticTreatment ?? "unknown"],
    wall: wallAbsorption[environment.wallMaterial ?? "unknown"],
    glassFraction: glassFraction[getGlassCoverage(profile)],
    glass: { min: 0.02, max: 0.05 },
    treatmentFraction: treatment.fraction,
    treatment: treatment.coefficient,
    furnishing: furnishingAbsorption[environment.furnishingDensity ?? "unknown"]
  };
  const ranges = [
    inputs.floor,
    inputs.ceiling,
    inputs.wall,
    inputs.glassFraction,
    inputs.glass,
    inputs.treatmentFraction,
    inputs.treatment,
    inputs.furnishing
  ];
  const absorptionValues: number[] = [];

  for (let mask = 0; mask < 1 << ranges.length; mask += 1) {
    const values = ranges.map((range, index) => (mask & (1 << index) ? range.max : range.min));
    absorptionValues.push(getEquivalentAbsorptionArea(floorArea, wallArea, values));
  }

  const nominalValues = ranges.map(midpoint);
  const nominalAbsorption = getEquivalentAbsorptionArea(floorArea, wallArea, nominalValues);
  const minAbsorption = Math.max(0.1, Math.min(...absorptionValues));
  const maxAbsorption = Math.max(0.1, Math.max(...absorptionValues));

  return {
    nominal: clamp(SABINE_METRIC_CONSTANT * volume / nominalAbsorption, MIN_ESTIMATED_RT, MAX_ESTIMATED_RT),
    min: clamp(SABINE_METRIC_CONSTANT * volume / maxAbsorption, MIN_ESTIMATED_RT, MAX_ESTIMATED_RT),
    max: clamp(SABINE_METRIC_CONSTANT * volume / minAbsorption, MIN_ESTIMATED_RT, MAX_ESTIMATED_RT)
  };
}

function getEquivalentAbsorptionArea(floorArea: number, wallArea: number, values: number[]) {
  const [floor, ceiling, wall, glassShare, glass, treatmentShare, treatment, furnishing] = values;
  const glassArea = wallArea * glassShare;
  const remainingWallArea = Math.max(0, wallArea - glassArea);
  const treatedWallArea = remainingWallArea * treatmentShare;
  const baseWallArea = Math.max(0, remainingWallArea - treatedWallArea);
  return (
    floorArea * floor +
    floorArea * ceiling +
    baseWallArea * wall +
    treatedWallArea * treatment +
    glassArea * glass +
    floorArea * furnishing
  );
}

function classifyRt(rt: number, reference: ReverberationReference): ReverberationRisk {
  if (rt <= reference.targetRt) return "low";
  if (rt <= reference.highRiskRt) return "medium";
  return "high";
}

function getAssessmentConfidence(profile: ClassroomProfile, source: AcousticAssessment["source"]): AcousticAssessmentConfidence {
  if (source === "measured") return getRoomVolume(profile) > 0 ? "high" : "low";
  const environment = profile.acousticEnvironment;
  const unknownCount = [
    environment.floorMaterial,
    environment.wallMaterial,
    environment.softTreatment,
    environment.ceilingAcousticTreatment ?? "unknown",
    getGlassCoverage(profile),
    environment.furnishingDensity
  ].filter((value) => value === "unknown").length + (getRoomVolume(profile) > 0 ? 0 : 1);
  return unknownCount === 0 ? "medium" : "low";
}

function getAssessmentFactors(profile: ClassroomProfile): AcousticAssessment["factors"] {
  const environment = profile.acousticEnvironment;
  const ceiling = environment.ceilingAcousticTreatment ?? "unknown";
  const glass = getGlassCoverage(profile);
  const roomVolume = getRoomVolume(profile);
  const roomHeight = profile.roomGeometry.height;
  const factors: AcousticAssessment["factors"] = [
    {
      label: "使用场景",
      impact: "neutral",
      detail: "使用场景用于选择目标 RT60，不改变房间的物理混响。"
    },
    {
      label: "主要语音用途",
      impact: "neutral",
      detail: "语音用途用于决定目标是否收紧，不直接改变房间混响。"
    },
    {
      label: "房间体积",
      impact: roomVolume > 600 ? "strongIncrease" : roomVolume >= 300 ? "slightIncrease" : roomVolume < 150 ? "slightDecrease" : "neutral",
      detail: `${roundOne(roomVolume)}m3，体积用于混响估算和场景目标选择。`
    },
    {
      label: "吊顶结构",
      impact: profile.engineeringConstraints.ceiling === "exposed" ? (roomHeight > 3.2 ? "strongIncrease" : "slightIncrease") : "neutral",
      detail: profile.engineeringConstraints.ceiling === "exposed"
        ? `无吊顶，层高 ${roundOne(roomHeight)}m。`
        : profile.engineeringConstraints.ceiling === "suspended"
          ? "有吊顶，实际吸声能力由顶面吸声判断。"
          : "吊顶结构待确认。"
    },
    {
      label: "顶面吸声",
      impact: ceiling === "acoustic" ? "strongDecrease" : ceiling === "partial" ? "slightDecrease" : "neutral",
      detail: ceiling === "acoustic" ? "大面积吸声顶面可增加等效吸声面积。" : ceiling === "hard" ? "硬质顶面反射较强。" : ceiling === "partial" ? "局部吸声可降低部分反射。" : "顶面吸声情况待确认。"
    },
    {
      label: "地面",
      impact: environment.floorMaterial === "carpet" ? "slightDecrease" : environment.floorMaterial === "tile" ? "strongIncrease" : "neutral",
      detail: environment.floorMaterial === "carpet" ? "软质地面可吸收部分中高频声能。" : environment.floorMaterial === "tile" ? "瓷砖 / 石材地面反射较强。" : "地面按当前材质范围估算。"
    },
    {
      label: "墙面",
      impact: environment.wallMaterial === "acoustic" ? "strongDecrease" : environment.wallMaterial === "painted" ? "slightIncrease" : "neutral",
      detail: environment.wallMaterial === "acoustic" ? "吸音墙面可明显增加等效吸声。" : environment.wallMaterial === "painted" ? "普通粉刷墙按小幅增加计入。" : environment.wallMaterial === "hard" ? "硬质墙面按中性基准计入。" : "墙面情况待确认。"
    },
    {
      label: "软装 / 吸音",
      impact: environment.softTreatment === "acousticPanels"
        ? "strongDecrease"
        : environment.softTreatment === "mixed" || (environment.softTreatment === "curtains" && glass === "large")
          ? "slightDecrease"
          : "neutral",
      detail: environment.softTreatment === "curtains"
        ? glass === "large" ? "大面积玻璃配有窗帘，按小幅降低计入。" : "非大面积玻璃场景的窗帘按中性计入。"
        : environment.softTreatment === "mixed" ? "窗帘与少量吸音混合按小幅降低计入。"
          : environment.softTreatment === "acousticPanels" ? "吸音板 / 声学装修按明显降低计入。"
            : environment.softTreatment === "none" ? "基本无软装吸音，按中性基准计入。" : "软装 / 吸音情况待确认。"
    },
    {
      label: "玻璃比例",
      impact: glass === "large" ? "strongIncrease" : "neutral",
      detail: glass === "large" ? "大面积玻璃会增加反射风险。" : glass === "partial" ? "少量玻璃按局部反射计入。" : glass === "unknown" ? "玻璃比例待确认。" : "基本无玻璃墙。"
    },
    {
      label: "家具布置",
      impact: environment.furnishingDensity === "dense" ? "slightDecrease" : environment.furnishingDensity === "empty" ? "slightIncrease" : "neutral",
      detail: environment.furnishingDensity === "dense" ? "密集家具可增加空场等效吸声。" : environment.furnishingDensity === "empty" ? "空房或家具很少时吸声面积较小。" : environment.furnishingDensity === "unknown" ? "家具布置待确认。" : "按正常桌椅布置估算。"
    },
    {
      label: "中央空调",
      impact: "neutral",
      detail: "中央空调影响噪声和阵麦避让，不参与混响风险计算。"
    }
  ];
  if (environment.echoObservation === "tail") {
    factors.push({ label: "拍手测试", impact: "slightIncrease", detail: "现场记录到明显拖尾，风险至少为中。" });
  } else if (environment.echoObservation === "obvious") {
    factors.push({ label: "拍手测试", impact: "strongIncrease", detail: "现场记录到明显回声或颤动回声，风险直接判大。" });
  } else {
    factors.push({ label: "拍手测试", impact: environment.echoObservation === "none" ? "slightDecrease" : "neutral", detail: environment.echoObservation === "none" ? "现场未发现明显拖尾，按小幅降低计入。" : "拍手测试待确认。" });
  }
  return factors;
}

function getAssessmentReasons(
  profile: ClassroomProfile,
  risk: ReverberationRisk,
  source: AcousticAssessment["source"],
  confidence: AcousticAssessmentConfidence,
  estimated: { nominal: number; min: number; max: number },
  reference: ReverberationReference
) {
  const reasons = [
    source === "measured"
      ? `实测中频 RT60 为 ${roundTwo(estimated.nominal)}s。`
      : `按体积与表面吸声估算 RT60 约 ${roundTwo(estimated.nominal)}s，范围 ${roundTwo(estimated.min)}-${roundTwo(estimated.max)}s。`,
    `当前场景目标 ${reference.targetRt.toFixed(1)}s，大风险分界 ${reference.highRiskRt.toFixed(1)}s。`
  ];
  if (confidence === "low") reasons.push("关键声学条件存在待确认项，当前结果按保守等级显示。");
  if (profile.acousticEnvironment.echoObservation === "tail") reasons.push("拍手测试存在明显拖尾。");
  if (profile.acousticEnvironment.echoObservation === "obvious") reasons.push("拍手测试存在明显回声或颤动回声。");
  if (profile.scenario === "auditorium") reasons.push("报告厅仍需专项声学复核。");
  if (risk === "low" && confidence !== "low") reasons.push("当前声学条件处于场景目标范围内。");
  return reasons;
}

function getAssessmentSuggestions(
  risk: ReverberationRisk,
  confidence: AcousticAssessmentConfidence,
  source: AcousticAssessment["source"]
) {
  const suggestions: string[] = [];
  if (confidence === "low") suggestions.push("复勘确认顶面吸声、玻璃比例和家具布置。");
  if (source === "estimated" && risk !== "low") suggestions.push("条件允许时实测正常布置、无人状态的中频 RT60。");
  if (risk === "high") suggestions.push("混响风险会影响阵麦拾音和远端语音清晰度。");
  if (risk === "medium") suggestions.push("调试时复核远端语音清晰度和明显反射声。");
  if (risk === "low") suggestions.push("当前可按常规语音空间继续方案设计。");
  return suggestions;
}

function getGlassCoverage(profile: ClassroomProfile): GlassCoverage {
  return profile.acousticEnvironment.glassCoverage ?? (profile.acousticEnvironment.hasGlassWall ? "large" : "none");
}

function getValidMeasuredRt60(value: number | undefined) {
  const measured = Number(value);
  return Number.isFinite(measured) && measured >= 0.1 && measured <= 10 ? measured : undefined;
}

function midpoint(range: NumberRange) {
  return (range.min + range.max) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}
