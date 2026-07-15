import type { AppBrandId } from "../brand";
import type { ClassroomProfile, ProcessorTier } from "../types";
import { getEffectiveAmplificationScope } from "./drawingEngine";

export const LINE_ARRAY_PRODUCT_ID = "LINE-ARRAY-MIC";
export const LINE_ARRAY_SINGLE_MAX_WIDTH_M = 13;
export const LINE_ARRAY_DOUBLE_MAX_WIDTH_M = 15;
export const LINE_ARRAY_MAX_COUNT = 2;
export const LINE_ARRAY_FULL_RADIUS_M = 5;

export interface LineArrayDecision {
  selected: boolean;
  requested: boolean;
  supported: boolean;
  count: number;
  mode: "front" | "full";
  installation: "podium" | "hanging";
  fallbackReason?: string;
}

export function getLineArrayDecision(profile: ClassroomProfile): LineArrayDecision {
  const constraints = profile.engineeringConstraints;
  const scope = getEffectiveAmplificationScope(profile);
  const requestedMode = constraints.lineArrayMode ?? "auto";
  const mode = requestedMode === "auto" ? (scope === "podium" ? "front" : "full") : requestedMode;
  const requestedInstallation = constraints.lineArrayInstallation ?? "auto";
  const installation = requestedInstallation === "auto" ? (constraints.hasPodium === false ? "hanging" : "podium") : requestedInstallation;
  const solution = constraints.microphoneSolution ?? "auto";
  const hasLocalAmplification = profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");
  const manuallySelected = solution === "lineArray";

  if (solution === "existingArray") return { selected: false, requested: false, supported: true, count: 0, mode, installation };
  if (!manuallySelected && !hasLocalAmplification) return { selected: false, requested: false, supported: true, count: 0, mode, installation };

  if (mode === "front") {
    const width = getLineArrayFrontWidth(profile);
    if (width > LINE_ARRAY_DOUBLE_MAX_WIDTH_M) {
      return { selected: false, requested: manuallySelected, supported: false, count: 0, mode, installation, fallbackReason: "教师活动区宽度超过15m，改用现有阵麦方案。" };
    }
    return { selected: true, requested: manuallySelected, supported: true, count: width > LINE_ARRAY_SINGLE_MAX_WIDTH_M ? 2 : 1, mode, installation };
  }

  const farthestCornerDistance = Math.hypot(profile.roomGeometry.width / 2, profile.roomGeometry.length / 2);
  if (farthestCornerDistance > LINE_ARRAY_FULL_RADIUS_M) {
    return { selected: false, requested: manuallySelected, supported: false, count: 0, mode, installation, fallbackReason: "全场区域超出单只5m覆盖半径，改用现有阵麦方案。" };
  }
  return { selected: true, requested: manuallySelected, supported: true, count: 1, mode, installation };
}

export function getLineArrayFrontWidth(profile: ClassroomProfile) {
  if (profile.scenario === "auditorium") return profile.engineeringConstraints.stageSize?.width || profile.roomGeometry.width;
  return profile.engineeringConstraints.teachingAreaSize?.width || profile.roomGeometry.width;
}

export function getProcessorTier(profile: ClassroomProfile, _brandId: AppBrandId, lineArrayCount: number, speakerCount: number): Exclude<ProcessorTier, "auto"> {
  if (lineArrayCount > 1) return "sixMic";
  const requested = profile.engineeringConstraints.processorTier ?? "auto";
  if (requested !== "auto") return requested;
  const inputCount = splitDevices(profile.existingDevices.legacyWirelessMic).length;
  const outputCount = splitDevices(profile.existingDevices.recordingHost).length;
  return Math.max(inputCount, outputCount, speakerCount) > 2 ? "sixMic" : "twoMic";
}

export function getProcessorTierName(tier: Exclude<ProcessorTier, "auto">) {
  if (tier === "sixMic") return "六麦处理器";
  if (tier === "highPerformance") return "高性能处理器";
  return "两麦处理器";
}

export function getProcessorCapacity(tier: Exclude<ProcessorTier, "auto">) {
  return tier === "twoMic" ? 2 : tier === "sixMic" ? 4 : 1;
}

function splitDevices(value: string) {
  return value.split(/[、,，;；]/).map((item) => item.trim()).filter(Boolean);
}
