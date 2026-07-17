import type { AppBrandId } from "../brand";
import type { ClassroomProfile, MicrophoneSolution, SmallDiscConnectionMode } from "../types";
import { getTeacherActivityZone, hasFullRoomPickupNeed } from "./lineArrayRules";
import { getMeetingFurnitureLayout } from "./meetingFurnitureRules";

export const SMALL_DISC_01_PRODUCT_ID = "YINMAN-SMALL-DISC-01";
export const SMALL_DISC_02_PRODUCT_ID = "YINMAN-SMALL-DISC-02";
export const SMALL_DISC_03_PRODUCT_ID = "YINMAN-SMALL-DISC-03";
export const SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID = "YINMAN-AUDIO-EXTENDER";
export const SMALL_DISC_USB_CABLE_PRODUCT_ID = "USB-AUDIO-CABLE";

export const SMALL_DISC_MAIN_NAME = "小圆盘阵麦01";
export const SMALL_DISC_SLAVE_NAME = "小圆盘阵麦02";
export const SMALL_DISC_RECORDING_NAME = "小圆盘阵麦03";
export const SMALL_DISC_AUDIO_EXTENDER_NAME = "音频扩展器";

export const SMALL_DISC_ONLINE_RADIUS_M = 5;
export const SMALL_DISC_LOCAL_RADIUS_M = 3;
export const SMALL_DISC_RECOMMENDED_SLAVE_COUNT = 3;
export const SMALL_DISC_RECORDING_RECOMMENDED_COUNT = 3;
export const SMALL_DISC_MAX_GENERATED_COUNT = 12;
export const SMALL_DISC_LINK_SEGMENT_LIMIT_M = 20;

const broaderFunctionNeeds = new Set(["videoConference", "interactiveClass", "localAmplification", "remoteTeaching"]);

export function isPureRecordingOrPatrolNeed(profile: ClassroomProfile) {
  const text = `${profile.customNeed} ${profile.engineeringConstraints.notes}`;
  const hasRecordingOrPatrol = profile.needs.includes("recording") || /巡课|录音|录播/.test(text);
  return hasRecordingOrPatrol && !profile.needs.some((need) => broaderFunctionNeeds.has(need));
}

export function getEffectiveYinmanMicrophoneSolution(
  profile: ClassroomProfile,
  brandId: AppBrandId
): MicrophoneSolution {
  const requested = profile.engineeringConstraints.microphoneSolution ?? "auto";
  if (brandId !== "yinman") {
    return requested === "hangingMic" || requested === "smallDisc01" || requested === "smallDisc03" ? "auto" : requested;
  }
  if (requested === "smallDisc03" && !isPureRecordingOrPatrolNeed(profile)) return "auto";
  if (requested === "auto" && isPureRecordingOrPatrolNeed(profile)) return "smallDisc03";
  return requested;
}

export function isSmallDiscSolution(solution: MicrophoneSolution) {
  return solution === "smallDisc01" || solution === "smallDisc03";
}

export function getSmallDiscCoverageRadius(profile: ClassroomProfile, solution: "smallDisc01" | "smallDisc03") {
  if (solution === "smallDisc03") return SMALL_DISC_ONLINE_RADIUS_M;
  const hasLocalAmplification = profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");
  return hasLocalAmplification ? SMALL_DISC_LOCAL_RADIUS_M : SMALL_DISC_ONLINE_RADIUS_M;
}

export function getSmallDiscRequiredCount(profile: ClassroomProfile, solution: "smallDisc01" | "smallDisc03") {
  const radius = getSmallDiscCoverageRadius(profile, solution);
  const zone = getSmallDiscCoverageZone(profile, solution);
  const columns = Math.max(1, Math.ceil(zone.width / (radius * 2)));
  const rows = Math.max(1, Math.ceil(zone.depth / (radius * 2)));
  return Math.min(SMALL_DISC_MAX_GENERATED_COUNT, columns * rows);
}

export function getSmallDiscConnectionMode(profile: ClassroomProfile): Exclude<SmallDiscConnectionMode, "auto"> {
  const requested = profile.engineeringConstraints.smallDiscConnectionMode ?? "auto";
  const solution = getEffectiveYinmanMicrophoneSolution(profile, "yinman");
  if (solution === "smallDisc03") return "extender";
  if (isPureRecordingOrPatrolNeed(profile)) return "extender";
  if (requested !== "auto") return requested;
  return profile.needs.includes("recording") ? "extender" : "usb";
}

export function shouldShowSmallDiscConnectionChoice(profile: ClassroomProfile) {
  if (getEffectiveYinmanMicrophoneSolution(profile, "yinman") !== "smallDisc01") return false;
  if (isPureRecordingOrPatrolNeed(profile)) return false;
  return profile.needs.some((need) => need === "videoConference" || need === "interactiveClass" || need === "remoteTeaching" || need === "recording");
}

export function getSmallDiscReviewMessage(solution: "smallDisc01" | "smallDisc03", count: number) {
  if (solution === "smallDisc01" && count - 1 > SMALL_DISC_RECOMMENDED_SLAVE_COUNT) {
    return `当前需要${count - 1}只小圆盘阵麦02，超过3只推荐边界，需专项复核。`;
  }
  if (solution === "smallDisc03" && count > SMALL_DISC_RECORDING_RECOMMENDED_COUNT) {
    return `当前需要${count}只小圆盘阵麦03，超过3只推荐边界，需专项复核。`;
  }
  return undefined;
}

function getSmallDiscCoverageZone(profile: ClassroomProfile, solution: "smallDisc01" | "smallDisc03") {
  if (profile.scenario === "meetingRoom") {
    const furniture = getMeetingFurnitureLayout(profile);
    const xValues = furniture.seats.map((seat) => seat.position.x);
    const yValues = furniture.seats.map((seat) => seat.position.y);
    return {
      width: Math.max(0.8, Math.max(...xValues) - Math.min(...xValues)),
      depth: Math.max(0.8, Math.max(...yValues) - Math.min(...yValues))
    };
  }

  const usesMainArea = solution === "smallDisc03" || (!hasFullRoomPickupNeed(profile) && getEffectiveAmplificationScope(profile) === "podium");
  if (usesMainArea) {
    const zone = getTeacherActivityZone(profile);
    return { width: Math.max(0.8, zone.width), depth: Math.max(0.8, zone.depth) };
  }

  return {
    width: Math.max(0.8, profile.roomGeometry.width - 1.6),
    depth: Math.max(0.8, profile.roomGeometry.length - 1.6)
  };
}

function getEffectiveAmplificationScope(profile: ClassroomProfile) {
  return profile.scenario === "lectureClassroom" ? "podium" : profile.amplificationScope;
}
