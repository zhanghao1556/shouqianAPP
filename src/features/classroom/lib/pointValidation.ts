import type { AppBrandId } from "../brand";
import type {
  ClassroomProfile,
  CustomerSolutionSelection,
  GeneratedPoint,
  Point,
  PointValidationFinding,
  PointValidationResult,
  PointValidationSeverity
} from "../types";
import {
  generateBrandEngineeringPoints,
  getBrandSystemCapability,
  getShortestManhattanCascadeRoute
} from "./systemCapabilities";
import { getArrayMicCentralAirRequiredClearance, getEffectiveAmplificationScope } from "./drawingEngine";
import {
  SMALL_DISC_LINK_SEGMENT_LIMIT_M,
  SMALL_DISC_RECOMMENDED_SLAVE_COUNT,
  SMALL_DISC_RECORDING_RECOMMENDED_COUNT
} from "./yinmanSmallDiscRules";

const ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M = 1;
const ARRAY_MIC_BODY_HALF_SIZE_M = 0.3;
const MIC_SPEAKER_PREFERRED_DISTANCE_M = 2;
const LINE_ARRAY_NON_AFC_SPEAKER_DISTANCE_M = 1.2;
const HIGH_SUSPENDED_CEILING_REVIEW_HEIGHT_M = 3.5;

export interface PointValidationInput {
  profile: ClassroomProfile;
  brandId: AppBrandId;
  generatedPoints: GeneratedPoint[];
  requiredArrayMicCount: number;
  requiredSpeakerCount: number;
  solutionSelection?: CustomerSolutionSelection;
}

export function validatePointPlan(input: PointValidationInput): PointValidationResult {
  const { profile, brandId, generatedPoints, requiredArrayMicCount, requiredSpeakerCount, solutionSelection } = input;
  const capability = getBrandSystemCapability(brandId);
  const mics = generatedPoints.filter((point) => point.type === "arrayMic");
  const smallDiscMics = mics.filter(isSmallDiscPoint);
  const arrayMics = mics.filter((point) => point.pickupKind !== "hangingMic" && !isSmallDiscPoint(point));
  const hangingMics = mics.filter((point) => point.pickupKind === "hangingMic");
  const speakers = generatedPoints.filter((point) => point.type === "speaker");
  const findings: PointValidationFinding[] = [];

  if (solutionSelection?.drawingBlocked) {
    findings.push({
      code: "selection.line-array-coverage",
      severity: "hard",
      title: "线阵麦覆盖能力",
      internalMessage: solutionSelection.blockingMessage ?? "客户选择的线阵麦方案无法完整覆盖当前责任区，点位和拓扑已停止生成。",
      customerMessage: "该方案无法完整覆盖，建议改选阵麦。",
      sourceRefs: ["用户确认的线阵麦硬能力阻断规则"]
    });
  }

  if (solutionSelection?.microphone.lineArrayCoverageWarning) {
    findings.push({
      code: "selection.line-array-online-coverage",
      severity: "warning",
      title: "线阵麦线上拾音覆盖",
      internalMessage: `${solutionSelection.microphone.lineArrayCoverageWarning} 当前继续生成方案，线上拾音无法全覆盖。`,
      customerMessage: "线阵麦线上拾音无法全覆盖，需现场复核或补充拾音设备。",
      sourceRefs: ["用户确认的线阵麦8m线上拾音与非阻断规则"]
    });
  }

  if (
    solutionSelection?.microphone.selected === "lineArray" &&
    solutionSelection.microphone.isNonRecommended &&
    !solutionSelection.microphone.lineArrayCoverageWarning &&
    !solutionSelection.drawingBlocked
  ) {
    findings.push({
      code: "selection.line-array-non-recommended",
      severity: "warning",
      title: "线阵麦非推荐选择",
      internalMessage: `${solutionSelection.microphone.recommendationReason} 客户仍可按当前选择继续生成图纸。`,
      sourceRefs: ["用户确认的两线阵不自动推荐规则", "统一麦克风推荐判定"]
    });
  }

  if (solutionSelection?.speaker.requiresSpecialReview) {
    findings.push({
      code: "selection.ceiling-installation",
      severity: "hard",
      title: "吸顶音箱安装条件",
      actual: "顶面不可安装",
      limit: "需具备顶面安装条件",
      internalMessage: "客户强制选择吸顶音箱，按确认规则继续生成吸顶方案，并标记专项复核。",
      customerMessage: "顶面安装条件与吸顶音箱方案需要专项复核。",
      sourceRefs: ["用户确认的强制吸顶继续出图规则"]
    });
  }

  if (smallDiscMics.length > 0) {
    addSmallDiscFindings(findings, profile, smallDiscMics);
  } else if (hangingMics.length > 0) {
    findings.push({
      code: "hanging-mic.coverage-capacity",
      severity: solutionSelection?.microphone.hangingMicCapacityWarning ? "warning" : "info",
      title: "吊麦覆盖与MIC容量",
      actual: `${hangingMics.length}只 / 半径3m`,
      limit: "每只占1路MIC",
      internalMessage: solutionSelection?.microphone.hangingMicCapacityWarning ?? "当前吊麦数量按讲台活动区3m覆盖计算，并受处理器剩余MIC输入容量限制。",
      customerMessage: solutionSelection?.microphone.hangingMicCapacityWarning,
      sourceRefs: ["用户确认的吊麦3m覆盖与单只单MIC规则"]
    });
  } else if (profile.roomGeometry.length > 0 && profile.roomGeometry.width > 0) {
    findings.push({
      code: "array.coverage-baseline",
      severity: "info",
      title: "阵麦覆盖口径",
      actual: `线上 ${capability.onlinePickupRadiusM}m / 扩声 ${capability.localAmplificationRadiusM}m`,
      internalMessage: `当前继续按主轴判断数量；线上拾音（含线上互动）为半径 ${capability.onlinePickupRadiusM}m，本地扩声为半径 ${capability.localAmplificationRadiusM}m。`,
      sourceRefs: ["用户确认的阵麦覆盖口径", "当前主轴数量算法"]
    });
  }

  if (!hangingMics.length && !smallDiscMics.length && requiredArrayMicCount > capability.maxArrayMicCount) {
    findings.push({
      code: "array.capacity",
      severity: "hard",
      title: "阵麦能力上限",
      actual: requiredArrayMicCount,
      limit: capability.maxArrayMicCount,
      internalMessage: `当前主轴算法理论需要 ${requiredArrayMicCount} 只，品牌能力最多部署 ${capability.maxArrayMicCount} 只；点位已按上限生成。`,
      customerMessage: "房间长度与阵麦覆盖能力需要专项复核。",
      sourceRefs: [brandId === "yinman" ? "音曼阵麦与音频处理主机能力确认" : "音翼一主四从能力确认"]
    });
  } else if (!hangingMics.length && !smallDiscMics.length && arrayMics.length > 0) {
    findings.push({
      code: "array.capacity",
      severity: "info",
      title: "阵麦数量能力",
      actual: arrayMics.length,
      limit: capability.maxArrayMicCount,
      internalMessage: `当前生成 ${arrayMics.length} 只，未超过品牌能力上限 ${capability.maxArrayMicCount} 只。`,
      sourceRefs: ["用户确认的品牌阵麦能力"]
    });
  }

  addCascadeRouteFinding(findings, brandId, arrayMics);
  addSpeakerCapacityFinding(findings, brandId, requiredSpeakerCount, speakers.length);
  addLineArraySpeakerFindings(findings, profile, arrayMics, speakers);
  addWallSpeakerCoverageFinding(findings, speakers);
  addInstallationHeightFinding(findings, profile, mics.filter((point) => !isSmallDiscPoint(point)));
  addMicSpeakerDistanceFinding(findings, profile, mics, speakers);
  addCentralAirFindings(findings, profile, brandId, mics);
  if (!hangingMics.length) addExistingCalibrationFindings(findings, profile, brandId, arrayMics);

  return summarizeFindings(findings);
}

function isSmallDiscPoint(point: GeneratedPoint) {
  return point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02" || point.pickupKind === "smallDisc03";
}

function addSmallDiscFindings(findings: PointValidationFinding[], profile: ClassroomProfile, mics: GeneratedPoint[]) {
  const usesBuiltInProcessing = mics.some((mic) => mic.pickupKind === "smallDisc01");
  const radius = Math.max(...mics.map((mic) => mic.coverageRadius ?? 0));
  const recommendedCount = usesBuiltInProcessing ? SMALL_DISC_RECOMMENDED_SLAVE_COUNT + 1 : SMALL_DISC_RECORDING_RECOMMENDED_COUNT;
  findings.push({
    code: "small-disc.coverage-baseline",
    severity: "info",
    title: "小圆盘阵麦覆盖口径",
    actual: `${mics.length}只 / 半径${radius.toFixed(1)}m`,
    limit: usesBuiltInProcessing ? "1只主麦 + 推荐不超过3只从麦" : "推荐不超过3只",
    internalMessage: usesBuiltInProcessing
      ? "主麦优先布置在核心位置，从麦按主要活动区覆盖需要补充；理论上可继续级联。"
      : "录音巡课阵麦只覆盖讲台、会议桌等主要区域，整条级联链共用一个音频扩展器。",
    sourceRefs: ["用户确认的小圆盘阵麦覆盖与级联口径"]
  });

  if (mics.length > recommendedCount) {
    findings.push({
      code: "small-disc.recommended-count",
      severity: "hard",
      title: "小圆盘阵麦推荐数量",
      actual: mics.length,
      limit: recommendedCount,
      internalMessage: usesBuiltInProcessing
        ? `当前包含${mics.length - 1}只从麦，超过推荐的3只从麦边界；继续保留方案并转专项复核。`
        : `当前包含${mics.length}只录音巡课阵麦，超过推荐的3只边界；继续保留方案并转专项复核。`,
      customerMessage: "小圆盘阵麦数量超出常规推荐范围，当前方案需专项复核。",
      sourceRefs: ["用户确认的01主麦加3只从麦与03三只推荐边界"]
    });
  }

  if (profile.engineeringConstraints.overheadSpeakerMounting === "unavailable") {
    findings.push({
      code: "small-disc.overhead-installation",
      severity: "hard",
      title: "小圆盘阵麦顶面安装条件",
      actual: "顶面不可安装",
      limit: "需具备吊杆固定条件",
      internalMessage: "三款小圆盘阵麦均只能采用吊杆安装；当前继续生成点位并转专项复核。",
      customerMessage: "顶面安装条件会影响小圆盘阵麦吊杆安装，当前方案需专项复核。",
      sourceRefs: ["用户确认的小圆盘阵麦吊杆安装规则"]
    });
  }

  if (profile.engineeringConstraints.ceiling === "suspended" && profile.roomGeometry.height > HIGH_SUSPENDED_CEILING_REVIEW_HEIGHT_M) {
    findings.push({
      code: "small-disc.install-height",
      severity: "warning",
      title: "小圆盘阵麦安装高度",
      actual: `${profile.roomGeometry.height.toFixed(1)}m`,
      limit: `资料建议 <= ${HIGH_SUSPENDED_CEILING_REVIEW_HEIGHT_M}m`,
      internalMessage: "沿用大圆盘阵麦安装高度边界，吊杆长度与拾音高度需要现场复核。",
      sourceRefs: ["用户确认的小圆盘阵麦沿用大圆盘阵麦安装高度规则"]
    });
  }

  if (mics.length <= 1) return;
  const segments = mics.slice(1).map((mic, index) => ({
    from: mics[index],
    to: mic,
    length: Math.abs(mic.position.x - mics[index].position.x) + Math.abs(mic.position.y - mics[index].position.y)
  }));
  const longest = segments.reduce((current, segment) => segment.length > current.length ? segment : current, segments[0]);
  const overLimit = longest.length > SMALL_DISC_LINK_SEGMENT_LIMIT_M;
  findings.push({
    code: "small-disc.link-segment",
    severity: overLimit ? "hard" : "info",
    title: "小圆盘阵麦级联网线单段",
    actual: `${longest.length.toFixed(1)}m`,
    limit: `${SMALL_DISC_LINK_SEGMENT_LIMIT_M}m`,
    internalMessage: `按点位顺序估算最长单段为 ${longest.from.label} 至 ${longest.to.label}，施工采用超五类纯铜网线并按T568B制作。`,
    customerMessage: overLimit ? "小圆盘阵麦级联网线单段长度会影响连接，当前方案需专项复核。" : undefined,
    sourceRefs: ["用户确认的小圆盘阵麦单段20m级联网线规则"]
  });
}

function addLineArraySpeakerFindings(
  findings: PointValidationFinding[],
  profile: ClassroomProfile,
  mics: GeneratedPoint[],
  speakers: GeneratedPoint[]
) {
  const usesFrontLineArray = mics.some((mic) => mic.pickupKind === "lineArray" && mic.pickupPattern === "front180");
  if (!usesFrontLineArray || !speakers.length) return;
  const wallSpeakers = speakers.filter((speaker) => speaker.horizontalAngle !== undefined || speaker.downTiltAngle !== undefined);
  const approvedRearCenterFill = isApprovedLineArrayRearCenterFill(profile, wallSpeakers);
  if ((wallSpeakers.length === 1 || wallSpeakers.length === 3) && !approvedRearCenterFill) {
    findings.push({
      code: "speaker.line-array-odd-wall-count",
      severity: "hard",
      title: "线阵正面扩声壁挂奇数配置",
      actual: wallSpeakers.length,
      limit: "2只或4只成对布置",
      internalMessage: "手动壁挂数量为奇数，继续保留原兜底点位，不生成不对称的线阵专属布局。",
      customerMessage: "壁挂音箱数量与对称覆盖需要专项复核。",
      sourceRefs: ["用户确认的线阵正面扩声壁挂2/4只规则"]
    });
    return;
  }
  if (wallSpeakers.length !== 2) return;
  const sideSpeakers = wallSpeakers.filter((speaker) =>
    (Math.abs(speaker.position.x) <= 0.05 || Math.abs(speaker.position.x - profile.roomGeometry.width) <= 0.05) &&
    speaker.position.y > 0.05 && speaker.position.y < profile.roomGeometry.length - 0.05
  );
  if (sideSpeakers.length !== 2) return;
  if (
    profile.roomGeometry.length <= 10 &&
    profile.roomGeometry.width >= 13
  ) {
    const expectedCount = profile.roomGeometry.width > 18 ? 4 : 3;
    findings.push({
      code: "speaker.line-array-center-fill-omitted",
      severity: "warning",
      title: "线阵短房后墙中区补声",
      actual: 2,
      limit: expectedCount,
      internalMessage: profile.roomGeometry.width > 18
        ? "超过18m宽房当前仅保留两只侧墙壁挂，视为后墙双补声无法安装的现场兜底；中区覆盖需现场复核。"
        : "13-18m宽房当前仅保留两只侧墙壁挂，视为后墙中置无法安装的现场兜底；中轴覆盖需现场复核。",
      sourceRefs: ["用户确认的线阵短房两侧墙加后墙中区补声规则"]
    });
  }
  if (profile.roomGeometry.length <= 10) return;
  const rearGap = profile.roomGeometry.length - Math.min(...sideSpeakers.map((speaker) => speaker.position.y));
  const coverageRadius = Math.min(...sideSpeakers.map((speaker) => speaker.coverageRadius ?? 5));
  if (rearGap <= coverageRadius + 0.05) return;
  findings.push({
    code: "speaker.line-array-two-wall-coverage",
    severity: "warning",
    title: "线阵正面扩声两只壁挂后场覆盖",
    actual: `${rearGap.toFixed(1)}m`,
    limit: `${coverageRadius.toFixed(1)}m`,
    internalMessage: "两只侧墙壁挂朝后时无法完整覆盖后场，建议增加到4只；当前不自动改变客户数量。",
    sourceRefs: ["用户确认的两只不足时建议增加侧墙或后墙补声规则"]
  });
}

function isApprovedLineArrayRearCenterFill(profile: ClassroomProfile, wallSpeakers: GeneratedPoint[]) {
  if (
    wallSpeakers.length !== 3 ||
    profile.roomGeometry.length > 10 ||
    profile.roomGeometry.width < 13 ||
    profile.roomGeometry.width > 18
  ) return false;
  const sideCount = wallSpeakers.filter((speaker) =>
    (Math.abs(speaker.position.x) <= 0.05 || Math.abs(speaker.position.x - profile.roomGeometry.width) <= 0.05) &&
    speaker.position.y > 0.05 && speaker.position.y < profile.roomGeometry.length - 0.05
  ).length;
  const centerCount = wallSpeakers.filter((speaker) =>
    Math.abs(speaker.position.x - profile.roomGeometry.width / 2) <= 0.05 &&
    Math.abs(speaker.position.y - profile.roomGeometry.length) <= 0.05
  ).length;
  return sideCount === 2 && centerCount === 1;
}

function addWallSpeakerCoverageFinding(findings: PointValidationFinding[], speakers: GeneratedPoint[]) {
  const reviewed = speakers.filter((speaker) => speaker.responsibilityEdgeCoverage && speaker.responsibilityEdgeCoverage.total > 0);
  const insufficient = reviewed.filter(
    (speaker) => {
      const coverage = speaker.responsibilityEdgeCoverage;
      if (!coverage || coverage.total <= 0) return false;
      return coverage.covered / coverage.total <= 0.6;
    }
  );
  if (!insufficient.length) return;
  const covered = insufficient.reduce((sum, speaker) => sum + (speaker.responsibilityEdgeCoverage?.covered ?? 0), 0);
  const total = insufficient.reduce((sum, speaker) => sum + (speaker.responsibilityEdgeCoverage?.total ?? 0), 0);
  findings.push({
    code: "speaker.wall-responsibility-edge",
    severity: "warning",
    title: "壁挂音箱责任区边缘覆盖",
    actual: `${covered}/${total}`,
    limit: "责任区边缘全部覆盖",
    internalMessage: `${insufficient.map((speaker) => speaker.label).join("、")} 在现有数量、覆盖半径、85°覆盖角和安装角范围内仍有责任区边缘采样点未覆盖，需要现场复核或调整音箱配置。`,
    sourceRefs: ["用户确认的壁挂音箱覆盖责任区与自动指向规则"]
  });
}

export function getCustomerPointValidationStatus(result: PointValidationResult): string | undefined {
  return result.hardCount > 0 ? "需专项复核" : undefined;
}

function addCascadeRouteFinding(findings: PointValidationFinding[], brandId: AppBrandId, mics: GeneratedPoint[]) {
  const capability = getBrandSystemCapability(brandId);
  if (capability.arrayMicTopology !== "cascade" || mics.length <= 1 || capability.cascadeRouteLimitM === undefined) return;
  const route = getShortestManhattanCascadeRoute(mics.map((mic) => mic.position));
  const routeText = route.pointOrder.map((point) => `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`).join(" -> ");
  const overLimit = route.lengthM > capability.cascadeRouteLimitM;
  findings.push({
    code: "array.cascade-route",
    severity: overLimit ? "hard" : "info",
    title: "阵麦级联施工折线",
    actual: `${route.lengthM.toFixed(1)}m`,
    limit: `${capability.cascadeRouteLimitM}m`,
    internalMessage: `按最短串联顺序累计 |Δx| + |Δy|，路径 ${routeText}，估算总长 ${route.lengthM.toFixed(1)}m。`,
    customerMessage: overLimit ? "阵麦级联网线长度会影响系统连接，当前方案需专项复核。" : undefined,
    sourceRefs: ["阵列麦安装与级联网线资料", "用户确认的施工折线路径口径"]
  });
}

function addSpeakerCapacityFinding(
  findings: PointValidationFinding[],
  brandId: AppBrandId,
  requiredSpeakerCount: number,
  generatedSpeakerCount: number
) {
  const capability = getBrandSystemCapability(brandId);
  if (requiredSpeakerCount > capability.totalSpeakerCapacity) {
    findings.push({
      code: "speaker.system-capacity",
      severity: "hard",
      title: "无源音箱系统容量",
      actual: requiredSpeakerCount,
      limit: capability.totalSpeakerCapacity,
      internalMessage: `理论需要 ${requiredSpeakerCount} 只，当前自动生成 ${generatedSpeakerCount} 只且不超过系统 ${capability.totalSpeakerCapacity} 只上限；仍需拆区或专项设计。`,
      customerMessage: "音箱数量与系统分区容量需要专项复核。",
      sourceRefs: ["用户确认的音箱与扩展功放容量"]
    });
    return;
  }
  if (generatedSpeakerCount > capability.integratedSpeakerCapacity) {
    findings.push({
      code: "speaker.external-amplifier",
      severity: "info",
      title: "扩展功放配置",
      actual: generatedSpeakerCount,
      limit: capability.integratedSpeakerCapacity,
      internalMessage: `前 ${capability.integratedSpeakerCapacity} 只由音频核心直接驱动，其余 ${generatedSpeakerCount - capability.integratedSpeakerCapacity} 只由 1 台教学模拟功放主机扩展。`,
      sourceRefs: [brandId === "yinman" ? "音曼音频处理主机与功放容量确认" : "音翼内置功放与扩展功放容量确认"]
    });
  }
}

function addInstallationHeightFinding(findings: PointValidationFinding[], profile: ClassroomProfile, mics: GeneratedPoint[]) {
  if (profile.engineeringConstraints.ceiling !== "suspended" || profile.roomGeometry.height <= HIGH_SUSPENDED_CEILING_REVIEW_HEIGHT_M || !mics.length) return;
  findings.push({
    code: "array.install-height",
    severity: "warning",
    title: "高吊顶安装复核",
    actual: `${profile.roomGeometry.height.toFixed(1)}m`,
    limit: `资料建议 <= ${HIGH_SUSPENDED_CEILING_REVIEW_HEIGHT_M}m`,
    internalMessage: `按已确认规则继续贴顶安装，不移动点位；当前高度超过产品资料建议，需要复核直达声与调试余量。`,
    sourceRefs: ["用户确认的吊顶贴顶安装规则", "阵列麦安装高度资料"]
  });
}

function addMicSpeakerDistanceFinding(
  findings: PointValidationFinding[],
  profile: ClassroomProfile,
  mics: GeneratedPoint[],
  speakers: GeneratedPoint[]
) {
  const ceilingSpeakers = speakers.filter((speaker) => speaker.horizontalAngle === undefined && speaker.downTiltAngle === undefined);
  if (!mics.length || !ceilingSpeakers.length) return;
  const nearest = ceilingSpeakers.reduce<{
    mic: GeneratedPoint;
    speaker: GeneratedPoint;
    distance: number;
  } | null>((best, speaker) => {
    const candidate = mics.reduce((micBest, mic) => {
      const distance = getDistance(mic.position, speaker.position);
      return !micBest || distance < micBest.distance ? { mic, speaker, distance } : micBest;
    }, null as { mic: GeneratedPoint; speaker: GeneratedPoint; distance: number } | null);
    return candidate && (!best || candidate.distance < best.distance) ? candidate : best;
  }, null);
  if (!nearest) return;

  const isTeacherMonitor = nearest.speaker.reason.includes("老师区") || nearest.speaker.reason.includes("监听点位");
  const isCenterBackfill = nearest.speaker.reason.includes("中心列覆盖回填") || isApprovedCenterBackfill(profile, nearest.speaker, mics);
  const usesLineArrayNonAfcDistance =
    nearest.mic.pickupKind === "lineArray" &&
    nearest.speaker.speakerSignalMode === "withoutLineArrayAfc";
  const isLineArrayNonAfcDistanceSatisfied =
    usesLineArrayNonAfcDistance && nearest.distance >= LINE_ARRAY_NON_AFC_SPEAKER_DISTANCE_M;
  const belowPreferred = nearest.distance < MIC_SPEAKER_PREFERRED_DISTANCE_M;
  const exception = belowPreferred && (isTeacherMonitor || isCenterBackfill || isLineArrayNonAfcDistanceSatisfied);
  findings.push({
    code: "speaker.mic-distance",
    severity: belowPreferred && !exception ? "warning" : "info",
    title: "阵麦与吸顶音箱最近距离",
    actual: `${nearest.distance.toFixed(1)}m`,
    limit: `${usesLineArrayNonAfcDistance ? LINE_ARRAY_NON_AFC_SPEAKER_DISTANCE_M : MIC_SPEAKER_PREFERRED_DISTANCE_M}m`,
    internalMessage: exception
      ? `${nearest.speaker.label} 与 ${nearest.mic.label} 最近 ${nearest.distance.toFixed(1)}m，采用${isLineArrayNonAfcDistanceSatisfied ? "线阵非AFC音箱1.2m" : isTeacherMonitor ? "老师区监听" : "中心列覆盖回填"}例外，点位保持不变。`
      : belowPreferred
        ? `${nearest.speaker.label} 与 ${nearest.mic.label} 最近 ${nearest.distance.toFixed(1)}m，未识别到已确认例外，需要现场复核。`
        : `最近设备为 ${nearest.speaker.label} 与 ${nearest.mic.label}，距离 ${nearest.distance.toFixed(1)}m。`,
    sourceRefs: ["阵麦与吸顶音箱距离资料", "用户确认的老师监听与中心回填例外"]
  });
}

function addCentralAirFindings(
  findings: PointValidationFinding[],
  profile: ClassroomProfile,
  brandId: AppBrandId,
  mics: GeneratedPoint[]
) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  if (profile.engineeringConstraints.hasCentralAirConditioner && centralAirPoints.length === 0) {
    findings.push({
      code: "site.central-air-position",
      severity: "warning",
      title: "中央空调点位待标注",
      internalMessage: "现场有中央空调但尚未标点，无法完成阵麦避让校核。",
      sourceRefs: ["现有5175中央空调校准规则"]
    });
    return;
  }
  if (!centralAirPoints.length || !mics.length) return;
  const requiredClearance = getArrayMicCentralAirRequiredClearance(profile);
  const minimumClearance = Math.min(
    ...mics.flatMap((mic) => centralAirPoints.map((air) => getArrayMicClearanceToCentralAir(mic.position, air)))
  );
  if (minimumClearance < requiredClearance) {
    findings.push({
      code: "site.central-air-clearance",
      severity: "error",
      title: "中央空调硬避让",
      actual: `${minimumClearance.toFixed(1)}m`,
      limit: `${requiredClearance.toFixed(1)}m`,
      internalMessage: `阵麦距中央空调本体小于当前混响联动安全距离 ${requiredClearance.toFixed(1)}m。`,
      sourceRefs: ["用户确认的0.5/0.8/1.0m混响联动规则"]
    });
  } else if (minimumClearance < ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M) {
    findings.push({
      code: "site.central-air-quality-zone",
      severity: "warning",
      title: "中央空调还原度风险区",
      actual: `${minimumClearance.toFixed(1)}m`,
      limit: `${ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M}m`,
      internalMessage: "已满足动态硬避让，但仍位于1m语音还原度风险区。",
      sourceRefs: ["现有中央空调质量风险规则"]
    });
  }
  const lateralPriorityIssue = getCentralAirLateralPriorityIssue(profile, brandId, mics);
  if (lateralPriorityIssue) {
    findings.push({
      code: "site.central-air-direction-priority",
      severity: "error",
      title: "中央空调避让方向",
      internalMessage: lateralPriorityIssue,
      sourceRefs: ["现有5175中央空调避让方向规则"]
    });
  }
}

function addExistingCalibrationFindings(
  findings: PointValidationFinding[],
  profile: ClassroomProfile,
  _brandId: AppBrandId,
  mics: GeneratedPoint[]
) {
  const scope = getEffectiveAmplificationScope(profile);
  const hasOnline = hasOnlinePickupNeed(profile);
  const length = profile.roomGeometry.length;
  const lastMicBackWallIssue = getLastMicBackWallIssue(profile, mics);
  if (lastMicBackWallIssue) {
    findings.push({
      code: "array.back-wall-distance",
      severity: "error",
      title: "从麦后墙距离",
      internalMessage: lastMicBackWallIssue,
      sourceRefs: ["现有5175从麦后墙校准规则"]
    });
  }
  if (scope === "podium" && !hasOnline && mics.length > 1) {
    findings.push({
      code: "array.podium-multi-mic",
      severity: "error",
      title: "区域扩声多麦",
      internalMessage: `${profile.scenario === "auditorium" ? "舞台" : "讲台"}区域扩声且无线上拾音需求，却生成多只阵麦。`,
      sourceRefs: ["现有5175区域扩声校准规则"]
    });
  } else if (length <= 9 && !hasOnline && mics.length > 1) {
    findings.push({
      code: "array.short-room-multi-mic",
      severity: "error",
      title: "短房间多麦",
      internalMessage: "长度 <= 9m 且无线上拾音需求，当前生成多只阵麦。",
      sourceRefs: ["现有5175短房间校准规则"]
    });
  }
  if (profile.scenario !== "combinedClassroom" && length > 9 && length <= 16 && scope === "full") {
    findings.push({
      code: "array.mid-depth-review",
      severity: "warning",
      title: "中等纵深全场扩声",
      internalMessage: "9-16m全场扩声需重点检查后排发言和听感。",
      sourceRefs: ["现有5175中等纵深校准规则"]
    });
  }
  if (length > 16 && scope === "full" && mics.length < 3) {
    findings.push({
      code: "array.long-room-review",
      severity: "warning",
      title: "长房间阵麦数量",
      internalMessage: "长度 > 16m全场扩声但少于3只阵麦，需要人工复核。",
      sourceRefs: ["现有5175长房间校准规则"]
    });
  }
}

function summarizeFindings(findings: PointValidationFinding[]): PointValidationResult {
  const count = (severity: PointValidationSeverity) => findings.filter((finding) => finding.severity === severity).length;
  const hardCount = count("hard");
  const errorCount = count("error");
  const warningCount = count("warning");
  const infoCount = count("info");
  const customerMessages = Array.from(new Set(findings.map((finding) => finding.customerMessage).filter((message): message is string => Boolean(message))));
  return {
    status: hardCount > 0 ? "hard" : errorCount > 0 || warningCount > 0 ? "review" : "pass",
    findings,
    hardCount,
    errorCount,
    warningCount,
    infoCount,
    customerMessage: customerMessages.length ? customerMessages.join(" ") : undefined
  };
}

function getCentralAirLateralPriorityIssue(profile: ClassroomProfile, brandId: AppBrandId, mics: GeneratedPoint[]) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  if (!centralAirPoints.length) return "";
  const baseProfile: ClassroomProfile = {
    ...profile,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      hasCentralAirConditioner: false,
      centralAirConditionerCount: 0,
      centralAirConditionerPoints: []
    }
  };
  const baseMics = generateBrandEngineeringPoints(baseProfile, {}, brandId).filter((point) => point.type === "arrayMic");
  for (const mic of mics) {
    const baseMic = baseMics.find((item) => item.id === mic.id);
    if (!baseMic) continue;
    const lateralMove = Math.abs(mic.position.x - baseMic.position.x);
    const depthMove = Math.abs(mic.position.y - baseMic.position.y);
    const prefersDepthMove = profile.roomGeometry.length >= profile.roomGeometry.width;
    if (prefersDepthMove && lateralMove > 0.05 && depthMove <= 0.05 && canMoveForwardOrBackwardClearOfCentralAir(profile, baseMic.position)) {
      return `${mic.label}因中央空调发生左右偏移，但当前房间前后方向存在可用点，应优先前后避让。`;
    }
    if (!prefersDepthMove && depthMove > 0.05 && lateralMove <= 0.05 && canMoveLeftOrRightClearOfCentralAir(profile, baseMic.position)) {
      return `${mic.label}因中央空调发生前后偏移，但当前房间左右方向存在可用点，应优先左右避让。`;
    }
  }
  return "";
}

function canMoveForwardOrBackwardClearOfCentralAir(profile: ClassroomProfile, position: Point) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  return centralAirPoints.some((air) => {
    const requiredClearance = getArrayMicCentralAirRequiredClearance(profile);
    const halfDepth = (air.size?.depth ?? 0.8) / 2 + requiredClearance + ARRAY_MIC_BODY_HALF_SIZE_M;
    const frontY = roundOne(air.position.y - halfDepth);
    const backY = roundOne(air.position.y + halfDepth);
    return [frontY, backY].some(
      (y) => y >= 1.2 && y <= profile.roomGeometry.length - 0.8 && centralAirPoints.every((item) => getArrayMicClearanceToCentralAir({ x: position.x, y }, item) >= requiredClearance)
    );
  });
}

function canMoveLeftOrRightClearOfCentralAir(profile: ClassroomProfile, position: Point) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  return centralAirPoints.some((air) => {
    const requiredClearance = getArrayMicCentralAirRequiredClearance(profile);
    const halfWidth = (air.size?.width ?? 0.8) / 2 + requiredClearance + ARRAY_MIC_BODY_HALF_SIZE_M;
    const leftX = roundOne(air.position.x - halfWidth);
    const rightX = roundOne(air.position.x + halfWidth);
    return [leftX, rightX].some(
      (x) => x >= 0.8 && x <= profile.roomGeometry.width - 0.8 && centralAirPoints.every((item) => getArrayMicClearanceToCentralAir({ x, y: position.y }, item) >= requiredClearance)
    );
  });
}

function getArrayMicClearanceToCentralAir(
  mic: Point,
  air: ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"][number]
) {
  const halfWidth = (air.size?.width ?? 0.8) / 2 + ARRAY_MIC_BODY_HALF_SIZE_M;
  const halfDepth = (air.size?.depth ?? 0.8) / 2 + ARRAY_MIC_BODY_HALF_SIZE_M;
  const dx = Math.max(Math.abs(mic.x - air.position.x) - halfWidth, 0);
  const dy = Math.max(Math.abs(mic.y - air.position.y) - halfDepth, 0);
  return Math.hypot(dx, dy);
}

function getLastMicBackWallIssue(profile: ClassroomProfile, mics: GeneratedPoint[]) {
  const sorted = [...mics].sort((a, b) => a.position.y - b.position.y);
  if (sorted.length <= 1) return "";
  const lastMic = sorted[sorted.length - 1];
  const backWallDistance = profile.roomGeometry.length - lastMic.position.y;
  const minimumBackWallDistance = sorted.length === 2 && profile.roomGeometry.length <= 16 ? (profile.roomGeometry.length > 12 ? 5 : 4) : 3;
  if (backWallDistance >= minimumBackWallDistance) return "";
  return `${lastMic.label}距后墙仅${backWallDistance.toFixed(1)}m，应至少保留${minimumBackWallDistance}m。`;
}

function isApprovedCenterBackfill(profile: ClassroomProfile, speaker: GeneratedPoint, mics: GeneratedPoint[]) {
  const sameAxisMics = mics.filter((mic) => Math.abs(mic.position.x - speaker.position.x) <= 0.15).sort((a, b) => a.position.y - b.position.y);
  if (!sameAxisMics.length) return false;
  for (let index = 1; index < sameAxisMics.length; index += 1) {
    const front = sameAxisMics[index - 1].position.y;
    const rear = sameAxisMics[index].position.y;
    if (rear - front >= 3.5 && Math.abs(speaker.position.y - (front + rear) / 2) <= 0.15) return true;
  }
  const firstY = sameAxisMics[0].position.y;
  if (firstY >= 4 && Math.abs(speaker.position.y - firstY / 2) <= 0.15) return true;
  const lastY = sameAxisMics[sameAxisMics.length - 1].position.y;
  const rearGap = profile.roomGeometry.length - lastY;
  return rearGap >= 4 && Math.abs(speaker.position.y - (lastY + profile.roomGeometry.length) / 2) <= 0.15;
}

function hasOnlinePickupNeed(profile: ClassroomProfile) {
  const siteText = `${profile.customNeed} ${profile.customScenario} ${profile.engineeringConstraints.notes}`;
  return (
    profile.needs.some((need) => ["recording", "videoConference", "interactiveClass"].includes(need)) ||
    (profile.needs.includes("other") && /互动课堂|学生区.*线上拾音|线上拾音|学生.*拾音/.test(siteText))
  );
}

function getDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
