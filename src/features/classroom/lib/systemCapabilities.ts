import type { AppBrandId } from "../brand";
import type { ClassroomProfile, GeneratedPoint, Point } from "../types";
import {
  generateEngineeringPoints,
  getEffectiveAmplificationScope,
  getRequiredArrayMicCountForFullRoomAmplification,
  type PointQuantityTargets
} from "./drawingEngine";
import { getLineArrayDecision, LINE_ARRAY_FULL_RADIUS_M } from "./lineArrayRules";

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
      coverageRadius: LINE_ARRAY_FULL_RADIUS_M,
      pickupKind: "lineArray",
      pickupPattern: lineArray.mode === "full" ? "full360" : "front180",
      installationMode: lineArray.installation,
      installHeight: lineArray.installation === "podium" ? 1.1 : lineArray.installation === "tabletop" ? 0.75 : baseMic?.installHeight,
      reason: lineArray.mode === "full"
        ? "桌面线阵麦按5m半径覆盖会议发言区。"
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
