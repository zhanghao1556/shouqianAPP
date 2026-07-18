import type { AppBrandId } from "../brand";
import type { ClassroomProfile, Point, ProcessorTier } from "../types";
import {
  getProcessorCapacity,
  getTeacherActivityZone,
  getYinmanProcessorAlternativeTier
} from "./lineArrayRules";

export const HANGING_MIC_PRODUCT_ID = "HANGING-MIC";
export const HANGING_MIC_RADIUS_M = 3;

export function getHangingMicSupport(profile: ClassroomProfile, brandId: AppBrandId) {
  if (brandId !== "yinman") return { supported: false, reason: "吊麦仅用于音曼方案。" };
  const hasLocalAmplification = profile.needs.includes("localAmplification");
  const hasOnlineNeed = profile.needs.some((need) => ["videoConference", "interactiveClass", "recording", "remoteTeaching"].includes(need));
  if (profile.amplificationScope !== "podium" || !hasLocalAmplification || hasOnlineNeed) {
    return { supported: false, reason: "吊麦仅用于讲台区域扩声。" };
  }
  if (profile.engineeringConstraints.processorTier === "highPerformance") {
    return { supported: false, reason: "吊麦仅可搭配双麦处理器或六麦处理器。" };
  }
  return { supported: true, reason: "吊麦用于低成本讲台区域扩声。" };
}

export function getHangingMicCoverageDemand(profile: ClassroomProfile) {
  const zone = getTeacherActivityZone(profile);
  const diameter = HANGING_MIC_RADIUS_M * 2;
  return Math.max(1, Math.ceil(zone.width / diameter) * Math.ceil(zone.depth / diameter));
}

export function getExistingMicInputDemand(profile: ClassroomProfile) {
  return profile.existingDevices.legacyWirelessMic
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/无线|接收机/.test(item)).length;
}

export function getHangingMicProcessorTier(
  profile: ClassroomProfile,
  hangingMicDemand = getHangingMicCoverageDemand(profile),
  speakerCount = 0
): Exclude<ProcessorTier, "auto"> {
  const requested = profile.engineeringConstraints.processorTier ?? "auto";
  if (requested !== "auto") return requested;
  const totalDemand = getExistingMicInputDemand(profile) + hangingMicDemand;
  return getYinmanProcessorAlternativeTier(profile, speakerCount, totalDemand);
}

export function getHangingMicRemainingCapacity(
  profile: ClassroomProfile,
  processorTier: Exclude<ProcessorTier, "auto">
) {
  if (processorTier === "highPerformance") return 0;
  return Math.max(0, getProcessorCapacity(processorTier) - getExistingMicInputDemand(profile));
}

export function getDefaultHangingMicCount(profile: ClassroomProfile) {
  const demand = getHangingMicCoverageDemand(profile);
  const tier = getHangingMicProcessorTier(profile, demand);
  return Math.min(demand, getHangingMicRemainingCapacity(profile, tier));
}

export function getHangingMicPositions(profile: ClassroomProfile, count: number): Point[] {
  if (count <= 0) return [];
  const zone = getTeacherActivityZone(profile);
  const coverageColumns = Math.max(1, Math.ceil(zone.width / (HANGING_MIC_RADIUS_M * 2)));
  const columns = Math.min(coverageColumns, count);
  const rows = Math.ceil(count / columns);
  const positions: Point[] = [];
  for (let row = 0; row < rows; row += 1) {
    const rowCount = Math.min(columns, count - positions.length);
    for (let column = 0; column < rowCount; column += 1) {
      positions.push({
        x: roundOne(zone.left + zone.width * ((column + 0.5) / rowCount)),
        y: roundOne(zone.front + zone.depth * ((row + 0.5) / rows))
      });
    }
  }
  return positions;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
