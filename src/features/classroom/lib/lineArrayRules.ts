import type { AppBrandId } from "../brand";
import type { ClassroomProfile, GeneratedPoint, ProcessorTier } from "../types";
import { getEffectiveAmplificationScope } from "./drawingEngine";
import { getPodiumAudienceEdgeY } from "./podiumGeometry";
import { getReverberationRisk } from "./reverberationRules";

export const LINE_ARRAY_PRODUCT_ID = "LINE-ARRAY-MIC";
export const LINE_ARRAY_SINGLE_MAX_WIDTH_M = 10;
export const LINE_ARRAY_DOUBLE_MAX_WIDTH_M = 15;
export const LINE_ARRAY_MAX_COUNT = 2;
export const LINE_ARRAY_FULL_RADIUS_M = 5;
export const LINE_ARRAY_ACTIVITY_MAX_DEPTH_M = 5;
export const STANDARD_CLASSROOM_LINE_ARRAY_MAX_SIZE_M = 8;
export const LINE_ARRAY_HANGING_MIN_FRONT_DISTANCE_M = 2.5;
export const LINE_ARRAY_HANGING_MAX_FRONT_DISTANCE_M = 3;
export const LINE_ARRAY_HANGING_MIN_WIDTH_M = 6;
export const LINE_ARRAY_HANGING_MAX_WIDTH_M = 10;

export interface LineArrayActivityZone {
  left: number;
  right: number;
  front: number;
  rear: number;
  width: number;
  depth: number;
  centerX: number;
  centerY: number;
  label: string;
}

export interface LineArrayDecision {
  selected: boolean;
  recommended: boolean;
  requested: boolean;
  supported: boolean;
  count: number;
  supportedCount: number;
  mode: "front" | "full";
  installation: "podium" | "hanging" | "tabletop";
  position: { x: number; y: number };
  activityZone: LineArrayActivityZone;
  recommendationReason: string;
  decisionFactors: string[];
  fallbackReason?: string;
}

export function getLineArrayDecision(profile: ClassroomProfile, generatedPoints?: GeneratedPoint[]): LineArrayDecision {
  const solution = profile.engineeringConstraints.microphoneSolution ?? "auto";
  const requested = solution === "lineArray";
  const evaluationZone = getLineArrayActivityZone(profile);
  const mode = shouldCoverFullRoom(profile) ? "full" : "front";
  const support = getLineArraySupport(profile, evaluationZone, mode);
  const recommendation = getLineArrayRecommendation(profile, evaluationZone, mode, support);
  const selected = support.supported && (requested || (solution === "auto" && recommendation.recommended));
  const placement = getLineArrayPlacement(profile, evaluationZone, mode, support.count);
  const activityZone = generatedPoints ? getLineArrayActivityZone(profile, generatedPoints) : evaluationZone;
  const decisionFactors = generatedPoints
    ? recommendation.factors.map((factor, index) => index === 0 ? `覆盖：${activityZone.label} ${oneDecimal(activityZone.width)}m × ${oneDecimal(activityZone.depth)}m` : factor)
    : recommendation.factors;

  return {
    selected,
    recommended: recommendation.recommended,
    requested,
    supported: support.supported,
    count: selected ? support.count : 0,
    supportedCount: support.count,
    mode,
    installation: placement.installation,
    position: placement.position,
    activityZone,
    recommendationReason: recommendation.reason,
    decisionFactors,
    fallbackReason: support.reason
  };
}

export function getTeacherActivityZone(profile: ClassroomProfile, generatedPoints?: GeneratedPoint[]): LineArrayActivityZone {
  const { width: roomWidth, length: roomLength } = profile.roomGeometry;
  if (profile.scenario === "combinedClassroom") {
    const width = clamp(profile.engineeringConstraints.teachingAreaSize?.width || roomWidth, 0, roomWidth);
    const depth = clamp(profile.engineeringConstraints.teachingAreaSize?.depth || roomLength, 0, roomLength);
    return createZone((roomWidth - width) / 2, width, depth, "合班教室上课区");
  }
  if (profile.scenario === "auditorium") {
    const width = clamp(profile.engineeringConstraints.stageSize?.width || roomWidth, 0, roomWidth);
    const depth = clamp(profile.engineeringConstraints.stageSize?.depth || roomLength, 0, roomLength);
    return createZone((roomWidth - width) / 2, width, depth, "舞台活动区");
  }

  const boardWidth = Math.min(roomWidth / 2, 6);
  const boardLeft = (roomWidth - boardWidth) / 2;
  const boardRight = boardLeft + boardWidth;
  const automaticDepth = getAutomaticTeacherActivityDepth(profile, generatedPoints);
  const depth = profile.scenario === "standardClassroom" || profile.scenario === "lectureClassroom"
    ? automaticDepth
    : clamp(profile.engineeringConstraints.teachingAreaSize?.depth || Math.min(5, roomLength), 0, roomLength);
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  if (podiumPosition === "frontLeft") return createZone(0, boardRight, depth, "左侧讲台至中间板书区");
  if (podiumPosition === "frontRight") return createZone(boardLeft, roomWidth - boardLeft, depth, "中间板书区至右侧讲台");
  return createZone(boardLeft, boardWidth, depth, "居中板书与上课活动区");
}

export function getLineArrayFrontWidth(profile: ClassroomProfile) {
  return getLineArrayActivityZone(profile).width;
}

export function getLineArrayHangingFrontDistance(profile: ClassroomProfile) {
  const widthProgress = clamp(
    (profile.roomGeometry.width - LINE_ARRAY_HANGING_MIN_WIDTH_M) / (LINE_ARRAY_HANGING_MAX_WIDTH_M - LINE_ARRAY_HANGING_MIN_WIDTH_M),
    0,
    1
  );
  const widthDistance = LINE_ARRAY_HANGING_MIN_FRONT_DISTANCE_M + widthProgress * (LINE_ARRAY_HANGING_MAX_FRONT_DISTANCE_M - LINE_ARRAY_HANGING_MIN_FRONT_DISTANCE_M);
  const reverberationRisk = getReverberationRisk(profile);
  const reverberationOffset = reverberationRisk === "high" ? 0.5 : reverberationRisk === "medium" ? 0.25 : 0;
  return twoDecimal(clamp(widthDistance - reverberationOffset, LINE_ARRAY_HANGING_MIN_FRONT_DISTANCE_M, LINE_ARRAY_HANGING_MAX_FRONT_DISTANCE_M));
}

export function hasFullRoomPickupNeed(profile: ClassroomProfile) {
  const text = `${profile.customNeed} ${profile.engineeringConstraints.notes}`;
  const explicitFullPickup = /全场拾音|全员拾音|学生发言|观众发言|自由发言/.test(text);
  const remoteInteraction = profile.needs.some((need) => need === "videoConference" || need === "interactiveClass" || need === "remoteTeaching");
  if (profile.scenario === "auditorium") return explicitFullPickup || remoteInteraction;
  if (profile.scenario === "meetingRoom") return explicitFullPickup || remoteInteraction || profile.needs.includes("recording");
  return explicitFullPickup || remoteInteraction;
}

export function hasMeetingLeaderPosition(profile: ClassroomProfile) {
  return profile.scenario === "meetingRoom" && /领导位|主位/.test(profile.engineeringConstraints.notes);
}

export function getProcessorTier(profile: ClassroomProfile, brandId: AppBrandId, lineArrayCount: number, speakerCount: number): Exclude<ProcessorTier, "auto"> {
  if (lineArrayCount > 1) return "sixMic";
  const requested = profile.engineeringConstraints.processorTier ?? "auto";
  if (requested !== "auto" && getProcessorTiersForBrand(brandId).includes(requested)) return requested;
  if (brandId === "yinman" && lineArrayCount === 1) return "highPerformance";
  return getProcessorAlternativeTier(profile, speakerCount);
}

export function getProcessorTiersForBrand(brandId: AppBrandId): Array<Exclude<ProcessorTier, "auto">> {
  return brandId === "yinman" ? ["twoMic", "sixMic", "highPerformance"] : ["twoMic", "sixMic"];
}

export function getProcessorAlternativeTier(profile: ClassroomProfile, speakerCount: number): "twoMic" | "sixMic" {
  return getProcessorInterfaceDemand(profile, speakerCount) > 2 ? "sixMic" : "twoMic";
}

export function getProcessorInterfaceDemand(profile: ClassroomProfile, speakerCount: number) {
  const inputCount = splitDevices(profile.existingDevices.legacyWirelessMic).length;
  const outputCount = splitDevices(profile.existingDevices.recordingHost).length;
  return Math.max(inputCount, outputCount, speakerCount);
}

export function getProcessorTierName(tier: Exclude<ProcessorTier, "auto">) {
  if (tier === "sixMic") return "六麦处理器";
  if (tier === "highPerformance") return "高性能处理器";
  return "双麦处理器";
}

export function getProcessorCapacity(tier: Exclude<ProcessorTier, "auto">) {
  return tier === "twoMic" ? 2 : tier === "sixMic" ? 6 : 1;
}

function getLineArrayActivityZone(profile: ClassroomProfile, generatedPoints?: GeneratedPoint[]): LineArrayActivityZone {
  const { width, length } = profile.roomGeometry;
  if (profile.scenario === "meetingRoom") {
    if (hasMeetingLeaderPosition(profile) && !hasFullRoomPickupNeed(profile)) {
      return createZone(width / 2, 0, 0, "会议桌领导位");
    }
    return createZone(0, width, length, "会议桌全场发言区");
  }
  if (profile.scenario === "auditorium" && hasFullRoomPickupNeed(profile)) {
    return createZone(0, width, length, "报告厅全场拾音区");
  }
  return getTeacherActivityZone(profile, generatedPoints);
}

function getAutomaticTeacherActivityDepth(profile: ClassroomProfile, generatedPoints?: GeneratedPoint[]) {
  const primaryMic = generatedPoints
    ?.filter((point) => point.type === "arrayMic")
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)[0];
  if (!primaryMic) return Math.min(LINE_ARRAY_ACTIVITY_MAX_DEPTH_M, profile.roomGeometry.length);
  const markerHalfDepth = primaryMic.pickupKind === "lineArray" ? 0.12 : 0.3;
  return oneDecimal(clamp(primaryMic.position.y - markerHalfDepth, 0, profile.roomGeometry.length));
}

function getLineArraySupport(
  profile: ClassroomProfile,
  zone: LineArrayActivityZone,
  mode: "front" | "full"
): { supported: boolean; count: number; reason?: string } {
  if (mode === "full") {
    const farthest = Math.hypot(profile.roomGeometry.width / 2, profile.roomGeometry.length / 2);
    if (farthest > LINE_ARRAY_FULL_RADIUS_M) {
      return { supported: false, count: 0, reason: `全场最远发言位置约${oneDecimal(farthest)}m，超出单只线阵麦5m拾音半径，建议改选阵麦。` };
    }
    return { supported: true, count: 1 };
  }

  const depthLimited = profile.scenario === "lectureClassroom" || profile.scenario === "combinedClassroom" || profile.scenario === "auditorium";
  if (depthLimited && zone.depth > LINE_ARRAY_ACTIVITY_MAX_DEPTH_M) {
    return { supported: false, count: 0, reason: `${zone.label}纵深${oneDecimal(zone.depth)}m，超过线阵麦5m责任区边界，建议改选阵麦。` };
  }
  if (zone.width > LINE_ARRAY_DOUBLE_MAX_WIDTH_M) {
    return { supported: false, count: 0, reason: `${zone.label}宽度${oneDecimal(zone.width)}m，超过两只线阵麦15m支持上限，建议改选阵麦。` };
  }
  return { supported: true, count: zone.width > LINE_ARRAY_SINGLE_MAX_WIDTH_M ? 2 : 1 };
}

function getLineArrayRecommendation(
  profile: ClassroomProfile,
  zone: LineArrayActivityZone,
  mode: "front" | "full",
  support: { supported: boolean; count: number; reason?: string }
): { recommended: boolean; reason: string; factors: string[] } {
  const factors = [
    `覆盖：${zone.label} ${oneDecimal(zone.width)}m × ${oneDecimal(zone.depth)}m`,
    "价格：线阵麦含处理器的整套方案低于阵麦方案"
  ];
  if (!hasMicrophoneNeed(profile)) return { recommended: false, reason: "当前需求未形成明确拾音或扩声任务，默认保留阵麦方案。", factors };
  if (!support.supported) return { recommended: false, reason: support.reason ?? "线阵麦无法完整覆盖当前责任区，建议阵麦。", factors };
  if (support.count > 1) {
    return { recommended: false, reason: `当前责任区需要两只线阵麦；两线阵方案不进入自动推荐，建议采用阵麦。`, factors };
  }
  if (mode === "full" && profile.scenario !== "meetingRoom") {
    return { recommended: false, reason: "当前包含视频会议或全场拾音，线阵麦不作为自动推荐，建议采用阵麦。", factors };
  }

  const scope = getEffectiveAmplificationScope(profile);
  if (profile.scenario === "standardClassroom") {
    if (scope === "full" && (profile.roomGeometry.width > STANDARD_CLASSROOM_LINE_ARRAY_MAX_SIZE_M || profile.roomGeometry.length > STANDARD_CLASSROOM_LINE_ARRAY_MAX_SIZE_M)) {
      return { recommended: false, reason: "普通教室全场扩声仅在房间长、宽均不超过8m时推荐线阵麦，当前建议阵麦。", factors };
    }
    return {
      recommended: true,
      reason: "单只线阵麦可覆盖老师活动区，且含处理器的整套方案价格更低，优先推荐线阵麦。",
      factors: [...factors, "拾音：优先服务讲台、板书和老师走动区域，不把麦克风放在学生区中心"]
    };
  }
  if (profile.scenario === "lectureClassroom") {
    return { recommended: true, reason: "阶梯教室按讲台区域扩声，单只线阵麦可覆盖当前上课区，价格更低。", factors };
  }
  if (profile.scenario === "combinedClassroom") {
    return { recommended: true, reason: "合班教室上课区宽度不超过10m、纵深不超过5m，单只线阵麦可完整覆盖。", factors };
  }
  if (profile.scenario === "auditorium") {
    return { recommended: true, reason: "当前仅服务舞台区域扩声或拾音，单只线阵麦可利用背向抑制并降低整套方案价格。", factors };
  }
  if (profile.scenario === "meetingRoom") {
    const target = hasMeetingLeaderPosition(profile) && !hasFullRoomPickupNeed(profile) ? "领导位" : "会议桌发言区";
    const environmentFactors = profile.roomGeometry.height > 3.5
      ? ["安装：桌面放置可避免高吊顶吊挂"]
      : [];
    return { recommended: true, reason: `线阵麦桌面放置可覆盖${target}，近距离拾音且整套方案价格更低。`, factors: [...factors, ...environmentFactors] };
  }
  return { recommended: false, reason: "当前场景缺少已确认的线阵麦推荐边界，默认推荐阵麦。", factors };
}

function getLineArrayPlacement(
  profile: ClassroomProfile,
  zone: LineArrayActivityZone,
  mode: "front" | "full",
  count: number
): { installation: "podium" | "hanging" | "tabletop"; position: { x: number; y: number } } {
  if (profile.scenario === "meetingRoom") {
    return { installation: "tabletop", position: { x: oneDecimal(profile.roomGeometry.width / 2), y: oneDecimal(profile.roomGeometry.length / 2) } };
  }
  if (mode === "full" || count > 1) {
    return {
      installation: "hanging",
      position: {
        x: oneDecimal(zone.centerX),
        y: profile.scenario === "auditorium" ? oneDecimal(Math.max(1.2, zone.centerY)) : getLineArrayHangingFrontDistance(profile)
      }
    };
  }

  const requestedInstallation = profile.engineeringConstraints.lineArrayInstallation ?? "auto";
  const podiumX = getPodiumX(profile);
  const podiumCoversZone = Math.max(Math.abs(podiumX - zone.left), Math.abs(zone.right - podiumX)) <= LINE_ARRAY_FULL_RADIUS_M;
  const canUsePodium = profile.engineeringConstraints.hasPodium !== false && podiumCoversZone;
  const hasDrawnPodium = profile.scenario !== "auditorium" && profile.scenario !== "combinedClassroom";
  if (requestedInstallation === "podium" && canUsePodium) {
    return {
      installation: "podium",
      position: { x: oneDecimal(podiumX), y: oneDecimal(hasDrawnPodium ? getPodiumAudienceEdgeY() : Math.min(1.2, profile.roomGeometry.length / 3)) }
    };
  }
  if (requestedInstallation !== "hanging" && hasDrawnPodium && canUsePodium) {
    return { installation: "podium", position: { x: oneDecimal(podiumX), y: oneDecimal(getPodiumAudienceEdgeY()) } };
  }
  return {
    installation: "hanging",
    position: {
      x: oneDecimal(zone.centerX),
      y:
        profile.scenario === "auditorium"
          ? oneDecimal(clamp(zone.centerY, 1.2, Math.max(1.2, profile.roomGeometry.length - 1)))
          : getLineArrayHangingFrontDistance(profile)
    }
  };
}

function shouldCoverFullRoom(profile: ClassroomProfile) {
  if (profile.scenario === "meetingRoom") return !hasMeetingLeaderPosition(profile) || hasFullRoomPickupNeed(profile);
  if (profile.scenario === "auditorium") return hasFullRoomPickupNeed(profile);
  return hasFullRoomPickupNeed(profile);
}

function hasMicrophoneNeed(profile: ClassroomProfile) {
  return profile.needs.some((need) => need !== "wirelessMic" && need !== "other");
}

function getPodiumX(profile: ClassroomProfile) {
  const width = profile.roomGeometry.width;
  const edgeOffset = Math.min(1, width / 4);
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  if (podiumPosition === "frontLeft") return edgeOffset;
  if (podiumPosition === "frontRight") return width - edgeOffset;
  return width / 2;
}

function createZone(left: number, width: number, depth: number, label: string): LineArrayActivityZone {
  const safeLeft = Math.max(0, left);
  const safeWidth = Math.max(0, width);
  const safeDepth = Math.max(0, depth);
  return {
    left: oneDecimal(safeLeft),
    right: oneDecimal(safeLeft + safeWidth),
    front: 0,
    rear: oneDecimal(safeDepth),
    width: oneDecimal(safeWidth),
    depth: oneDecimal(safeDepth),
    centerX: oneDecimal(safeLeft + safeWidth / 2),
    centerY: oneDecimal(safeDepth / 2),
    label
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function twoDecimal(value: number) {
  return Math.round(value * 100) / 100;
}

function oneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function splitDevices(value: string) {
  return value.split(/[、,，;；]/).map((item) => item.trim()).filter(Boolean);
}
