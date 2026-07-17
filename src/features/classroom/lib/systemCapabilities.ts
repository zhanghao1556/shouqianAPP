import type { AppBrandId } from "../brand";
import type { ClassroomProfile, GeneratedPoint, Point } from "../types";
import {
  generateEngineeringPoints,
  getEffectiveAmplificationScope,
  getRequiredArrayMicCountForFullRoomAmplification,
  type PointQuantityTargets
} from "./drawingEngine";
import { getLineArrayDecision, LINE_ARRAY_LOCAL_RADIUS_M, LINE_ARRAY_ONLINE_RADIUS_M } from "./lineArrayRules";
import {
  getDefaultHangingMicCount,
  getHangingMicPositions,
  getHangingMicSupport,
  HANGING_MIC_RADIUS_M
} from "./hangingMicRules";
import {
  getEffectiveYinmanMicrophoneSolution,
  getSmallDiscCoverageRadius,
  getSmallDiscRequiredCount,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_MAX_GENERATED_COUNT,
  SMALL_DISC_RECORDING_NAME,
  SMALL_DISC_SLAVE_NAME
} from "./yinmanSmallDiscRules";

export const PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID = "ARRAY-MIC-PROCESSOR-DEPENDENT";
export const AUDIO_PROCESSOR_HOST_PRODUCT_ID = "AUDIO-PROCESSOR-HOST";

export interface BrandSystemCapability {
  brandId: AppBrandId;
  arrayMicTopology: "cascade" | "processorDirect";
  maxArrayMicCount: number;
  onlinePickupRadiusM: number;
  localAmplificationRadiusM: number;
  integratedSpeakerCapacity: number;
  totalSpeakerCapacity: number;
  cascadeRouteLimitM?: number;
  requiresAudioProcessorHost: boolean;
}

const capabilities: Record<AppBrandId, BrandSystemCapability> = {
  yinyi: {
    brandId: "yinyi",
    arrayMicTopology: "cascade",
    maxArrayMicCount: 5,
    onlinePickupRadiusM: 8,
    localAmplificationRadiusM: 5,
    integratedSpeakerCapacity: 8,
    totalSpeakerCapacity: 16,
    cascadeRouteLimitM: 40,
    requiresAudioProcessorHost: false
  },
  yinman: {
    brandId: "yinman",
    arrayMicTopology: "processorDirect",
    maxArrayMicCount: 2,
    onlinePickupRadiusM: 8,
    localAmplificationRadiusM: 5,
    integratedSpeakerCapacity: 8,
    totalSpeakerCapacity: 16,
    requiresAudioProcessorHost: true
  }
};

export function getBrandSystemCapability(brandId: AppBrandId): BrandSystemCapability {
  return capabilities[brandId];
}

export function getRequiredArrayMicCount(profile: ClassroomProfile, brandId: AppBrandId = "yinyi"): number {
  const effectiveMicrophone = getEffectiveYinmanMicrophoneSolution(profile, brandId);
  if (effectiveMicrophone === "smallDisc01" || effectiveMicrophone === "smallDisc03") {
    return getSmallDiscRequiredCount(profile, effectiveMicrophone);
  }
  const lineArray = getLineArrayDecision(profile);
  if (lineArray.selected) return lineArray.count;
  const currentAlgorithmCount = getCurrentArrayMicCount(profile);
  if (brandId === "yinman") return currentAlgorithmCount;
  const needsLocalAmplification = profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");
  if (!needsLocalAmplification || getEffectiveAmplificationScope(profile) !== "full") return currentAlgorithmCount;
  return Math.max(currentAlgorithmCount, getRequiredArrayMicCountForFullRoomAmplification(profile));
}

export function clampArrayMicCountForBrand(quantity: number, brandId: AppBrandId): number {
  return Math.min(getBrandSystemCapability(brandId).maxArrayMicCount, Math.max(0, Math.round(quantity)));
}

export function generateBrandEngineeringPoints(
  profile: ClassroomProfile,
  targets: PointQuantityTargets = {},
  brandId: AppBrandId
): GeneratedPoint[] {
  const requestedMicrophone = profile.engineeringConstraints.microphoneSolution ?? "auto";
  const effectiveMicrophone = getEffectiveYinmanMicrophoneSolution(profile, brandId);
  if ((requestedMicrophone === "smallDisc01" || requestedMicrophone === "smallDisc03") && brandId !== "yinman") {
    return generateBrandEngineeringPoints({
      ...profile,
      engineeringConstraints: { ...profile.engineeringConstraints, microphoneSolution: "auto" }
    }, targets, brandId);
  }
  if (effectiveMicrophone === "smallDisc01" || effectiveMicrophone === "smallDisc03") {
    const count = Math.max(1, Math.round(targets.arrayMicCount ?? getSmallDiscRequiredCount(profile, effectiveMicrophone)));
    const smallDiscProfile: ClassroomProfile = effectiveMicrophone === "smallDisc01"
      ? {
          ...profile,
          engineeringConstraints: {
            ...profile.engineeringConstraints,
            speakerProductOverride: "wall"
          }
        }
      : profile;
    const generated = generateEngineeringPoints(smallDiscProfile, {
      ...targets,
      arrayMicCount: count,
      arrayMicMaxCount: SMALL_DISC_MAX_GENERATED_COUNT,
      speakerProductId: effectiveMicrophone === "smallDisc01" ? "COLUMN-SPEAKER" : targets.speakerProductId
    });
    const generatedForSolution = effectiveMicrophone === "smallDisc03"
      ? generated.filter((point) => point.type !== "speaker")
      : generated;
    const radius = getSmallDiscCoverageRadius(profile, effectiveMicrophone);
    let micIndex = 0;
    return generatedForSolution.map((point) => {
      if (point.type !== "arrayMic") return point;
      const index = micIndex;
      micIndex += 1;
      if (effectiveMicrophone === "smallDisc03") {
        return {
          ...point,
          id: `small-disc-03-${index + 1}`,
          label: count > 1 ? `${SMALL_DISC_RECORDING_NAME} ${index + 1}` : SMALL_DISC_RECORDING_NAME,
          coverageRadius: radius,
          pickupKind: "smallDisc03" as const,
          pickupPattern: "full360" as const,
          installationMode: "hanging" as const,
          reason: `按${radius}m拾音半径覆盖讲台、会议桌等主要录音巡课区域。`
        };
      }
      const isMain = index === 0;
      return {
        ...point,
        id: isMain ? "small-disc-01-main" : `small-disc-02-slave-${index}`,
        label: isMain ? `${SMALL_DISC_MAIN_NAME} 主麦` : `${SMALL_DISC_SLAVE_NAME} ${index}`,
        coverageRadius: radius,
        pickupKind: isMain ? "smallDisc01" as const : "smallDisc02" as const,
        pickupPattern: "full360" as const,
        installationMode: "hanging" as const,
        reason: isMain
          ? `主麦优先服务核心拾音位置，按${radius}m半径承担主要拾音。`
          : `从麦按${radius}m半径补充主麦未覆盖的主要活动区。`
      };
    });
  }
  if (requestedMicrophone === "hangingMic" && brandId !== "yinman") {
    return generateBrandEngineeringPoints({
      ...profile,
      engineeringConstraints: { ...profile.engineeringConstraints, microphoneSolution: "auto" }
    }, targets, brandId);
  }
  if (requestedMicrophone === "hangingMic") {
    const support = getHangingMicSupport(profile, brandId);
    if (!support.supported) return [];
    const count = Math.max(0, Math.round(targets.arrayMicCount ?? getDefaultHangingMicCount(profile)));
    if (!count) return [];
    const positions = getHangingMicPositions(profile, count);
    const generated = generateEngineeringPoints(profile, {
      ...targets,
      arrayMicCount: count
    });
    let micIndex = 0;
    return generated.map((point) => {
      if (point.type !== "arrayMic") return point;
      const index = micIndex;
      micIndex += 1;
      return {
        ...point,
        id: `hanging-mic-${index + 1}`,
        label: count > 1 ? `吊麦 ${index + 1}` : "吊麦",
        position: positions[index] ?? point.position,
        coverageRadius: HANGING_MIC_RADIUS_M,
        pickupKind: "hangingMic" as const,
        pickupPattern: "full360" as const,
        installationMode: "hanging" as const,
        reason: `按${HANGING_MIC_RADIUS_M}m拾音与扩声半径覆盖讲台活动区。`
      };
    });
  }
  const lineArray = getLineArrayDecision(profile);
  if (lineArray.selected) {
    const { activityZone } = lineArray;
    const y = lineArray.position.y;
    const lineArrayPositions = Array.from({ length: lineArray.count }, (_, index) => ({
      x: lineArray.count === 1 ? lineArray.position.x : activityZone.left + activityZone.width * (index === 0 ? 0.25 : 0.75),
      y
    }));
    const generated = generateEngineeringPoints(profile, {
      ...targets,
      arrayMicCount: lineArray.count,
      lineArrayContext: { mode: lineArray.mode, position: lineArray.position, positions: lineArrayPositions }
    });
    const baseMic = generated.find((point) => point.type === "arrayMic");
    const lineMics = Array.from({ length: lineArray.count }, (_, index): GeneratedPoint => ({
      ...(baseMic ?? { id: "line-array-mic", type: "arrayMic" as const, label: "智能线阵麦克风", position: { x: profile.roomGeometry.width / 2, y }, reason: "" }),
      id: `line-array-mic-${index + 1}`,
      label: lineArray.count > 1 ? `智能线阵麦克风 ${index + 1}` : "智能线阵麦克风",
      position: lineArrayPositions[index] ?? lineArray.position,
      coverageRadius: lineArray.mode === "full" ? LINE_ARRAY_ONLINE_RADIUS_M : LINE_ARRAY_LOCAL_RADIUS_M,
      pickupKind: "lineArray",
      pickupPattern: lineArray.mode === "full" ? "full360" : "front180",
      installationMode: lineArray.installation,
      installHeight: lineArray.installation === "podium" ? 1.1 : lineArray.installation === "tabletop" ? 0.75 : baseMic?.installHeight,
      reason: lineArray.mode === "full"
        ? `线阵麦按${LINE_ARRAY_ONLINE_RADIUS_M}m线上拾音半径覆盖全场发言区。`
        : `正面180度声幕覆盖${activityZone.label}，屏蔽背向区域声音。`
    }));
    return [...lineMics, ...generated.filter((point) => point.type !== "arrayMic")];
  }
  const requestedArrayMicCount = targets.arrayMicCount ?? getCurrentArrayMicCount(profile);
  return generateEngineeringPoints(profile, {
    ...targets,
    arrayMicCount: clampArrayMicCountForBrand(requestedArrayMicCount, brandId)
  }).map((point) => point.type === "arrayMic" ? { ...point, pickupKind: "existingArray" as const } : point);
}

export function getBrandExternalAmplifierCount(speakerCount: number, brandId: AppBrandId): number {
  const capability = getBrandSystemCapability(brandId);
  return speakerCount > capability.integratedSpeakerCapacity ? 1 : 0;
}

function getCurrentArrayMicCount(profile: ClassroomProfile): number {
  return generateEngineeringPoints(profile).filter((point) => point.type === "arrayMic").length;
}

export interface CascadeRouteEstimate {
  lengthM: number;
  pointOrder: Point[];
}

export function getShortestManhattanCascadeRoute(points: Point[]): CascadeRouteEstimate {
  if (points.length <= 1) return { lengthM: 0, pointOrder: [...points] };
  const [start, ...remaining] = points;
  let bestLength = Number.POSITIVE_INFINITY;
  let bestOrder: Point[] = [];

  const visit = (current: Point, pending: Point[], order: Point[], lengthM: number) => {
    if (!pending.length) {
      if (lengthM < bestLength) {
        bestLength = lengthM;
        bestOrder = [start, ...order];
      }
      return;
    }
    pending.forEach((next, index) => {
      const segmentLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
      if (lengthM + segmentLength >= bestLength) return;
      visit(next, [...pending.slice(0, index), ...pending.slice(index + 1)], [...order, next], lengthM + segmentLength);
    });
  };

  visit(start, remaining, [], 0);
  return {
    lengthM: Number.isFinite(bestLength) ? Math.round(bestLength * 10) / 10 : 0,
    pointOrder: bestOrder.length ? bestOrder : [...points]
  };
}
