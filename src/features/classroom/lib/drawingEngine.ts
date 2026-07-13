import type { ClassroomProfile, GeneratedPoint, LegacySpeakerPoint, Point } from "../types";
import { needsAuditoriumRearFillSpeakers as hasAuditoriumRearFillNeed } from "./auditoriumRules";
import { isClassroomScenario, isMeetingScenario } from "./scenarioRules";
import { getReverberationRisk } from "./reverberationRules";
import {
  getSpeakerModelName,
  getSpeakerProductId,
  RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER,
  type SpeakerProductId
} from "./speakerRules";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const MIN_CEILING_SPEAKER_TO_MIC_DISTANCE = 2;
const TEACHER_MONITOR_CEILING_SPEAKER_SOFT_MIC_DISTANCE = 1.5;
const MIN_CEILING_SPEAKER_TO_FRONT_WALL_DISTANCE = 1.5;
const MIN_CEILING_SPEAKER_TO_BACK_WALL_DISTANCE = 2;
const MIN_ARRAY_MIC_TO_CENTRAL_AIR_DISTANCE_M = 0.5;
const MAX_ARRAY_MIC_TO_CENTRAL_AIR_DISTANCE_M = 1;
const DEFAULT_CENTRAL_AIR_SIZE_M = 0.8;
const ARRAY_MIC_BODY_SIZE_M = 0.6;
const ARRAY_MIC_SPEAKER_FORWARD_OFFSET_M = 0.75;
const DEFAULT_REAR_AISLE_DEPTH_M = 1.2;
const ARRAY_MIC_MAX_COUNT = 5;
const ARRAY_MIC_REAR_COVERAGE_GAP_TRIGGER_M = 2;
const ARRAY_MIC_SAME_AXIS_MIN_SPACING_M = 4;
const ARRAY_MIC_SUPPLEMENT_LAYOUT_BACK_WALL_OFFSET_M = 1;
const ARRAY_MIC_SUPPLEMENT_BACK_WALL_BASE_DISTANCE_M = 2;
const MEETING_ARRAY_MIC_MAX_AMPLIFICATION_SPACING_M = 8;
const MEETING_ARRAY_MIC_MAX_ONLINE_PICKUP_SPACING_M = 10;
const CENTER_COLUMN_SPEAKER_BETWEEN_MIC_GAP_TRIGGER_M = 3.5;
const CENTER_COLUMN_SPEAKER_WALL_GAP_TRIGGER_M = 4;
const AUDITORIUM_WIDE_STAGE_ARRAY_MIC_WIDTH_M = 11;
const AUDITORIUM_STAGE_ARRAY_MIC_OUTWARD_OFFSET_M = 0.5;
const WALL_SPEAKER_COVERAGE_AXIS_M = 3.5;
const WALL_SPEAKER_MAX_COVERAGE_RADIUS_M = 7;
const WALL_SPEAKER_AFC_RISK_COVERAGE_RADIUS_M = 5;
const WALL_SPEAKER_FULL_ROOM_COVERAGE_RADIUS_M = 6;
const WALL_SPEAKER_MAX_REAR_FILL_ROWS = RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER / 2 - 1;
const WALL_SPEAKER_PREFERRED_SAME_SIDE_SPACING_M = 4.5;
const WALL_SPEAKER_MIN_SAME_SIDE_SPACING_M = 3.3;
const WALL_COLUMN_MIN_BACK_WALL_DISTANCE_M = 3.5;
const WALL_SPEAKER_MIN_INSTALL_HEIGHT_M = 2.2;
const WALL_SPEAKER_MAX_INSTALL_HEIGHT_M = 2.7;
const WALL_SPEAKER_MIN_HEIGHT_COVERAGE_M = 3.5;
const WALL_SPEAKER_MAX_HEIGHT_COVERAGE_M = 7;
const LECTURE_CLASSROOM_AUDIENCE_START_BEHIND_MIC_M = 1;
const LECTURE_CLASSROOM_STEP_RISE_PER_M = 0.2;
const WALL_SPEAKER_COVERAGE_HALF_ANGLE_DEG = 42.5;
const WALL_SPEAKER_MIC_EDGE_TOLERANCE_DEG = 7;
const ORIGINAL_WALL_SPEAKER_DEFAULT_TARGET_BEHIND_M = 4;
const ORIGINAL_WALL_SPEAKER_MAX_SAFE_HORIZONTAL_ANGLE_DEG =
  90 - WALL_SPEAKER_COVERAGE_HALF_ANGLE_DEG - WALL_SPEAKER_MIC_EDGE_TOLERANCE_DEG;
const ORIGINAL_FRONT_WALL_SPEAKER_OUTWARD_OFFSET_DEG = 7;
const CLASSROOM_FRONT_BACK_WALL_SPEAKER_MAX_OUTWARD_OFFSET_DEG = 40;
const CLASSROOM_FRONT_BACK_WALL_SPEAKER_BASE_WIDTH_M = 6;
const ORIGINAL_MEETING_SIDE_WALL_SPEAKER_OUTWARD_OFFSET_DEG = 7;
const FRONT_BACK_WALL_SPEAKER_MAX_ROOM_LENGTH_M = 6.6;
const WALL_SPEAKER_MIN_MOUNTING_ANGLE_DEG = 36;
const WALL_SPEAKER_MAX_MOUNTING_ANGLE_DEG = 144;
const MEETING_WALL_SPEAKER_CENTER_FILL_WALL_INSET_M = 5;
const MEETING_WALL_SPEAKER_CENTER_FILL_FIRST_THRESHOLD_M = WALL_SPEAKER_MAX_COVERAGE_RADIUS_M * 2;
const MEETING_WALL_SPEAKER_CENTER_FILL_SECOND_THRESHOLD_M = 20;
const MEETING_WALL_SPEAKER_CENTER_FILL_COVERAGE_RADIUS_M = 5;
const MEETING_WALL_SPEAKER_CENTER_FILL_AFC_SEND_OFFSET = -5;
const CEILING_SPEAKER_COVERAGE_RADIUS_M = 2;
const LEGACY_CEILING_SPEAKER_COVERAGE_RADIUS_M = CEILING_SPEAKER_COVERAGE_RADIUS_M;
const CEILING_SPEAKER_SIDE_INSTALL_INSET_M = 0.5;
const LEGACY_SPEAKER_OVERLAP_DELETE_THRESHOLD = 0.6;
const LEGACY_WALL_TO_CEILING_SPEAKER_OVERLAP_DELETE_THRESHOLD = 0.3204;
const LEGACY_SPEAKER_OVERLAP_SAMPLE_GRID = 18;
const POINT_MAP_CANVAS_WIDTH = 980;
const CEILING_SPEAKER_MAX_ROW_COUNT = 8;
const CEILING_SPEAKER_MAX_SPACING_M = 3.6;
const COMBINED_CLASSROOM_FIRST_SEATING_WALL_COVERAGE_RADIUS_M = 5;
const COMBINED_CLASSROOM_OTHER_SEATING_WALL_COVERAGE_RADIUS_M = 6;
export const ARRAY_MIC_IDEAL_AMPLIFICATION_RADIUS_M = 5;
export const ARRAY_MIC_ONLINE_PICKUP_RADIUS_M = 8;

type WallSpeakerPosition = Point & {
  forcePerpendicularAim?: boolean;
};

export const getRoomArea = (profile: ClassroomProfile) =>
  profile.roomGeometry.length > 0 && profile.roomGeometry.width > 0 ? profile.roomGeometry.length * profile.roomGeometry.width : 0;

export const hasValidGeometry = (profile: ClassroomProfile) =>
  profile.roomGeometry.length > 0 && profile.roomGeometry.width > 0 && profile.roomGeometry.height > 0;

export const getRequiredArrayMicCountForFullRoomAmplification = (profile: ClassroomProfile) => {
  if (!hasValidGeometry(profile)) return 1;
  const teacherY = getPrimaryArrayMicY(profile);
  const rearSpeechZoneY = getRearSpeechZoneY(profile, teacherY);
  const fullRoomRowCount = getRequiredArrayMicRowCountByRadius(teacherY, rearSpeechZoneY, getArrayMicEffectiveAmplificationRadius(profile));
  const teacherRowCount = isWideArrayMicRoom(profile) ? 2 : 1;
  const rearRowCount = profile.roomGeometry.width > 14 ? 2 : 1;
  return teacherRowCount + Math.max(0, fullRoomRowCount - 1) * rearRowCount;
};

export const isOversizedForFullRoomAmplification = (profile: ClassroomProfile) =>
  getRequiredArrayMicCountForFullRoomAmplification(profile) > ARRAY_MIC_MAX_COUNT;

export const getEffectiveAmplificationScope = (profile: ClassroomProfile) =>
  profile.scenario === "lectureClassroom" ? "podium" : profile.amplificationScope;

const getSpeakerModelNameForPointMap = (profile: ClassroomProfile, forcedSpeakerProductId?: SpeakerProductId) => {
  if (forcedSpeakerProductId === "CEILING-SPEAKER") return "4寸吸顶音箱";
  if (forcedSpeakerProductId === "COLUMN-SPEAKER") return "2×3寸壁挂音柱";
  return getSpeakerModelName(profile);
};

export interface PointQuantityTargets {
  arrayMicCount?: number;
  speakerCount?: number;
  speakerProductId?: SpeakerProductId;
  preserveSpeakerCount?: boolean;
}

export const generateEngineeringPoints = (profile: ClassroomProfile, targets: PointQuantityTargets = {}): GeneratedPoint[] => {
  if (!hasValidGeometry(profile)) return [];

  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const teacherY = getPrimaryArrayMicY(profile);
  const defaultArrayMicCount = getDefaultArrayMicCount(profile, teacherY);
  const targetArrayMicCount = clamp(Math.round(targets.arrayMicCount ?? defaultArrayMicCount), 1, ARRAY_MIC_MAX_COUNT);
  const arrayMicPositions = getArrayMicPositions(profile, teacherY, targetArrayMicCount);
  const primaryArrayMicY = arrayMicPositions.find((position) => position.rowIndex === 0)?.y ?? teacherY;
  const arrayMicInstallHeight = getArrayMicInstallHeight(profile);
  const points: GeneratedPoint[] = [];

  if (
    profile.needs.includes("videoConference") ||
    profile.needs.includes("interactiveClass") ||
    profile.needs.includes("localAmplification") ||
    profile.needs.includes("recording") ||
    profile.needs.includes("remoteTeaching") ||
    profile.needs.includes("other")
  ) {
    arrayMicPositions.forEach((position, index) => {
      const isTeacherMic = position.rowIndex === 0;
      const isRearRow = position.rowIndex === arrayMicPositions[arrayMicPositions.length - 1].rowIndex;
      const isWidePair = position.rowColumnCount > 1;
      const isMeeting = isMeetingScenario(profile.scenario);
      points.push({
        id: getArrayMicPointId(position.rowIndex, position.columnIndex, index),
        type: "arrayMic",
        label: isMeeting
          ? isTeacherMic
            ? "会议区阵列麦"
            : "会议区补充阵列麦"
          : isTeacherMic
          ? "教师区阵列麦"
          : isRearRow
            ? "后场补充阵列麦"
            : "学生区补充阵列麦",
        position: { x: position.x, y: position.y },
        installHeight: arrayMicInstallHeight,
        reason:
          isMeeting && isTeacherMic
            ? "覆盖会议桌和主发言区，作为会议拾音核心。"
          : isMeeting
            ? "会议室补充拾音点位，覆盖远端座席和讨论区。"
          : isTeacherMic
            ? profile.scenario === "auditorium"
              ? "覆盖居中舞台和主要发言区，作为报告厅拾音核心。"
              : "覆盖讲台和教师活动区，作为课堂拾音核心。"
            : isWidePair
              ? "房间宽度较大，同排左右分布补强两侧座位区拾音与扩声覆盖。"
              : isRearRow
                ? "宽深较大的教室增加后场补充拾音，避开默认后排过道后覆盖后场座位区。"
                : "较大教室或录播互动场景增加学生区补充拾音，点位兼顾学生面向前方发言时的直达声。"
      });
    });
  }

  if (shouldGenerateNewSpeakers(profile)) {
    const forcedSpeakerProductId = targets.speakerProductId;
    const speakerName = getSpeakerModelNameForPointMap(profile, forcedSpeakerProductId);
    const usesWallSpeaker = (forcedSpeakerProductId ?? getSpeakerProductId(profile)) === "COLUMN-SPEAKER";
    const defaultSpeakerCount = getDefaultSpeakerCount(profile, usesWallSpeaker);
    const speakerCount = Math.max(1, Math.round(targets.speakerCount ?? defaultSpeakerCount));
    const speakerPositions: WallSpeakerPosition[] = usesWallSpeaker
      ? getWallSpeakerPositions(profile, speakerCount, primaryArrayMicY)
      : getCeilingSpeakerPositions(profile, speakerCount, points.filter((point) => point.type === "arrayMic"), Boolean(targets.preserveSpeakerCount));
    const scopeText = getEffectiveAmplificationScope(profile) === "podium" ? (profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声") : "全场扩声";
    const ceilingSpeakerHeight = getCeilingSpeakerInstallHeight(profile);
    const arrayMics = points.filter((point) => point.type === "arrayMic");
    const speakerCoverageRadii = speakerPositions.map((position) => getSpeakerCoverageRadius(profile, usesWallSpeaker, position, speakerPositions, arrayMics));
    const wallSpeakerBaseHeight = usesWallSpeaker ? getUnifiedWallSpeakerInstallHeight(profile, Math.max(...speakerCoverageRadii, WALL_SPEAKER_MIN_HEIGHT_COVERAGE_M)) : 0;
    const generatedSpeakerPoints = speakerPositions.map((position, index): GeneratedPoint => {
      const isLeft = position.x <= roomWidth / 2;
      const isBack = position.y > depth * 0.52;
      const coverageRadius = speakerCoverageRadii[index] ?? getSpeakerCoverageRadius(profile, usesWallSpeaker, position, speakerPositions, arrayMics);
      const isFrontWallSpeaker = usesWallSpeaker && position.y === 0;
      const isBackWallSpeaker = usesWallSpeaker && Math.abs(position.y - depth) <= 0.05;
      const usesMeetingStyleFullRoomWallSpeaker = usesWallSpeaker && shouldUseMeetingStyleFullRoomWallSpeakerRules(profile);
      const isTeacherMonitorSpeaker =
        shouldReserveTeacherMonitorSpeakerRow(profile) &&
        (isFrontWallSpeaker || (!usesWallSpeaker && !shouldUseMeetingStyleCeilingSpeakerRules(profile) && position.y <= primaryArrayMicY));
      const speakerRowsReason = usesWallSpeaker ? getPodiumSpeakerRowsReason(profile, speakerPositions.length) : getCeilingSpeakerRowsReason(profile, speakerPositions.length);
      const wallAim = usesWallSpeaker ? getWallSpeakerAim(profile, position, coverageRadius, arrayMics) : undefined;
      const wallTarget = wallAim?.target;
      const wallSpeakerStepHeight = usesWallSpeaker ? getLectureClassroomStepHeightAtY(profile, position.y, primaryArrayMicY) : 0;
      const wallSpeakerHeight = usesWallSpeaker ? oneDecimal(wallSpeakerBaseHeight + wallSpeakerStepHeight) : ceilingSpeakerHeight;
      const wallSpeakerDownTilt =
        usesWallSpeaker && wallTarget
          ? getWallSpeakerDownTilt(profile, wallSpeakerBaseHeight, position, wallTarget, primaryArrayMicY)
          : usesWallSpeaker
            ? getWallSpeakerDownTilt(profile, wallSpeakerBaseHeight, position, { x: position.x, y: oneDecimal(position.y + coverageRadius) }, primaryArrayMicY)
            : undefined;
      return {
        id: `speaker-${index + 1}`,
        type: "speaker",
        label: `${isLeft ? "左" : "右"}${isBack ? "后" : "前"}${speakerName}`,
        position,
        installHeight: usesWallSpeaker ? wallSpeakerHeight : ceilingSpeakerHeight,
        installHeightBase: usesWallSpeaker ? wallSpeakerBaseHeight : undefined,
        installHeightOffset: usesWallSpeaker ? wallSpeakerStepHeight : undefined,
        horizontalAngle: wallAim?.horizontalAngle,
        downTiltAngle: usesWallSpeaker ? wallSpeakerDownTilt : undefined,
        coverageRadius,
        afcSendLevelOffset: position.forcePerpendicularAim ? MEETING_WALL_SPEAKER_CENTER_FILL_AFC_SEND_OFFSET : undefined,
        target: wallTarget,
        responsibilityEdgeCoverage: wallAim?.edgeCoverage,
        reason: usesWallSpeaker
          ? usesMeetingStyleFullRoomWallSpeaker
            ? position.forcePerpendicularAim
              ? `${scopeText}壁挂音柱按覆盖责任区补充中区覆盖；墙面条件、门窗和屏幕位置会影响安装微调。`
              : `${scopeText}壁挂音柱按房间整体覆盖布置；墙面条件、门窗和屏幕位置会影响安装微调。`
            : isFrontWallSpeaker
            ? isTeacherMonitorSpeaker
              ? `${scopeText}前墙保留一组补声/监听点位，用于多媒体声音和老师小信号 AFC 监听；前墙音柱正对阵麦时 AFC 余量较低，仅按基础补声处理。`
              : `${scopeText}前墙壁挂补声点位，前墙音柱正对阵麦时 AFC 余量较低，仅按基础补声处理。`
            : isBackWallSpeaker
              ? `${scopeText}小房间长度不超过 ${FRONT_BACK_WALL_SPEAKER_MAX_ROOM_LENGTH_M}m，壁挂音柱优先前后墙对称布置；当客户减少到 2 只时，优先保留后墙 AFC 补声组并移除前墙补声组。`
            : position.forcePerpendicularAim
              ? `${scopeText}无吊顶长宽跨距补声组按覆盖责任区自动指向；补声组覆盖半径按 ${MEETING_WALL_SPEAKER_CENTER_FILL_COVERAGE_RADIUS_M}m，AFC 发送量默认 ${MEETING_WALL_SPEAKER_CENTER_FILL_AFC_SEND_OFFSET}。`
              : `${scopeText}侧墙壁挂点位，${speakerRowsReason}后场多排时组间距从前往后梯度递增，前段优先补齐主麦后方覆盖，后段利用更高 AFC 余量覆盖更远区域；壁挂音箱最大覆盖半径按 ${WALL_SPEAKER_MAX_COVERAGE_RADIUS_M}m 硬上限控制；同侧相邻音柱 3.3m 仅作房间太浅时兜底，排不下时优先减少后场排数。现场按门窗、黑板和屏幕位置微调。`
          : isTeacherMonitorSpeaker
            ? `${scopeText}老师区保留一组吸顶补声/监听点位，用于多媒体声音和老师小信号 AFC 监听；吸顶音箱覆盖半径锁定 ${CEILING_SPEAKER_COVERAGE_RADIUS_M}m，相邻中心距按不超过 ${CEILING_SPEAKER_MAX_SPACING_M}m 复核；仅承担老师区多媒体声音和小声 AFC 监听时，不强制执行离阵列麦 ${MIN_CEILING_SPEAKER_TO_MIC_DISTANCE}m。`
            : `${scopeText}吸顶音箱按 ${CEILING_SPEAKER_COVERAGE_RADIUS_M}m 覆盖半径分布，${speakerRowsReason}相邻中心距按不超过 ${CEILING_SPEAKER_MAX_SPACING_M}m 复核；横向在距侧墙 ${CEILING_SPEAKER_SIDE_INSTALL_INSET_M}m 至宽度-${CEILING_SPEAKER_SIDE_INSTALL_INSET_M}m 的覆盖区内均匀分布，纵向优先满足距前墙 1.5m、距后墙 2m，并按阵列麦位置做中间列避让/回填；小房间需现场取舍复核。`
      };
    });
    points.push(...filterGeneratedSpeakersByLegacyCoverage(profile, generatedSpeakerPoints, points.filter((point) => point.type === "arrayMic")));
  }

  return points;
};

const getSpeakerCoverageRadius = (
  profile: ClassroomProfile,
  usesWallSpeaker: boolean,
  position: WallSpeakerPosition,
  speakerPositions: WallSpeakerPosition[],
  arrayMics: GeneratedPoint[]
) => {
  if (!usesWallSpeaker) return getCeilingSpeakerCoverageRadius(profile, position, speakerPositions, arrayMics);
  if (position.forcePerpendicularAim) return MEETING_WALL_SPEAKER_CENTER_FILL_COVERAGE_RADIUS_M;
  if (profile.scenario === "combinedClassroom") return getCombinedClassroomWallSpeakerCoverageRadius(profile, position, speakerPositions);
  if (isWallSpeakerNearArrayMic(position, arrayMics)) return WALL_SPEAKER_AFC_RISK_COVERAGE_RADIUS_M;
  if (getEffectiveAmplificationScope(profile) !== "podium") return WALL_SPEAKER_FULL_ROOM_COVERAGE_RADIUS_M;
  const rowsForCompensation = usesWallSpeaker ? speakerPositions.filter((speaker) => speaker.y > 0.2) : speakerPositions;
  if (usesWallSpeaker && position.y <= 0.2) return WALL_SPEAKER_AFC_RISK_COVERAGE_RADIUS_M;
  const sortedRows = Array.from(new Set(rowsForCompensation.map((speaker) => oneDecimal(speaker.y)))).sort((a, b) => a - b);
  const rowIndex = Math.max(0, sortedRows.findIndex((y) => Math.abs(y - oneDecimal(position.y)) <= 0.2));
  return oneDecimal(Math.min(WALL_SPEAKER_MAX_COVERAGE_RADIUS_M, WALL_SPEAKER_AFC_RISK_COVERAGE_RADIUS_M + rowIndex));
};

const isWallSpeakerNearArrayMic = (position: WallSpeakerPosition, arrayMics: GeneratedPoint[]) =>
  arrayMics.some((mic) => getDistance(position, mic.position) <= WALL_SPEAKER_AFC_RISK_COVERAGE_RADIUS_M);

const filterGeneratedSpeakersByLegacyCoverage = (profile: ClassroomProfile, speakers: GeneratedPoint[], arrayMics: GeneratedPoint[]) => {
  const legacySpeakers = profile.scenario === "auditorium" ? [] : profile.existingDevices.legacySpeakerPoints ?? [];
  if (!legacySpeakers.length) return speakers;
  return speakers.filter((speaker) => !isGeneratedSpeakerCoveredByLegacySpeaker(profile, speaker, legacySpeakers, arrayMics));
};

const isGeneratedSpeakerCoveredByLegacySpeaker = (profile: ClassroomProfile, speaker: GeneratedPoint, legacySpeakers: LegacySpeakerPoint[], arrayMics: GeneratedPoint[]) =>
  legacySpeakers.some((legacySpeaker) => getSpeakerCoverageOverlapRatio(profile, speaker, legacySpeaker, arrayMics) >= getLegacySpeakerOverlapDeleteThreshold(speaker, legacySpeaker));

const getLegacySpeakerOverlapDeleteThreshold = (speaker: GeneratedPoint, legacySpeaker: LegacySpeakerPoint) =>
  legacySpeaker.type === "wall" && isGeneratedCeilingSpeaker(speaker)
    ? LEGACY_WALL_TO_CEILING_SPEAKER_OVERLAP_DELETE_THRESHOLD
    : LEGACY_SPEAKER_OVERLAP_DELETE_THRESHOLD;

const getSpeakerCoverageOverlapRatio = (profile: ClassroomProfile, speaker: GeneratedPoint, legacySpeaker: LegacySpeakerPoint, arrayMics: GeneratedPoint[]) => {
  const bounds = getGeneratedSpeakerCoverageBounds(profile, speaker);
  if (!bounds) return 0;
  const stepX = (bounds.maxX - bounds.minX) / LEGACY_SPEAKER_OVERLAP_SAMPLE_GRID;
  const stepY = (bounds.maxY - bounds.minY) / LEGACY_SPEAKER_OVERLAP_SAMPLE_GRID;
  if (stepX <= 0 || stepY <= 0) return 0;

  let generatedSamples = 0;
  let sharedSamples = 0;
  for (let xIndex = 0; xIndex < LEGACY_SPEAKER_OVERLAP_SAMPLE_GRID; xIndex += 1) {
    for (let yIndex = 0; yIndex < LEGACY_SPEAKER_OVERLAP_SAMPLE_GRID; yIndex += 1) {
      const sample = {
        x: bounds.minX + stepX * (xIndex + 0.5),
        y: bounds.minY + stepY * (yIndex + 0.5)
      };
      if (!isPointCoveredByGeneratedSpeaker(profile, speaker, sample)) continue;
      generatedSamples += 1;
      if (isPointCoveredByLegacySpeaker(profile, legacySpeaker, sample, arrayMics)) sharedSamples += 1;
    }
  }
  return generatedSamples > 0 ? sharedSamples / generatedSamples : 0;
};

const getGeneratedSpeakerCoverageBounds = (profile: ClassroomProfile, speaker: GeneratedPoint) => {
  const radius = speaker.coverageRadius ?? (isGeneratedCeilingSpeaker(speaker) ? CEILING_SPEAKER_COVERAGE_RADIUS_M : WALL_SPEAKER_COVERAGE_AXIS_M);
  return getSpeakerCoverageBounds(profile, speaker.position, radius);
};

const getSpeakerCoverageBounds = (profile: ClassroomProfile, position: Point, radius: number) =>
  clampBoundsToRoom(profile, {
    minX: position.x - radius,
    maxX: position.x + radius,
    minY: position.y - radius,
    maxY: position.y + radius
  });

const clampBoundsToRoom = (profile: ClassroomProfile, bounds: { minX: number; maxX: number; minY: number; maxY: number }) => ({
  minX: clamp(bounds.minX, 0, profile.roomGeometry.width),
  maxX: clamp(bounds.maxX, 0, profile.roomGeometry.width),
  minY: clamp(bounds.minY, 0, profile.roomGeometry.length),
  maxY: clamp(bounds.maxY, 0, profile.roomGeometry.length)
});

const isPointCoveredByGeneratedSpeaker = (profile: ClassroomProfile, speaker: GeneratedPoint, point: { x: number; y: number }) => {
  const radius = speaker.coverageRadius ?? (isGeneratedCeilingSpeaker(speaker) ? CEILING_SPEAKER_COVERAGE_RADIUS_M : WALL_SPEAKER_COVERAGE_AXIS_M);
  if (isGeneratedCeilingSpeaker(speaker)) return getDistance(speaker.position, point) <= radius;
  return isPointInVisualWallSpeakerCoverage(profile, speaker.position, getGeneratedWallSpeakerCoverageTarget(profile, speaker, radius), radius, point);
};

const isPointCoveredByLegacySpeaker = (profile: ClassroomProfile, speaker: LegacySpeakerPoint, point: { x: number; y: number }, arrayMics: GeneratedPoint[]) => {
  if (speaker.type === "ceiling") return getDistance(speaker.position, point) <= LEGACY_CEILING_SPEAKER_COVERAGE_RADIUS_M;
  return isPointInVisualWallSpeakerCoverage(profile, speaker.position, getLegacyWallSpeakerCoverageTarget(profile, speaker, arrayMics), WALL_SPEAKER_COVERAGE_AXIS_M, point);
};

const isGeneratedCeilingSpeaker = (speaker: GeneratedPoint) =>
  speaker.label.includes("吸顶音箱") || (speaker.horizontalAngle === undefined && speaker.downTiltAngle === undefined);

const getGeneratedWallSpeakerCoverageTarget = (profile: ClassroomProfile, speaker: GeneratedPoint, radius: number) => {
  if (speaker.target) return speaker.target;
  const angle = Math.abs(speaker.horizontalAngle ?? 0);
  const directionX = speaker.position.x <= profile.roomGeometry.width / 2 ? 1 : -1;
  const rad = (angle * Math.PI) / 180;
  return {
    x: oneDecimal(clamp(speaker.position.x + directionX * Math.sin(rad) * radius, 0, profile.roomGeometry.width)),
    y: oneDecimal(clamp(speaker.position.y + Math.cos(rad) * radius, 0, profile.roomGeometry.length))
  };
};

const getLegacyWallSpeakerCoverageTarget = (profile: ClassroomProfile, speaker: LegacySpeakerPoint, arrayMics: GeneratedPoint[]) => {
  if (speaker.target) return clampWallSpeakerTargetToMountingAngle(profile, speaker.position, speaker.target);
  if (speaker.wallAdjustability === "universal") return getLegacyUniversalWallSpeakerVisualTarget(profile, speaker.position, arrayMics);
  const side = getWallSpeakerRoomSide(profile, speaker.position);
  if (side === "left" || side === "right") {
    const direction = side === "left" ? 1 : -1;
    return clampWallSpeakerTargetToMountingAngle(profile, speaker.position, {
      x: speaker.position.x + direction * profile.roomGeometry.width * 0.35,
      y: speaker.position.y
    });
  }
  if (side === "front") {
    return clampWallSpeakerTargetToMountingAngle(profile, speaker.position, {
      x: speaker.position.x,
      y: speaker.position.y + profile.roomGeometry.length * 0.35
    });
  }
  return clampWallSpeakerTargetToMountingAngle(profile, speaker.position, {
    x: speaker.position.x,
    y: speaker.position.y - profile.roomGeometry.length * 0.35
  });
};

const getWallSpeakerRoomSide = (profile: ClassroomProfile, position: Point) => {
  const { width, length } = profile.roomGeometry;
  const distances = [
    { side: "left" as const, value: Math.abs(position.x) },
    { side: "right" as const, value: Math.abs(position.x - width) },
    { side: "front" as const, value: Math.abs(position.y) },
    { side: "back" as const, value: Math.abs(position.y - length) }
  ].sort((a, b) => a.value - b.value);
  return distances[0]?.side ?? "left";
};

const isPointInVisualWallSpeakerCoverage = (
  profile: ClassroomProfile,
  speaker: Point,
  target: Point,
  coverageLength: number,
  point: Point
) => {
  const canvasHeight = getInstallationCanvasHeight(profile, POINT_MAP_CANVAS_WIDTH);
  const speakerCanvas = toCanvasPoint(speaker, profile, POINT_MAP_CANVAS_WIDTH, canvasHeight);
  const targetCanvas = toCanvasPoint(clampWallSpeakerTargetToMountingAngle(profile, speaker, target), profile, POINT_MAP_CANVAS_WIDTH, canvasHeight);
  const pointCanvas = toCanvasPoint(point, profile, POINT_MAP_CANVAS_WIDTH, canvasHeight);
  const coverageLengthPx = coverageLength * getCanvasRoomLayout(profile, POINT_MAP_CANVAS_WIDTH, canvasHeight).meterPx;
  const axis = { x: targetCanvas.x - speakerCanvas.x, y: targetCanvas.y - speakerCanvas.y };
  const axisLength = Math.hypot(axis.x, axis.y);
  if (axisLength <= 0 || coverageLengthPx <= 0) return false;
  const axisUnit = { x: axis.x / axisLength, y: axis.y / axisLength };
  const perpendicular = { x: -axisUnit.y, y: axisUnit.x };
  const vector = { x: pointCanvas.x - speakerCanvas.x, y: pointCanvas.y - speakerCanvas.y };
  const localX = vector.x * perpendicular.x + vector.y * perpendicular.y;
  const localY = vector.x * axisUnit.x + vector.y * axisUnit.y;
  const distance = Math.hypot(localX, localY);
  if (localY < 0 || distance > coverageLengthPx) return false;
  const angle = (Math.atan2(Math.abs(localX), localY) * 180) / Math.PI;
  return angle <= WALL_SPEAKER_COVERAGE_HALF_ANGLE_DEG;
};

const getLegacyUniversalWallSpeakerVisualTarget = (profile: ClassroomProfile, position: Point, arrayMics: GeneratedPoint[]) => {
  const canvasHeight = getInstallationCanvasHeight(profile, POINT_MAP_CANVAS_WIDTH);
  const speakerCanvas = toCanvasPoint(position, profile, POINT_MAP_CANVAS_WIDTH, canvasHeight);
  const arrayMicCanvasPoints = arrayMics.map((mic) => toCanvasPoint(mic.position, profile, POINT_MAP_CANVAS_WIDTH, canvasHeight));
  const targetCanvas = getVisualWallSpeakerTargetCanvas(
    speakerCanvas,
    arrayMicCanvasPoints,
    POINT_MAP_CANVAS_WIDTH,
    canvasHeight,
    WALL_SPEAKER_COVERAGE_AXIS_M * getCanvasRoomLayout(profile, POINT_MAP_CANVAS_WIDTH, canvasHeight).meterPx
  );
  return clampWallSpeakerTargetToMountingAngle(profile, position, getRoomPositionFromCanvas(profile, targetCanvas, POINT_MAP_CANVAS_WIDTH, canvasHeight));
};

const getVisualWallSpeakerTargetCanvas = (
  speaker: Point,
  arrayMics: Point[],
  width: number,
  height: number,
  coverageLength: number
) => {
  const isFrontSpeaker = speaker.y < height * 0.5;
  const targetFractions = isFrontSpeaker ? [0.72, 0.82, 0.62, 0.9, 0.52] : [0.78, 0.86, 0.7, 0.92, 0.62];
  const candidates = targetFractions.map((fraction) => ({ x: width / 2, y: height * fraction }));

  return candidates.reduce((best, candidate) => {
    const score = getVisualConeMicOverlapScore(speaker, candidate, arrayMics, coverageLength);
    const bestScore = getVisualConeMicOverlapScore(speaker, best, arrayMics, coverageLength);
    return score < bestScore ? candidate : best;
  }, candidates[0]);
};

const getVisualConeMicOverlapScore = (speaker: Point, target: Point, arrayMics: Point[], coverageLength: number) => {
  const edgeTolerance = WALL_SPEAKER_MIC_EDGE_TOLERANCE_DEG;
  const axis = { x: target.x - speaker.x, y: target.y - speaker.y };
  const axisLength = Math.hypot(axis.x, axis.y) || 1;
  const axisUnit = { x: axis.x / axisLength, y: axis.y / axisLength };

  return arrayMics.reduce((score, mic) => {
    const vector = { x: mic.x - speaker.x, y: mic.y - speaker.y };
    const distance = Math.hypot(vector.x, vector.y);
    if (distance <= 0 || distance > coverageLength) return score;
    const dot = (vector.x * axisUnit.x + vector.y * axisUnit.y) / distance;
    const angle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
    if (angle <= WALL_SPEAKER_COVERAGE_HALF_ANGLE_DEG - edgeTolerance) {
      return score + (WALL_SPEAKER_COVERAGE_HALF_ANGLE_DEG - edgeTolerance - angle + 1) * (1 - distance / coverageLength);
    }
    return score;
  }, 0);
};

const getInstallationCanvasHeight = (profile: ClassroomProfile, width: number) => {
  const ratio = profile.roomGeometry.length / Math.max(profile.roomGeometry.width, 0.1);
  return Math.round(Math.max(430, Math.min(920, width * ratio + 170)));
};

const getRoomPositionFromCanvas = (profile: ClassroomProfile, point: Point, width: number, height: number) => {
  const room = getCanvasRoomLayout(profile, width, height);
  return {
    x: ((point.x - room.x) / room.width) * profile.roomGeometry.width,
    y: ((point.y - room.y) / room.height) * profile.roomGeometry.length
  };
};

const clampWallSpeakerTargetToMountingAngle = (profile: ClassroomProfile, speaker: Point, target: Point) => {
  const vector = { x: target.x - speaker.x, y: target.y - speaker.y };
  const distance = Math.max(0.8, Math.hypot(vector.x, vector.y));
  const angle = clamp(getWallSpeakerMountingAngleFromRoomVector(profile, speaker, vector), WALL_SPEAKER_MIN_MOUNTING_ANGLE_DEG, WALL_SPEAKER_MAX_MOUNTING_ANGLE_DEG);
  return getWallSpeakerTargetFromMountingAngle(profile, speaker, angle, distance);
};

const getWallSpeakerMountingAngleFromRoomVector = (profile: ClassroomProfile, speaker: Point, vector: Point) => {
  const side = getWallSpeakerRoomSide(profile, speaker);
  if (side === "left") return Math.round(90 + (Math.atan2(vector.y, vector.x) * 180) / Math.PI);
  if (side === "right") return Math.round(90 - (Math.atan2(vector.y, -vector.x) * 180) / Math.PI);
  if (side === "front") return Math.round(90 - (Math.atan2(vector.x, vector.y) * 180) / Math.PI);
  return Math.round(90 + (Math.atan2(vector.x, -vector.y) * 180) / Math.PI);
};

const getWallSpeakerTargetFromMountingAngle = (profile: ClassroomProfile, speaker: Point, angle: number, distance: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  const side = getWallSpeakerRoomSide(profile, speaker);
  if (side === "left") return { x: speaker.x + Math.cos(rad) * distance, y: speaker.y + Math.sin(rad) * distance };
  if (side === "right") return { x: speaker.x - Math.cos(rad) * distance, y: speaker.y - Math.sin(rad) * distance };
  if (side === "front") return { x: speaker.x - Math.sin(rad) * distance, y: speaker.y + Math.cos(rad) * distance };
  return { x: speaker.x + Math.sin(rad) * distance, y: speaker.y - Math.cos(rad) * distance };
};

const getCombinedClassroomWallSpeakerCoverageRadius = (
  profile: ClassroomProfile,
  position: { x: number; y: number },
  speakerPositions: Array<{ x: number; y: number }>
) => {
  const teachingDepth = clamp(
    profile.engineeringConstraints.teachingAreaSize?.depth ?? profile.roomGeometry.length * 0.5,
    0,
    profile.roomGeometry.length
  );
  const seatingRows = Array.from(new Set(speakerPositions.map((speaker) => oneDecimal(speaker.y)).filter((y) => y >= teachingDepth - 0.05))).sort((a, b) => a - b);
  const row = oneDecimal(position.y);
  const seatingRowIndex = seatingRows.findIndex((y) => Math.abs(y - row) <= 0.2);
  if (seatingRowIndex === 0) return COMBINED_CLASSROOM_FIRST_SEATING_WALL_COVERAGE_RADIUS_M;
  if (seatingRowIndex > 0) return COMBINED_CLASSROOM_OTHER_SEATING_WALL_COVERAGE_RADIUS_M;
  return WALL_SPEAKER_COVERAGE_AXIS_M;
};

const getCeilingSpeakerCoverageRadius = (
  profile: ClassroomProfile,
  position: { x: number; y: number },
  speakerPositions: Array<{ x: number; y: number }>,
  arrayMics: GeneratedPoint[]
) => {
  const centerColumnReducedColumns = getCenterColumnArrayMicGapReducedColumns(profile, speakerPositions, arrayMics);
  const positionColumn = oneDecimal(position.x);
  if (centerColumnReducedColumns.has(positionColumn)) return CEILING_SPEAKER_COVERAGE_RADIUS_M;

  if (isMeetingScenario(profile.scenario)) {
    const meetingReducedColumns = getMeetingCeilingSpeakerAfcReducedColumns(profile, speakerPositions, arrayMics);
    if (meetingReducedColumns.has(positionColumn)) return CEILING_SPEAKER_COVERAGE_RADIUS_M;
    if (speakerPositions.length <= 4) return CEILING_SPEAKER_COVERAGE_RADIUS_M;
    if (meetingReducedColumns.size > 0) {
      return CEILING_SPEAKER_COVERAGE_RADIUS_M;
    }
  }
  const reducedRows = getCeilingSpeakerAfcReducedRows(profile, speakerPositions, arrayMics);
  const positionRow = oneDecimal(position.y);
  return reducedRows.has(positionRow) ? CEILING_SPEAKER_COVERAGE_RADIUS_M : CEILING_SPEAKER_COVERAGE_RADIUS_M;
};

const getCenterColumnArrayMicGapReducedColumns = (
  profile: ClassroomProfile,
  speakerPositions: Array<{ x: number; y: number }>,
  arrayMics: GeneratedPoint[]
) => {
  const reducedColumns = new Set<number>();
  if (profile.roomGeometry.length <= profile.roomGeometry.width) return reducedColumns;
  if (!shouldUseCenterColumnArrayMicGapAvoidance(profile, getArrayMicRowsForCeilingSpeakerRemoval(profile, arrayMics))) return reducedColumns;

  const speakerColumns = Array.from(new Set(speakerPositions.map((speaker) => oneDecimal(speaker.x)))).sort((a, b) => a - b);
  if (speakerColumns.length === 3) reducedColumns.add(speakerColumns[1]);
  return reducedColumns;
};

const getMeetingCeilingSpeakerAfcReducedColumns = (
  profile: ClassroomProfile,
  speakerPositions: Array<{ x: number; y: number }>,
  arrayMics: GeneratedPoint[]
) => {
  const speakerColumns = Array.from(new Set(speakerPositions.map((speaker) => oneDecimal(speaker.x)))).sort((a, b) => a - b);
  const speakerRows = Array.from(new Set(speakerPositions.map((speaker) => oneDecimal(speaker.y)))).sort((a, b) => a - b);
  const reducedColumns = new Set<number>();
  if (speakerColumns.length === 3) {
    reducedColumns.add(speakerColumns[1]);
    return reducedColumns;
  }
  if (speakerColumns.length <= speakerRows.length) return reducedColumns;

  const primaryMicX = arrayMics[0]?.position.x ?? getTeacherArrayMicX(profile);
  const nearestColumn = speakerColumns.reduce((best, column) => (Math.abs(column - primaryMicX) < Math.abs(best - primaryMicX) ? column : best), speakerColumns[0]);
  reducedColumns.add(nearestColumn);
  return reducedColumns;
};

const getCeilingSpeakerAfcReducedRows = (
  profile: ClassroomProfile,
  speakerPositions: Array<{ x: number; y: number }>,
  arrayMics: GeneratedPoint[]
) => {
  const speakerRows = Array.from(new Set(speakerPositions.map((speaker) => oneDecimal(speaker.y)))).sort((a, b) => a - b);
  const reducedRows = new Set<number>();
  if (!speakerRows.length) return reducedRows;

  const activeMicRows =
    getEffectiveAmplificationScope(profile) === "podium"
      ? [arrayMics[0]?.position.y ?? getPrimaryArrayMicY(profile)]
      : Array.from(new Set(arrayMics.map((mic) => oneDecimal(mic.position.y)))).sort((a, b) => a - b);

  activeMicRows.forEach((micY) => {
    const nearestRow = speakerRows.reduce((best, row) => (Math.abs(row - micY) < Math.abs(best - micY) ? row : best), speakerRows[0]);
    reducedRows.add(nearestRow);
  });
  return reducedRows;
};

export const shouldGenerateNewSpeakers = (profile: ClassroomProfile) => {
  if (profile.scenario === "auditorium" && !needsAuditoriumRearFillSpeakers(profile)) return false;
  return profile.needs.length > 0;
};

export const needsAuditoriumRearFillSpeakers = (profile: ClassroomProfile) => {
  return hasAuditoriumRearFillNeed(profile);
};

const getArrayMicPointId = (rowIndex: number, columnIndex: number, flatIndex: number) => {
  if (rowIndex === 0) return columnIndex === 0 ? "dt-array-teacher" : `dt-array-teacher-${columnIndex + 1}`;
  return flatIndex === 1 ? "dt-array-student" : `dt-array-student-${flatIndex}`;
};

const shouldAddStudentArrayMic = (profile: ClassroomProfile, teacherMicY: number) => {
  if (isMeetingScenario(profile.scenario)) return getMeetingArrayMicCount(profile) > 1;
  const effectiveAmplificationScope = getEffectiveAmplificationScope(profile);
  const needsOnlinePickup = hasOnlinePickupNeed(profile);
  const hasLocalAmplification = hasLocalAmplificationNeed(profile);
  const rearGap = getArrayMicRearCoverageTargetY(profile, teacherMicY) - teacherMicY - getPrimaryArrayMicCoverageRadius(profile);
  if (effectiveAmplificationScope === "podium" && !needsOnlinePickup) return false;
  return (
    (hasLocalAmplification && effectiveAmplificationScope === "full" && rearGap > ARRAY_MIC_REAR_COVERAGE_GAP_TRIGGER_M) ||
    (!hasLocalAmplification && needsOnlinePickup && rearGap > ARRAY_MIC_REAR_COVERAGE_GAP_TRIGGER_M) ||
    (effectiveAmplificationScope === "podium" && needsOnlinePickup && rearGap > ARRAY_MIC_REAR_COVERAGE_GAP_TRIGGER_M)
  );
};

const getDefaultArrayMicCount = (profile: ClassroomProfile, teacherMicY: number) => {
  if (isMeetingScenario(profile.scenario)) return getMeetingArrayMicCount(profile);
  const minimumFrontRowMicCount = shouldUseWideAuditoriumStageArrayMics(profile) || shouldUseWideClassroomFrontArrayMicPair(profile) ? 2 : 1;
  if (!shouldAddStudentArrayMic(profile, teacherMicY)) return minimumFrontRowMicCount;
  const rearCoverageCount = getArrayMicCountByRearCoverage(profile, teacherMicY);
  const minimumWithRearPair = shouldUseWideClassroomFrontArrayMicPair(profile) && rearCoverageCount > 2 ? 4 : minimumFrontRowMicCount;
  return Math.max(minimumWithRearPair, rearCoverageCount);
};

const getMeetingArrayMicCount = (profile: ClassroomProfile) => {
  const radius = getMeetingArrayMicCoverageRadius(profile);
  const maxMicSpacing = getMeetingArrayMicMaxSpacing(profile);
  const axisSpan = getMeetingArrayMicPrimaryAxisSpan(profile);
  for (let count = 1; count <= ARRAY_MIC_MAX_COUNT; count += 1) {
    const axisValues = getMeetingArrayMicAxisValues(profile, count);
    const frontGap = Math.max(0, (axisValues[0] ?? 0) - radius);
    const rearGap = Math.max(0, axisSpan - (axisValues.at(-1) ?? 0) - radius);
    const maxSpacing = getMaxAdjacentSpacing(axisValues);
    if (frontGap <= 0 && rearGap <= 0 && maxSpacing <= maxMicSpacing) {
      return count;
    }
  }
  return ARRAY_MIC_MAX_COUNT;
};

const getMeetingArrayMicCoverageRadius = (profile: ClassroomProfile) =>
  hasLocalAmplificationNeed(profile) ? getArrayMicEffectiveAmplificationRadius(profile) : ARRAY_MIC_ONLINE_PICKUP_RADIUS_M;

const getMeetingArrayMicMaxSpacing = (profile: ClassroomProfile) =>
  hasLocalAmplificationNeed(profile) ? MEETING_ARRAY_MIC_MAX_AMPLIFICATION_SPACING_M : MEETING_ARRAY_MIC_MAX_ONLINE_PICKUP_SPACING_M;

const getMaxAdjacentSpacing = (values: number[]) => {
  if (values.length <= 1) return 0;
  return values.slice(1).reduce((max, value, index) => Math.max(max, value - values[index]), 0);
};

const getArrayMicCountByRearCoverage = (profile: ClassroomProfile, teacherMicY: number) => {
  const rearTargetY = getArrayMicRearCoverageTargetY(profile, teacherMicY);
  if (rearTargetY - teacherMicY - getPrimaryArrayMicCoverageRadius(profile) <= ARRAY_MIC_REAR_COVERAGE_GAP_TRIGGER_M) return 1;
  for (let count = 2; count <= ARRAY_MIC_MAX_COUNT; count += 1) {
    const rowCount = getArrayMicRowCounts(profile, count).length;
    if (rowCount <= 1) continue;
    const lastY = getArrayMicRowYs(profile, teacherMicY, rowCount).at(-1) ?? teacherMicY;
    const rearGap = rearTargetY - lastY - getSupplementalArrayMicCoverageRadius(profile);
    if (rearGap <= ARRAY_MIC_REAR_COVERAGE_GAP_TRIGGER_M) return count;
  }
  return ARRAY_MIC_MAX_COUNT;
};

const getArrayMicRearCoverageTargetY = (profile: ClassroomProfile, teacherMicY: number) => {
  if (profile.scenario === "combinedClassroom") return getCombinedClassroomTeachingRearTargetY(profile, teacherMicY);
  return profile.roomGeometry.length;
};

const getRequiredArrayMicRowCountByRadius = (firstMicY: number, lastCoverageY: number, radius: number) =>
  Math.max(1, Math.ceil(Math.max(0, lastCoverageY - (firstMicY + radius)) / (radius * 2)) + 1);

const hasLocalAmplificationNeed = (profile: ClassroomProfile) =>
  profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");

export const getArrayMicCentralAirRequiredClearance = (profile: ClassroomProfile) => {
  const risk = getReverberationRisk(profile);
  if (risk === "high") return MAX_ARRAY_MIC_TO_CENTRAL_AIR_DISTANCE_M;
  if (risk === "medium") return 0.8;
  return MIN_ARRAY_MIC_TO_CENTRAL_AIR_DISTANCE_M;
};

const getPrimaryArrayMicCoverageRadius = (profile: ClassroomProfile) =>
  hasLocalAmplificationNeed(profile) ? getArrayMicEffectiveAmplificationRadius(profile) : ARRAY_MIC_ONLINE_PICKUP_RADIUS_M;

const getSupplementalArrayMicCoverageRadius = (profile: ClassroomProfile) =>
  hasLocalAmplificationNeed(profile) && getEffectiveAmplificationScope(profile) === "full"
    ? getArrayMicEffectiveAmplificationRadius(profile)
    : ARRAY_MIC_ONLINE_PICKUP_RADIUS_M;

const getArrayMicPositions = (profile: ClassroomProfile, teacherMicY: number, targetArrayMicCount: number) => {
  const targetCount = clamp(Math.round(targetArrayMicCount), 1, ARRAY_MIC_MAX_COUNT);
  if (shouldUseMeetingWidthAsArrayMicAxis(profile)) {
    const y = oneDecimal(profile.roomGeometry.length / 2);
    const positions = getMeetingArrayMicAxisValues(profile, targetCount)
      .map((x, index) => ({
        x,
        y,
        rowIndex: 0,
        columnIndex: index,
        rowColumnCount: targetCount
      }))
      .map((position) => getArrayMicPositionAwayFromCentralAir(profile, position));
    return keepSameAxisArrayMicsApart(profile, positions, teacherMicY);
  }

  const rowCounts = getArrayMicRowCounts(profile, targetCount);
  const rowYs = getArrayMicRowYs(profile, teacherMicY, rowCounts.length);
  const teacherMicX = getTeacherArrayMicX(profile);
  const centerX = profile.roomGeometry.width / 2;

  const positions = rowCounts.flatMap((rowColumnCount, rowIndex) => {
    const xValues = getArrayMicRowXValues(profile, rowColumnCount, rowIndex === 0 ? teacherMicX : centerX, rowIndex);
    return xValues.map((x, columnIndex) => ({
      x,
      y: rowYs[rowIndex],
      rowIndex,
      columnIndex,
      rowColumnCount
    }));
  }).map((position) => getArrayMicPositionAwayFromCentralAir(profile, position));
  return keepSameAxisArrayMicsApart(profile, positions, teacherMicY);
};

const keepSameAxisArrayMicsApart = <
  T extends { x: number; y: number; rowIndex: number; columnIndex: number; rowColumnCount: number }
>(
  profile: ClassroomProfile,
  positions: T[],
  teacherMicY: number
): T[] => {
  if (positions.length <= 1) return positions;
  const maxSupplementY = getMaxSupplementalArrayMicY(profile, teacherMicY, positions);
  const nextPositions = positions.map((position) => ({ ...position }));
  const groups = nextPositions.reduce((map, position, index) => {
    const key = oneDecimal(position.x);
    map.set(key, [...(map.get(key) ?? []), { position, index }]);
    return map;
  }, new Map<number, Array<{ position: T; index: number }>>());

  groups.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.position.y - b.position.y || a.position.rowIndex - b.position.rowIndex);
    sorted.forEach((item, sortedIndex) => {
      if (sortedIndex === 0) return;
      const previous = sorted[sortedIndex - 1].position;
      if (item.position.y - previous.y >= ARRAY_MIC_SAME_AXIS_MIN_SPACING_M) return;
      const targetY = oneDecimal(Math.max(item.position.y, previous.y + ARRAY_MIC_SAME_AXIS_MIN_SPACING_M));
      const adjustedY = pickSameAxisArrayMicAdjustedY(profile, item.position, targetY, maxSupplementY);
      nextPositions[item.index] = {
        ...nextPositions[item.index],
        y: adjustedY
      };
      item.position.y = adjustedY;
    });
  });

  return nextPositions;
};

const getMaxSupplementalArrayMicY = (
  profile: ClassroomProfile,
  teacherMicY: number,
  positions: Array<{ rowIndex: number }>
) => {
  const rearTargetY = getArrayMicRearCoverageTargetY(profile, teacherMicY);
  const supplementalRowCount = Math.max(1, new Set(positions.map((position) => position.rowIndex)).size - 1);
  const backWallDistance = supplementalRowCount + ARRAY_MIC_SUPPLEMENT_BACK_WALL_BASE_DISTANCE_M;
  return oneDecimal(Math.max(teacherMicY, rearTargetY - backWallDistance));
};

const pickSameAxisArrayMicAdjustedY = (
  profile: ClassroomProfile,
  position: { x: number; y: number },
  targetY: number,
  maxY: number
) => {
  const clampedTargetY = oneDecimal(clamp(targetY, position.y, maxY));
  if (clampedTargetY <= position.y) return position.y;
  for (let y = clampedTargetY; y <= maxY + 0.001; y = oneDecimal(y + 0.1)) {
    if (isAllowedArrayMicPosition(profile, { x: position.x, y })) return y;
  }
  return clampedTargetY;
};

const getArrayMicPositionAwayFromCentralAir = <
  T extends { x: number; y: number; rowIndex: number; columnIndex: number; rowColumnCount: number }
>(
  profile: ClassroomProfile,
  position: T
): T => {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  if (!profile.engineeringConstraints.hasCentralAirConditioner || centralAirPoints.length === 0) return position;
  if (isAllowedArrayMicPosition(profile, position)) return position;

  const { length: depth, width } = profile.roomGeometry;
  const micHalfSize = ARRAY_MIC_BODY_SIZE_M / 2;
  const requiredClearance = getArrayMicCentralAirRequiredClearance(profile);
  const bounds = {
    minX: Math.max(0.8, micHalfSize),
    maxX: Math.max(0.8, width - Math.max(0.8, micHalfSize)),
    minY: Math.max(1.2, micHalfSize),
    maxY: Math.max(1.2, depth - Math.max(0.8, micHalfSize))
  };
  type AirAvoidanceDirection = "back" | "front" | "left" | "right" | "original";
  const candidates: Array<{ x: number; y: number; axis: "x" | "y" | "original"; direction: AirAvoidanceDirection }> = [
    { x: position.x, y: position.y, axis: "original", direction: "original" }
  ];

  centralAirPoints.forEach((air) => {
    const halfWidth = (air.size?.width ?? DEFAULT_CENTRAL_AIR_SIZE_M) / 2 + requiredClearance + micHalfSize;
    const halfDepth = (air.size?.depth ?? DEFAULT_CENTRAL_AIR_SIZE_M) / 2 + requiredClearance + micHalfSize;
    const leftX = air.position.x - halfWidth;
    const rightX = air.position.x + halfWidth;
    const frontY = air.position.y - halfDepth;
    const backY = air.position.y + halfDepth;

    candidates.push(
      { x: position.x, y: backY, axis: "y", direction: "back" },
      { x: position.x, y: frontY, axis: "y", direction: "front" },
      { x: leftX, y: position.y, axis: "x", direction: "left" },
      { x: rightX, y: position.y, axis: "x", direction: "right" }
    );
  });

  const normalizedCandidates = candidates.map((candidate) => ({
    axis: candidate.axis,
    direction: candidate.direction,
    x: oneDecimal(clamp(candidate.x, bounds.minX, bounds.maxX)),
    y: oneDecimal(clamp(candidate.y, bounds.minY, bounds.maxY))
  }));
  const allowedCandidates = normalizedCandidates.filter((candidate) => isAllowedArrayMicPosition(profile, candidate));
  const areaPriorityAllowedCandidates = allowedCandidates.filter((candidate) => respectsArrayMicAreaPriority(profile, candidate, position));
  const areaPriorityFallbackCandidates = normalizedCandidates.filter((candidate) => respectsArrayMicAreaPriority(profile, candidate, position));
  const preferredAxis = getCentralAirAvoidancePreferredAxis(profile, position);
  const secondaryAxis = preferredAxis === "y" ? "x" : "y";
  const preferredAllowedCandidates = getAxisCandidates(areaPriorityAllowedCandidates, preferredAxis);
  const secondaryAllowedCandidates = getAxisCandidates(areaPriorityAllowedCandidates, secondaryAxis);
  const preferredLooseAllowedCandidates = getAxisCandidates(allowedCandidates, preferredAxis);
  const secondaryLooseAllowedCandidates = getAxisCandidates(allowedCandidates, secondaryAxis);
  const preferredFallbackCandidates = getAxisCandidates(areaPriorityFallbackCandidates, preferredAxis);
  const secondaryFallbackCandidates = getAxisCandidates(areaPriorityFallbackCandidates, secondaryAxis);
  const preferredLooseFallbackCandidates = getAxisCandidates(normalizedCandidates, preferredAxis);
  const secondaryLooseFallbackCandidates = getAxisCandidates(normalizedCandidates, secondaryAxis);
  const best = isMeetingScenario(profile.scenario)
    ? pickMeetingArrayMicCentralAirCandidate(profile, preferredAllowedCandidates, preferredAxis) ??
      pickMeetingArrayMicCentralAirCandidate(profile, secondaryAllowedCandidates, secondaryAxis) ??
      pickMeetingArrayMicCentralAirCandidate(profile, allowedCandidates, preferredAxis) ??
      pickFarthestFromCentralAirCandidate(profile, preferredFallbackCandidates) ??
      pickFarthestFromCentralAirCandidate(profile, secondaryFallbackCandidates) ??
      pickFarthestFromCentralAirCandidate(profile, normalizedCandidates) ??
      position
    : pickBestArrayMicAirAvoidanceCandidate(profile, preferredAllowedCandidates, position) ??
      pickBestArrayMicAirAvoidanceCandidate(profile, secondaryAllowedCandidates, position) ??
      pickBestArrayMicAirAvoidanceCandidate(profile, preferredLooseAllowedCandidates, position) ??
      pickBestArrayMicAirAvoidanceCandidate(profile, secondaryLooseAllowedCandidates, position) ??
      pickFarthestFromCentralAirCandidate(profile, preferredFallbackCandidates) ??
      pickFarthestFromCentralAirCandidate(profile, secondaryFallbackCandidates) ??
      pickFarthestFromCentralAirCandidate(profile, preferredLooseFallbackCandidates) ??
      pickFarthestFromCentralAirCandidate(profile, secondaryLooseFallbackCandidates) ??
      position;

  return {
    ...position,
    x: best.x,
    y: best.y
  };
};

const getCentralAirAvoidancePreferredAxis = (profile: ClassroomProfile, position?: { rowIndex?: number }): "x" | "y" => {
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  const isClassroomPrimaryMic =
    (profile.scenario === "standardClassroom" || profile.scenario === "lectureClassroom") && (position?.rowIndex ?? 0) === 0;
  if (isClassroomPrimaryMic && (podiumPosition === "frontCenter" || podiumPosition === "unknown")) return "y";
  return profile.roomGeometry.length >= profile.roomGeometry.width ? "y" : "x";
};

const getAxisCandidates = <T extends { axis: "x" | "y" | "original" }>(candidates: T[], axis: "x" | "y") =>
  candidates.filter((candidate) => candidate.axis === axis);

const respectsArrayMicAreaPriority = (
  profile: ClassroomProfile,
  candidate: { x: number },
  original: { x: number; rowColumnCount?: number; columnIndex?: number }
) => {
  if (isMeetingScenario(profile.scenario)) return true;
  const centerX = profile.roomGeometry.width / 2;
  if ((original.rowColumnCount ?? 1) > 1) {
    if ((original.columnIndex ?? 0) === 0) return candidate.x <= centerX;
    if ((original.columnIndex ?? 0) === (original.rowColumnCount ?? 1) - 1) return candidate.x >= centerX;
  }
  if (profile.scenario !== "standardClassroom" && profile.scenario !== "lectureClassroom") return true;
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  if (podiumPosition === "frontLeft") return candidate.x <= centerX;
  if (podiumPosition === "frontRight") return candidate.x >= centerX;
  return true;
};

const pickMeetingArrayMicCentralAirCandidate = <T extends { x: number; y: number }>(
  profile: ClassroomProfile,
  candidates: T[],
  preferredAxis: "x" | "y"
) => {
  if (!candidates.length) return undefined;
  const center = { x: profile.roomGeometry.width / 2, y: profile.roomGeometry.length / 2 };
  return candidates.reduce((best, candidate) => {
    const candidateDistance = getDistance(candidate, center);
    const bestDistance = getDistance(best, center);
    if (Math.abs(candidateDistance - bestDistance) > 0.01) return candidateDistance < bestDistance ? candidate : best;
    if (preferredAxis === "y" && Math.abs(candidate.y - best.y) > 0.01) return candidate.y < best.y ? candidate : best;
    return best;
  });
};

const pickBestArrayMicAirAvoidanceCandidate = <
  T extends { x: number; y: number; axis: "x" | "y" | "original"; direction: "back" | "front" | "left" | "right" | "original" }
>(
  profile: ClassroomProfile,
  candidates: T[],
  original: { x: number; y: number; rowIndex?: number }
) => {
  if (!candidates.length) return undefined;
  return candidates.reduce((best, candidate) =>
    scoreArrayMicCentralAirCandidate(profile, candidate, original) > scoreArrayMicCentralAirCandidate(profile, best, original) ? candidate : best
  );
};

const pickFarthestFromCentralAirCandidate = <T extends { x: number; y: number }>(profile: ClassroomProfile, candidates: T[]) => {
  if (!candidates.length) return undefined;
  return candidates.reduce((best, candidate) => (getMinCentralAirClearance(profile, candidate) > getMinCentralAirClearance(profile, best) ? candidate : best));
};

const getMinCentralAirClearance = (profile: ClassroomProfile, position: { x: number; y: number }) =>
  (profile.engineeringConstraints.centralAirConditionerPoints ?? []).reduce(
    (distance, air) => Math.min(distance, getDistanceToCentralAirBody(position, air, ARRAY_MIC_BODY_SIZE_M / 2)),
    Number.POSITIVE_INFINITY
  );

const isAllowedArrayMicPosition = (profile: ClassroomProfile, position: { x: number; y: number }) =>
  (profile.engineeringConstraints.centralAirConditionerPoints ?? []).every(
    (air) => getDistanceToCentralAirBody(position, air, ARRAY_MIC_BODY_SIZE_M / 2) >= getArrayMicCentralAirRequiredClearance(profile)
  );

const scoreArrayMicCentralAirCandidate = (
  profile: ClassroomProfile,
  candidate: { x: number; y: number },
  original: { x: number; y: number }
) => {
  const minAirDistance = (profile.engineeringConstraints.centralAirConditionerPoints ?? []).reduce(
    (distance, air) => Math.min(distance, getDistanceToCentralAirBody(candidate, air, ARRAY_MIC_BODY_SIZE_M / 2)),
    Number.POSITIVE_INFINITY
  );
  const movement = getDistance(candidate, original);
  const yMovement = Math.abs(candidate.y - original.y);
  const xMovement = Math.abs(candidate.x - original.x);
  const isPrimaryMic = "rowIndex" in original && original.rowIndex === 0;
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  const shouldKeepPrimaryX = isPrimaryMic && (isMeetingScenario(profile.scenario) || podiumPosition === "frontCenter" || podiumPosition === "unknown");
  const xPenalty = shouldKeepPrimaryX ? 14 : isPrimaryMic ? 10 : 8;
  const yPenalty = shouldKeepPrimaryX ? 4 : 10;
  const rearGapBonus = getRearCoverageGapBonus(profile, candidate, original);
  const passBonus = minAirDistance >= getArrayMicCentralAirRequiredClearance(profile) ? 10000 : 0;
  return passBonus + minAirDistance * 120 + rearGapBonus - movement * 34 - yMovement * yPenalty - xMovement * xPenalty;
};

const getRearCoverageGapBonus = (
  profile: ClassroomProfile,
  candidate: { x: number; y: number },
  original: { x: number; y: number }
) => {
  if (candidate.y <= original.y) return 0;
  const rearSpeechZoneY = getRearSpeechZoneY(profile, original.y);
  const hasLocalAmplification = profile.needs.includes("localAmplification") || profile.needs.includes("interactiveClass");
  const radius = hasLocalAmplification ? getArrayMicEffectiveAmplificationRadius(profile) : ARRAY_MIC_ONLINE_PICKUP_RADIUS_M;
  const originalGap = Math.max(0, rearSpeechZoneY - (original.y + radius));
  const candidateGap = Math.max(0, rearSpeechZoneY - (candidate.y + radius));
  return Math.min(originalGap - candidateGap, 1.5) * 8;
};

const getDistanceToCentralAirBody = (
  point: { x: number; y: number },
  air: NonNullable<ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"]>[number],
  pointHalfSize = 0
) => {
  const halfWidth = (air.size?.width ?? DEFAULT_CENTRAL_AIR_SIZE_M) / 2 + pointHalfSize;
  const halfDepth = (air.size?.depth ?? DEFAULT_CENTRAL_AIR_SIZE_M) / 2 + pointHalfSize;
  const dx = Math.max(Math.abs(point.x - air.position.x) - halfWidth, 0);
  const dy = Math.max(Math.abs(point.y - air.position.y) - halfDepth, 0);
  return Math.hypot(dx, dy);
};

const isWideArrayMicRoom = (profile: ClassroomProfile) => profile.roomGeometry.width > 14;

const shouldUseWideAuditoriumStageArrayMics = (profile: ClassroomProfile) =>
  profile.scenario === "auditorium" && (profile.engineeringConstraints.stageSize?.width ?? 0) >= AUDITORIUM_WIDE_STAGE_ARRAY_MIC_WIDTH_M;

const shouldUseWideClassroomFrontArrayMicPair = (profile: ClassroomProfile) =>
  profile.scenario === "standardClassroom" && getEffectiveAmplificationScope(profile) === "full" && profile.roomGeometry.width > 14;

const getArrayMicRowCounts = (profile: ClassroomProfile, targetArrayMicCount: number) => {
  const targetCount = clamp(Math.round(targetArrayMicCount), 1, ARRAY_MIC_MAX_COUNT);
  if (shouldUseWideAuditoriumStageArrayMics(profile)) {
    if (targetCount <= 2) return [2];
    return [2, ...Array.from({ length: targetCount - 2 }, () => 1)];
  }
  if (targetCount === 1) return [1];
  if (isMeetingScenario(profile.scenario)) return Array.from({ length: targetCount }, () => 1);

  if (!isWideArrayMicRoom(profile)) return Array.from({ length: targetCount }, () => 1);

  if (targetCount === 2) return [2];
  if (targetCount === 3) return [2, 1];
  if (targetCount === 4) return [2, 2];
  return [2, 1, 2];
};

const getArrayMicRowXValues = (profile: ClassroomProfile, rowColumnCount: number, singleX: number, rowIndex: number) => {
  const { width } = profile.roomGeometry;
  if (rowColumnCount <= 1) return [oneDecimal(clamp(singleX, width * 0.22, width * 0.78))];
  if (rowIndex === 0 && shouldUseWideAuditoriumStageArrayMics(profile)) return getWideAuditoriumStageArrayMicXValues(profile);
  return [oneDecimal(clamp(width * 0.33, 1.2, width / 2 - 1.2)), oneDecimal(clamp(width * 0.67, width / 2 + 1.2, width - 1.2))];
};

const getWideAuditoriumStageArrayMicXValues = (profile: ClassroomProfile) => {
  const roomWidth = profile.roomGeometry.width;
  const stageWidth = clamp(profile.engineeringConstraints.stageSize?.width ?? roomWidth, 0, roomWidth);
  const stageLeft = (roomWidth - stageWidth) / 2;
  const leftX = stageLeft + stageWidth / 3 - AUDITORIUM_STAGE_ARRAY_MIC_OUTWARD_OFFSET_M;
  const rightX = stageLeft + (stageWidth * 2) / 3 + AUDITORIUM_STAGE_ARRAY_MIC_OUTWARD_OFFSET_M;
  return [
    oneDecimal(clamp(leftX, 1.2, roomWidth / 2 - 1.2)),
    oneDecimal(clamp(rightX, roomWidth / 2 + 1.2, roomWidth - 1.2))
  ];
};

const getArrayMicRowYs = (profile: ClassroomProfile, teacherMicY: number, rowCount: number) => {
  if (isMeetingScenario(profile.scenario)) return getMeetingArrayMicYs(profile, rowCount);
  if (rowCount <= 1) return [oneDecimal(teacherMicY)];

  const targetSupplementCount = rowCount - 1;
  const rearTargetY = getArrayMicRearCoverageTargetY(profile, teacherMicY);
  const endpointY = Math.max(teacherMicY, rearTargetY - ARRAY_MIC_SUPPLEMENT_LAYOUT_BACK_WALL_OFFSET_M);
  const uniformYs = Array.from({ length: rowCount }, (_, index) =>
    index === 0 ? teacherMicY : teacherMicY + ((endpointY - teacherMicY) * index) / rowCount
  );
  const lastBackWallDistance = targetSupplementCount + ARRAY_MIC_SUPPLEMENT_BACK_WALL_BASE_DISTANCE_M;
  const maxLastY = rearTargetY - lastBackWallDistance;
  if ((uniformYs.at(-1) ?? teacherMicY) <= maxLastY) return uniformYs.map(oneDecimal);

  const adjustedLastMicY = Math.max(teacherMicY, maxLastY);
  return Array.from({ length: rowCount }, (_, index) =>
    index === 0 ? oneDecimal(teacherMicY) : oneDecimal(teacherMicY + ((adjustedLastMicY - teacherMicY) * index) / targetSupplementCount)
  );
};

const getMeetingArrayMicYs = (profile: ClassroomProfile, count: number) => {
  return getMeetingArrayMicAxisValues(profile, count);
};

const getMeetingArrayMicAxisValues = (profile: ClassroomProfile, count: number) => {
  const axisSpan = getMeetingArrayMicPrimaryAxisSpan(profile);
  const targetCount = clamp(Math.round(count), 1, ARRAY_MIC_MAX_COUNT);
  if (targetCount <= 1) return [oneDecimal(axisSpan / 2)];

  return Array.from({ length: targetCount }, (_, index) => oneDecimal((axisSpan * (index + 1)) / (targetCount + 1)));
};

const getMeetingArrayMicPrimaryAxisSpan = (profile: ClassroomProfile) =>
  shouldUseMeetingWidthAsArrayMicAxis(profile) ? profile.roomGeometry.width : profile.roomGeometry.length;

const shouldUseMeetingWidthAsArrayMicAxis = (profile: ClassroomProfile) =>
  isMeetingScenario(profile.scenario) && profile.roomGeometry.width > profile.roomGeometry.length;

const getRearSpeechZoneY = (profile: ClassroomProfile, teacherMicY: number) => {
  const rearAisleDepth = getRearAisleDepth(profile);
  const { length: depth } = profile.roomGeometry;
  if (profile.scenario === "combinedClassroom") return getCombinedClassroomTeachingRearTargetY(profile, teacherMicY);
  return oneDecimal(clamp(depth - rearAisleDepth - 0.55, teacherMicY + 2.2, depth - 0.9));
};

const getCombinedClassroomTeachingRearTargetY = (profile: ClassroomProfile, teacherMicY: number) => {
  const { length: depth } = profile.roomGeometry;
  const teachingDepth = profile.engineeringConstraints.teachingAreaSize?.depth || depth;
  return oneDecimal(clamp(teachingDepth - 0.45, teacherMicY + 2.2, depth - 0.9));
};

const getRearAisleDepth = (profile: ClassroomProfile) => {
  const notes = getSiteNotes(profile);
  if (/无后排过道|无后过道|后排座位靠墙|最后一排靠墙/.test(notes)) return 0.45;
  if (/后排过道|后过道|后侧过道|后方过道|最后一排过道/.test(notes)) return 1.2;
  return DEFAULT_REAR_AISLE_DEPTH_M;
};

const getSiteNotes = (profile: ClassroomProfile) => `${profile.engineeringConstraints.notes} ${profile.customNeed} ${profile.customScenario}`;

const hasInteractiveClassNeed = (profile: ClassroomProfile) =>
  profile.needs.includes("interactiveClass") || (profile.needs.includes("other") && /互动课堂|学生区.*线上拾音|线上拾音|学生.*拾音/.test(getSiteNotes(profile)));

const hasOnlinePickupNeed = (profile: ClassroomProfile) =>
  profile.needs.includes("recording") || profile.needs.includes("videoConference") || profile.needs.includes("interactiveClass") || hasInteractiveClassNeed(profile);

const shouldUseMeetingStyleCeilingSpeakerRules = (profile: ClassroomProfile) =>
  isMeetingScenario(profile.scenario) || (profile.scenario === "standardClassroom" && hasLocalAmplificationNeed(profile));

const getCeilingSpeakerPositions = (profile: ClassroomProfile, count: number, arrayMics: GeneratedPoint[], preserveSpeakerCount = false) => {
  const columns = Math.max(1, Math.min(count, getCeilingSpeakerColumnCount(profile)));
  const firstRowCount = getCeilingSpeakerFirstRowCount(profile, count, columns);
  const rowCounts = getCeilingSpeakerRowCounts(count, columns, firstRowCount);
  const rows = rowCounts.length;
  const reserveTeacherMonitorRow = shouldReserveTeacherMonitorSpeakerRow(profile) && !shouldUseMeetingStyleCeilingSpeakerRules(profile);
  const teacherMonitorYRatio = getTeacherMonitorCeilingSpeakerYRatio(profile, arrayMics, firstRowCount);
  const rearRowCount = Math.max(0, rows - 1);
  const layout = rowCounts.flatMap((rowItemCount, row) =>
    Array.from({ length: rowItemCount }, (_, column) => {
      const yRatio =
        shouldUseMeetingStyleCeilingSpeakerRules(profile)
          ? getMeetingCeilingSpeakerYRatio(profile, row, rows)
          : row === 0
          ? reserveTeacherMonitorRow
            ? teacherMonitorYRatio
            : getFrontCeilingSpeakerYRatio(profile, 0.22)
          : getRearCeilingSpeakerYRatio(profile, arrayMics, row - 1, rearRowCount);
      return {
        xRatio: getCeilingSpeakerXRatio(profile, column, rowItemCount),
        yRatio
      };
    })
  );
  const micRowsForAvoidance = getArrayMicRowsForCeilingSpeakerRemoval(profile, arrayMics);
  const useCenterColumnGapAvoidance =
    profile.roomGeometry.length > profile.roomGeometry.width &&
    (columns === 3 || columns === 5) &&
    shouldUseCenterColumnArrayMicGapAvoidance(profile, micRowsForAvoidance);
  const useCenterRowGapAvoidance = profile.roomGeometry.width > profile.roomGeometry.length && (rows === 3 || rows === 5);
  const arrangedLayout =
    columns === 3 && shouldRemoveFirstRowCenterCeilingSpeaker(profile, micRowsForAvoidance)
      ? removeFirstRowCenterCeilingSpeaker(profile, layout, columns)
      : useCenterRowGapAvoidance
      ? avoidCenterRowArrayMicConflict(profile, layout, arrayMics)
      : useCenterColumnGapAvoidance
      ? avoidCenterColumnArrayMicConflict(profile, layout, micRowsForAvoidance.flatMap((row) => row.mics))
      : columns === 3 && profile.roomGeometry.length > profile.roomGeometry.width
        ? removeCeilingSpeakersNearArrayMicRows(profile, layout, columns, arrayMics)
        : layout;
  const centerColumnSafeLayout =
    useCenterColumnGapAvoidance || useCenterRowGapAvoidance
      ? arrangedLayout
      : removeNearestCenterColumnCeilingSpeakerNearArrayMic(profile, arrangedLayout, arrayMics);
  const finalLayout =
    preserveSpeakerCount && centerColumnSafeLayout.length !== count
      ? restoreManualCeilingSpeakerCount(profile, centerColumnSafeLayout, count)
      : centerColumnSafeLayout;
  return finalLayout.map((target) => getCeilingSpeakerPositionAwayFromMics(profile, target, arrayMics));
};

const getCeilingSpeakerFirstRowCount = (profile: ClassroomProfile, count: number, columns: number) => {
  if (!shouldLimitClassroomFirstCeilingSpeakerRowToTwo(profile)) return Math.min(count, columns);
  return Math.min(count, columns, 2);
};

const getCeilingSpeakerRowCounts = (count: number, columns: number, firstRowCount: number) => {
  if (count <= 0 || columns <= 0) return [];
  const rowCounts = [Math.min(count, Math.max(1, firstRowCount))];
  let remaining = count - rowCounts[0];
  while (remaining > 0) {
    const rowCount = Math.min(columns, remaining);
    rowCounts.push(rowCount);
    remaining -= rowCount;
  }
  return rowCounts;
};

const shouldLimitClassroomFirstCeilingSpeakerRowToTwo = (profile: ClassroomProfile) =>
  isClassroomScenario(profile.scenario) && profile.roomGeometry.width <= 12;

const getClassroomFirstCeilingSpeakerRowReduction = (profile: ClassroomProfile, columns: number) =>
  shouldLimitClassroomFirstCeilingSpeakerRowToTwo(profile) ? Math.max(0, columns - 2) : 0;

const removeNearestCenterColumnCeilingSpeakerNearArrayMic = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  arrayMics: GeneratedPoint[]
) => {
  if (profile.roomGeometry.length <= profile.roomGeometry.width) return layout;
  if (!layout.length || !arrayMics.length) return layout;
  const xColumns = Array.from(new Set(layout.map((item) => oneDecimal(item.xRatio)))).sort((a, b) => a - b);
  if (xColumns.length !== 3 && xColumns.length !== 5) return layout;

  const centerXRatio = xColumns.reduce((best, xRatio) => (Math.abs(xRatio - 0.5) < Math.abs(best - 0.5) ? xRatio : best), xColumns[0] ?? 0.5);
  const centerMics = arrayMics.filter((mic) => isArrayMicInCenterCeilingColumn(profile, mic, xColumns, centerXRatio));
  if (!centerMics.length) return layout;

  const centerCandidates = layout
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Math.abs(oneDecimal(item.xRatio) - centerXRatio) <= 0.01);
  if (!centerCandidates.length) return layout;

  const nearest = centerCandidates.reduce(
    (best, candidate) => {
      const speakerPosition = getCeilingSpeakerPositionAwayFromMics(profile, candidate.item, arrayMics);
      const nearestDistance = centerMics.reduce((min, mic) => Math.min(min, getDistance(speakerPosition, mic.position)), Number.POSITIVE_INFINITY);
      return nearestDistance < best.distance ? { index: candidate.index, distance: nearestDistance } : best;
    },
    { index: -1, distance: Number.POSITIVE_INFINITY }
  );
  if (nearest.index < 0 || nearest.distance >= MIN_CEILING_SPEAKER_TO_MIC_DISTANCE) return layout;
  return layout.filter((_, index) => index !== nearest.index);
};

const isArrayMicInCenterCeilingColumn = (
  profile: ClassroomProfile,
  mic: GeneratedPoint,
  xColumns: number[],
  centerXRatio: number
) => {
  if (profile.roomGeometry.width <= 0) return false;
  const micXRatio = mic.position.x / profile.roomGeometry.width;
  const nearestColumn = xColumns.reduce((best, xRatio) => (Math.abs(xRatio - micXRatio) < Math.abs(best - micXRatio) ? xRatio : best), xColumns[0] ?? 0.5);
  return Math.abs(nearestColumn - centerXRatio) <= 0.01;
};

const restoreManualCeilingSpeakerCount = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  targetCount: number
) => {
  if (!layout.length || layout.length === targetCount) return layout;
  if (layout.length > targetCount) return layout.slice(0, targetCount);
  const rows = new Map<number, Array<{ xRatio: number; yRatio: number }>>();
  layout.forEach((item) => {
    const rowKey = oneDecimal(item.yRatio);
    const row = rows.get(rowKey) ?? [];
    row.push(item);
    rows.set(rowKey, row);
  });

  const sortedRows = Array.from(rows.entries()).sort(([a], [b]) => a - b);
  let remainingToAdd = targetCount - layout.length;
  while (remainingToAdd > 0) {
    const lastRow = sortedRows[sortedRows.length - 1];
    if (!lastRow) break;
    lastRow[1].push({ xRatio: 0.5, yRatio: lastRow[0] });
    remainingToAdd -= 1;
  }

  return sortedRows.flatMap(([, row]) =>
    row
      .sort((a, b) => a.xRatio - b.xRatio)
      .map((item, column) => ({
        xRatio: getCeilingSpeakerXRatio(profile, column, row.length),
        yRatio: item.yRatio
      }))
  );
};

const shouldRemoveFirstRowCenterCeilingSpeaker = (profile: ClassroomProfile, micRows: Array<{ y: number; mics: GeneratedPoint[] }>) =>
  isClassroomScenario(profile.scenario) &&
  !shouldUseMeetingStyleCeilingSpeakerRules(profile) &&
  getEffectiveAmplificationScope(profile) === "podium" &&
  micRows.length === 1 &&
  micRows[0]?.mics.length === 1;

const removeFirstRowCenterCeilingSpeaker = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  columns: number
) => {
  const firstRowCount = Math.min(columns, layout.length);
  if (firstRowCount < 3) return layout;
  const centerOffset = Math.floor(firstRowCount / 2);
  return reflowCeilingSpeakerRowsAfterRemoval(profile, layout, columns, new Set([centerOffset]));
};

const shouldUseCenterColumnArrayMicGapAvoidance = (profile: ClassroomProfile, micRows: Array<{ y: number; mics: GeneratedPoint[] }>) => {
  if (!micRows.length || micRows.some((row) => row.mics.length !== 1)) return false;
  if (isMeetingScenario(profile.scenario) || shouldUseMeetingStyleCeilingSpeakerRules(profile)) return true;
  return isClassroomScenario(profile.scenario) && getEffectiveAmplificationScope(profile) === "full";
};

const avoidCenterColumnArrayMicConflict = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  sourceMics: GeneratedPoint[]
) => {
  if (!sourceMics.length) return layout;

  const xColumns = Array.from(new Set(layout.map((item) => oneDecimal(item.xRatio)))).sort((a, b) => a - b);
  const centerXRatio = xColumns.reduce((best, xRatio) => (Math.abs(xRatio - 0.5) < Math.abs(best - 0.5) ? xRatio : best), xColumns[0] ?? 0.5);
  const centerIndexes = layout
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Math.abs(oneDecimal(item.xRatio) - centerXRatio) <= 0.01)
    .map(({ index }) => index);
  if (!centerIndexes.length) return layout;

  const centerColumnLayout = getCenterColumnSpeakerYRatiosByArrayMicGaps(profile, sourceMics)
    .map((yRatio) => ({
      xRatio: centerXRatio,
      yRatio
    }));
  const centerIndexSet = new Set(centerIndexes);
  return [...layout.filter((_, index) => !centerIndexSet.has(index)), ...centerColumnLayout].sort((a, b) => a.yRatio - b.yRatio || a.xRatio - b.xRatio);
};

const avoidCenterRowArrayMicConflict = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  sourceMics: GeneratedPoint[]
) => {
  if (!sourceMics.length) return layout;

  const yRows = Array.from(new Set(layout.map((item) => oneDecimal(item.yRatio)))).sort((a, b) => a - b);
  if (yRows.length !== 3 && yRows.length !== 5) return layout;
  const centerYRatio = yRows.reduce((best, yRatio) => (Math.abs(yRatio - 0.5) < Math.abs(best - 0.5) ? yRatio : best), yRows[0] ?? 0.5);
  const centerIndexes = layout
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Math.abs(oneDecimal(item.yRatio) - centerYRatio) <= 0.01)
    .map(({ index }) => index);
  if (!centerIndexes.length) return layout;

  const centerRowLayout = getCenterRowSpeakerXRatiosByArrayMicGaps(profile, sourceMics)
    .map((xRatio) => ({
      xRatio,
      yRatio: centerYRatio
    }));
  const centerIndexSet = new Set(centerIndexes);
  return [...layout.filter((_, index) => !centerIndexSet.has(index)), ...centerRowLayout].sort((a, b) => a.yRatio - b.yRatio || a.xRatio - b.xRatio);
};

const getCenterColumnSpeakerYRatiosByArrayMicGaps = (profile: ClassroomProfile, arrayMics: GeneratedPoint[]) => {
  const { length } = profile.roomGeometry;
  if (length <= 0) return [];

  const anchors = Array.from(new Set(arrayMics.map((mic) => oneDecimal(clamp(mic.position.y, 0, length))))).sort((a, b) => a - b);
  if (!anchors.length) return [];

  const yValues: number[] = [];
  if (anchors[0] >= CENTER_COLUMN_SPEAKER_WALL_GAP_TRIGGER_M) {
    yValues.push(anchors[0] / 2);
  }
  anchors.slice(1).forEach((anchor, index) => {
    const previousAnchor = anchors[index];
    if (anchor - previousAnchor >= CENTER_COLUMN_SPEAKER_BETWEEN_MIC_GAP_TRIGGER_M) {
      yValues.push((previousAnchor + anchor) / 2);
    }
  });
  const lastAnchor = anchors[anchors.length - 1];
  if (length - lastAnchor >= CENTER_COLUMN_SPEAKER_WALL_GAP_TRIGGER_M) {
    yValues.push((lastAnchor + length) / 2);
  }

  return yValues.map((y) => clamp(y, 0, length) / length);
};

const getCenterRowSpeakerXRatiosByArrayMicGaps = (profile: ClassroomProfile, arrayMics: GeneratedPoint[]) => {
  const { width } = profile.roomGeometry;
  if (width <= 0) return [];

  const anchors = Array.from(new Set(arrayMics.map((mic) => oneDecimal(clamp(mic.position.x, 0, width))))).sort((a, b) => a - b);
  if (!anchors.length) return [];

  const xValues: number[] = [];
  if (anchors[0] >= CENTER_COLUMN_SPEAKER_WALL_GAP_TRIGGER_M) {
    xValues.push(anchors[0] / 2);
  }
  anchors.slice(1).forEach((anchor, index) => {
    const previousAnchor = anchors[index];
    if (anchor - previousAnchor >= CENTER_COLUMN_SPEAKER_BETWEEN_MIC_GAP_TRIGGER_M) {
      xValues.push((previousAnchor + anchor) / 2);
    }
  });
  const lastAnchor = anchors[anchors.length - 1];
  if (width - lastAnchor >= CENTER_COLUMN_SPEAKER_WALL_GAP_TRIGGER_M) {
    xValues.push((lastAnchor + width) / 2);
  }

  return xValues.map((x) => clamp(x, 0, width) / width);
};

const removeCeilingSpeakersNearArrayMicRows = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  columns: number,
  arrayMics: GeneratedPoint[]
) => {
  const micRows = getArrayMicRowsForCeilingSpeakerRemoval(profile, arrayMics);
  if (!micRows.length) return layout;

  const removedIndexes = new Set<number>();
  if (micRows.length === 1 && !isMeetingScenario(profile.scenario)) {
    const firstRowCount = Math.min(columns, layout.length);
    const primaryMic = micRows[0]?.mics[0]?.position ?? { x: profile.roomGeometry.width / 2, y: getPrimaryArrayMicY(profile) };
    const firstRowIndexes = Array.from({ length: firstRowCount }, (_, index) => index);
    const removeIndex = firstRowIndexes.reduce((best, index) => {
      const bestX = profile.roomGeometry.width * layout[best].xRatio;
      const currentX = profile.roomGeometry.width * layout[index].xRatio;
      return Math.abs(currentX - primaryMic.x) < Math.abs(bestX - primaryMic.x) ? index : best;
    }, firstRowIndexes[0]);
    removedIndexes.add(removeIndex);
  } else {
    micRows.forEach((micRow) => {
      const availableIndexes = layout.map((_, index) => index).filter((index) => !removedIndexes.has(index));
      if (!availableIndexes.length) return;
      const removeIndex = availableIndexes.reduce((best, index) => {
        const bestDistance = getNearestDistanceToMicRow(profile, layout[best], micRow.mics);
        const currentDistance = getNearestDistanceToMicRow(profile, layout[index], micRow.mics);
        return currentDistance < bestDistance ? index : best;
      }, availableIndexes[0]);
      removedIndexes.add(removeIndex);
    });
  }

  return reflowCeilingSpeakerRowsAfterRemoval(profile, layout, columns, removedIndexes);
};

const getArrayMicRowsForCeilingSpeakerRemoval = (profile: ClassroomProfile, arrayMics: GeneratedPoint[]) => {
  const sourceMics =
    arrayMics.length > 0
      ? arrayMics
      : [
          {
            position: { x: getTeacherArrayMicX(profile), y: getPrimaryArrayMicY(profile) }
          } as GeneratedPoint
        ];
  return Array.from(
    sourceMics
      .reduce((rows, mic) => {
        const rowKey = oneDecimal(mic.position.y);
        const rowMics = rows.get(rowKey) ?? [];
        rowMics.push(mic);
        rows.set(rowKey, rowMics);
        return rows;
      }, new Map<number, GeneratedPoint[]>())
      .entries()
  )
    .map(([y, mics]) => ({ y, mics }))
    .sort((a, b) => a.y - b.y);
};

const getNearestDistanceToMicRow = (profile: ClassroomProfile, target: { xRatio: number; yRatio: number }, mics: GeneratedPoint[]) => {
  const targetPosition = {
    x: profile.roomGeometry.width * target.xRatio,
    y: profile.roomGeometry.length * target.yRatio
  };
  return mics.reduce((nearest, mic) => Math.min(nearest, getDistance(targetPosition, mic.position)), Number.POSITIVE_INFINITY);
};

const reflowCeilingSpeakerRowsAfterRemoval = (
  profile: ClassroomProfile,
  layout: Array<{ xRatio: number; yRatio: number }>,
  columns: number,
  removedIndexes: Set<number>
) => {
  const removedRows = new Set(Array.from(removedIndexes, (index) => Math.floor(index / columns)));
  const result: Array<{ xRatio: number; yRatio: number }> = [];
  for (let row = 0; row * columns < layout.length; row += 1) {
    const rowStartIndex = row * columns;
    const rowItems = layout.slice(rowStartIndex, rowStartIndex + columns).filter((_, offset) => !removedIndexes.has(rowStartIndex + offset));
    const shouldReflow = removedRows.has(row);
    rowItems.forEach((item, column) => {
      result.push({
        xRatio: shouldReflow ? getCeilingSpeakerXRatio(profile, column, rowItems.length) : item.xRatio,
        yRatio: item.yRatio
      });
    });
  }
  return result;
};

const getCeilingSpeakerXRatio = (profile: ClassroomProfile, column: number, columns: number) => {
  return getCeilingSpeakerHorizontalAxisRatio(profile.roomGeometry.width, column, columns);
};

const getMeetingCeilingSpeakerXRatio = (profile: ClassroomProfile, column: number, columns: number) => {
  return getCeilingSpeakerHorizontalAxisRatio(profile.roomGeometry.width, column, columns);
};

const getCeilingSpeakerHorizontalAxisRatio = (span: number, index: number, count: number) => {
  if (count <= 1 || span <= 0) return 0.5;
  const start = Math.min(CEILING_SPEAKER_SIDE_INSTALL_INSET_M, span / 2);
  const end = Math.max(start, span - start);
  const axis = start + ((end - start) * (index + 0.5)) / count;
  return axis / span;
};

const getCeilingSpeakerAxisRatio = (span: number, index: number, count: number) => {
  if (count <= 1 || span <= 0) return 0.5;
  const start = Math.min(CEILING_SPEAKER_COVERAGE_RADIUS_M, span / 2);
  const end = Math.max(start, span - start);
  const axis = start + ((end - start) * index) / Math.max(1, count - 1);
  return axis / span;
};

const getWallSpeakerPositions = (profile: ClassroomProfile, count: number, primaryMicY: number): WallSpeakerPosition[] => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const preferredSideFirstY = getPreferredFirstSideWallSpeakerY(profile, primaryMicY);
  const pairRows = Math.ceil(count / 2);
  if (shouldUseFullRoomWallSpeakerOrientationByRoomShape(profile)) {
    return getFullRoomWallSpeakerPositionsByRoomShape(profile, count);
  }
  if (shouldReserveTeacherMonitorSpeakerRow(profile)) {
    return getWallSpeakerPositionsWithTeacherMonitorRow(profile, count, preferredSideFirstY, primaryMicY);
  }
  if (profile.scenario !== "auditorium" && shouldUseFrontWallFirstSpeakerRow(depth, pairRows, preferredSideFirstY)) {
    const sideRows = pairRows - 1;
    const sideFirstY = clamp(preferredSideFirstY, 0.8, depth - WALL_COLUMN_MIN_BACK_WALL_DISTANCE_M);
    const sideYValues = getSideWallSpeakerYValues(depth, sideRows, sideFirstY, primaryMicY);
    return Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / 2);
      const isLeft = index % 2 === 0;
      if (row === 0) {
        return {
          x: getFrontBackWallSpeakerX(roomWidth, isLeft),
          y: 0
        };
      }
      return {
        x: isLeft ? 0 : roomWidth,
        y: oneDecimal(sideYValues[row - 1] ?? sideFirstY)
      };
    });
  }
  const yValues = getSideWallSpeakerYValues(depth, pairRows, preferredSideFirstY, primaryMicY);
  return Array.from({ length: count }, (_, index) => ({
    x: index % 2 === 0 ? 0 : roomWidth,
    y: oneDecimal(yValues[Math.floor(index / 2)])
  }));
};

const shouldUseFullRoomWallSpeakerOrientationByRoomShape = (profile: ClassroomProfile) => shouldUseMeetingStyleFullRoomWallSpeakerRules(profile);

const shouldUseMeetingStyleFullRoomWallSpeakerRules = (profile: ClassroomProfile) =>
  isMeetingScenario(profile.scenario) || getEffectiveAmplificationScope(profile) === "full";

const getFullRoomWallSpeakerPositionsByRoomShape = (profile: ClassroomProfile, count: number) => {
  const { length, width } = profile.roomGeometry;
  if (Math.abs(length - width) <= 0.05) return getCornerWallSpeakerPositions(profile, count);
  if (length > width) return getFrontBackWallSpeakerPositionsWithCenterSideFill(profile, count);
  return getSideWallSpeakerEvenPositionsWithCenterFrontBackFill(profile, count);
};

const getFrontBackWallSpeakerPositionsWithCenterSideFill = (profile: ClassroomProfile, count: number) => {
  const baseCount = Math.min(4, count);
  const extraCount = Math.max(0, count - baseCount);
  const sideFillPairs = Math.floor(extraCount / 2);
  return [
    ...getFrontBackWallSpeakerPositions(profile, baseCount),
    ...getDistributedWallAxisPositionsWithInset(profile.roomGeometry.length, sideFillPairs, MEETING_WALL_SPEAKER_CENTER_FILL_WALL_INSET_M).flatMap((y) => [
      { x: 0, y, forcePerpendicularAim: true },
      { x: profile.roomGeometry.width, y, forcePerpendicularAim: true }
    ])
  ];
};

const getSideWallSpeakerEvenPositionsWithCenterFrontBackFill = (profile: ClassroomProfile, count: number) => {
  const baseCount = Math.min(4, count);
  const extraCount = Math.max(0, count - baseCount);
  const frontBackFillPairs = Math.floor(extraCount / 2);
  return [
    ...getSideWallSpeakerEvenPositions(profile, baseCount),
    ...getDistributedWallAxisPositionsWithInset(profile.roomGeometry.width, frontBackFillPairs, MEETING_WALL_SPEAKER_CENTER_FILL_WALL_INSET_M).flatMap((x) => [
      { x, y: 0, forcePerpendicularAim: true },
      { x, y: profile.roomGeometry.length, forcePerpendicularAim: true }
    ])
  ];
};

const getFrontBackWallSpeakerPositions = (profile: ClassroomProfile, count: number) => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const frontCount = Math.ceil(count / 2);
  const backCount = count - frontCount;
  return [
    ...getDistributedWallAxisPositions(roomWidth, frontCount).map((x) => ({ x, y: 0 })),
    ...getDistributedWallAxisPositions(roomWidth, backCount).map((x) => ({ x, y: depth }))
  ];
};

const getSideWallSpeakerEvenPositions = (profile: ClassroomProfile, count: number) => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const leftCount = Math.ceil(count / 2);
  const rightCount = count - leftCount;
  return [
    ...getDistributedWallAxisPositions(depth, leftCount).map((y) => ({ x: 0, y })),
    ...getDistributedWallAxisPositions(depth, rightCount).map((y) => ({ x: roomWidth, y }))
  ];
};

const getCornerWallSpeakerPositions = (profile: ClassroomProfile, count: number) => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const corners = [
    { x: 0, y: 0 },
    { x: roomWidth, y: 0 },
    { x: 0, y: depth },
    { x: roomWidth, y: depth }
  ];
  if (count <= corners.length) return corners.slice(0, count);
  return [...corners, ...getSideWallSpeakerEvenPositions(profile, count - corners.length)];
};

const getDistributedWallAxisPositions = (span: number, count: number) => {
  if (count <= 0) return [];
  if (count === 1) return [oneDecimal(span / 2)];
  const start = span * 0.15;
  const end = span * 0.85;
  return Array.from({ length: count }, (_, index) => oneDecimal(start + ((end - start) * index) / Math.max(1, count - 1)));
};

const getDistributedWallAxisPositionsWithInset = (span: number, count: number, inset: number) => {
  if (count <= 0) return [];
  const start = Math.min(inset, span / 2);
  const end = Math.max(start, span - start);
  const usableSpan = end - start;
  return Array.from({ length: count }, (_, index) => oneDecimal(start + (usableSpan * (index + 0.5)) / count));
};

const shouldReserveTeacherMonitorSpeakerRow = (profile: ClassroomProfile) =>
  profile.scenario !== "auditorium" && profile.scenario !== "combinedClassroom" && getEffectiveAmplificationScope(profile) === "podium";

const getPodiumSpeakerRowsReason = (profile: ClassroomProfile, speakerCount: number) => {
  if (!shouldReserveTeacherMonitorSpeakerRow(profile)) return "";
  const rearDepth = oneDecimal(profile.roomGeometry.length - getPrimaryArrayMicY(profile));
  const rearFillRows = Math.max(0, Math.ceil(speakerCount / 2) - 1);
  const singleRowText = rearFillRows === 1 && rearDepth >= 6.9 && rearDepth <= 8 ? "后场 1 排在 D=6.9-8m 时按 D 线性过渡，D=6.9m 为主麦后 1m，D=8m 为离后墙约 6m；" : "";
  const cappedText =
    rearFillRows >= WALL_SPEAKER_MAX_REAR_FILL_ROWS
      ? `已达到单套阵列麦主机 + 1 台扩展功放的推荐上限 ${RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER} 只，若仍覆盖不足需拆区或增加系统；`
      : "";
  return `前墙补声/监听组不计入后场排数，按主麦到后墙约 ${rearDepth}m、壁挂最大覆盖半径 ${WALL_SPEAKER_MAX_COVERAGE_RADIUS_M}m 和后排覆盖递增规则判定后场补声 ${rearFillRows} 排；${singleRowText}${cappedText}最后一排离后墙硬下限为 ${getWallColumnBackWallHardLimit(rearFillRows, rearDepth).toFixed(1)}m；`;
};

const getCeilingSpeakerRowsReason = (profile: ClassroomProfile, speakerCount: number) => {
  if (shouldUseMeetingStyleCeilingSpeakerRules(profile)) return "";
  if (!shouldReserveTeacherMonitorSpeakerRow(profile)) return "";
  const rearDepth = oneDecimal(profile.roomGeometry.length - getPrimaryArrayMicY(profile));
  const rearRows = Math.max(0, Math.ceil(speakerCount / getCeilingSpeakerColumnCount(profile)) - 1);
  return `老师区/第一排吸顶不计入阵麦后排数；阵麦后 ${rearRows} 排吸顶在主阵麦到后墙约 ${rearDepth}m 之间均匀分布覆盖；`;
};

const getFrontCeilingSpeakerYRatio = (profile: ClassroomProfile, preferredYRatio: number) => {
  const { length: depth } = profile.roomGeometry;
  const bounds = getCeilingSpeakerWallBounds(profile);
  const frontCoverageLimitY = Math.min(bounds.maxY, CEILING_SPEAKER_COVERAGE_RADIUS_M);
  return clamp(depth * preferredYRatio, bounds.minY, frontCoverageLimitY) / depth;
};

const getTeacherMonitorCeilingSpeakerYRatio = (profile: ClassroomProfile, arrayMics: GeneratedPoint[], columns: number) => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const bounds = getCeilingSpeakerWallBounds(profile);
  const primaryMic = arrayMics.find((point) => point.type === "arrayMic") ?? {
    position: {
      x: getTeacherArrayMicX(profile),
      y: getPrimaryArrayMicY(profile)
    }
  };
  const baseY = getFrontCeilingSpeakerYRatio(profile, 0.22) * depth;
  const firstRowXRatios = Array.from({ length: columns }, (_, column) => getCeilingSpeakerXRatio(profile, column, columns));
  const nearestHorizontalGap = firstRowXRatios.reduce((nearest, xRatio) => {
    const speakerX = clamp(roomWidth * xRatio, bounds.minX, bounds.maxX);
    return Math.min(nearest, Math.abs(speakerX - primaryMic.position.x));
  }, Number.POSITIVE_INFINITY);
  const targetVerticalGap = Math.sqrt(Math.max(0, TEACHER_MONITOR_CEILING_SPEAKER_SOFT_MIC_DISTANCE ** 2 - nearestHorizontalGap ** 2));
  const softAvoidanceY = primaryMic.position.y - targetVerticalGap;
  return clamp(softAvoidanceY, bounds.minY, baseY) / depth;
};

const getRearCeilingSpeakerYRatio = (profile: ClassroomProfile, arrayMics: GeneratedPoint[], rearRowIndex: number, rearRowCount: number) => {
  const { length: depth } = profile.roomGeometry;
  const bounds = getCeilingSpeakerWallBounds(profile);
  const primaryMicY = arrayMics.find((point) => point.type === "arrayMic")?.position.y ?? getPrimaryArrayMicY(profile);
  const step = Math.max(0, depth - primaryMicY) / (Math.max(1, rearRowCount) + 1);
  const y = primaryMicY + step * (rearRowIndex + 1);
  return clamp(y, bounds.minY, bounds.maxY) / depth;
};

const getMeetingCeilingSpeakerYRatio = (profile: ClassroomProfile, row: number, rows: number) => {
  return getCeilingSpeakerAxisRatio(profile.roomGeometry.length, row, rows);
};

const getWallSpeakerPositionsWithTeacherMonitorRow = (profile: ClassroomProfile, count: number, sideFirstY: number, primaryMicY: number) => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const frontCount = Math.min(2, count);
  if (depth <= FRONT_BACK_WALL_SPEAKER_MAX_ROOM_LENGTH_M) {
    return Array.from({ length: count }, (_, index) => {
      const isLeft = index % 2 === 0;
      return {
        x: getFrontBackWallSpeakerX(roomWidth, isLeft),
        y: count <= 2 ? depth : index < frontCount ? 0 : depth
      };
    });
  }
  const sideCount = Math.max(0, count - frontCount);
  const sideRows = Math.ceil(sideCount / 2);
  const sideYValues = sideRows > 0 ? getSideWallSpeakerYValues(depth, sideRows, sideFirstY, primaryMicY) : [];

  return Array.from({ length: count }, (_, index) => {
    const isLeft = index % 2 === 0;
    if (index < frontCount) {
      return {
        x: getFrontBackWallSpeakerX(roomWidth, isLeft),
        y: 0
      };
    }
    const sideIndex = index - frontCount;
    return {
      x: isLeft ? 0 : roomWidth,
      y: oneDecimal(sideYValues[Math.floor(sideIndex / 2)] ?? sideFirstY)
    };
  });
};

const getFrontBackWallSpeakerX = (roomWidth: number, isLeft: boolean) => oneDecimal(isLeft ? roomWidth * 0.15 : roomWidth * 0.85);

const getPreferredFirstSideWallSpeakerY = (profile: ClassroomProfile, primaryMicY: number) => {
  return clamp(
    primaryMicY + getFirstSideWallSpeakerBehindMicDistance(profile),
    0.8,
    profile.roomGeometry.length - getWallColumnBackWallHardLimit(getRearFillRowCountByPrimaryMicRearDepth(profile), profile.roomGeometry.length - primaryMicY)
  );
};

const getPreferredFirstSideWallSpeakerYForRows = (profile: ClassroomProfile, primaryMicY: number, rearFillRowCount: number) => {
  const rearDepth = profile.roomGeometry.length - primaryMicY;
  return clamp(
    primaryMicY + getFirstSideWallSpeakerBehindMicDistance(profile),
    0.8,
    profile.roomGeometry.length - getWallColumnBackWallHardLimit(rearFillRowCount, rearDepth)
  );
};

const getFirstSideWallSpeakerBehindMicDistance = (profile: ClassroomProfile) => {
  const depth = profile.roomGeometry.length;
  if (depth <= 9) return 0.5;
  if (depth <= 12) return 0.8;
  return 1;
};

const getSideWallSpeakerYValues = (depth: number, pairRows: number, firstY: number, primaryMicY?: number) => {
  const lastRowY = getLastWallSpeakerRowY(depth, pairRows, firstY, primaryMicY);
  return (
    pairRows === 1
      ? [lastRowY]
      : Array.from({ length: pairRows }, (_, index) => {
          const ratio = getRearFillGradientRatio(index, pairRows);
          return clamp(firstY + (lastRowY - firstY) * ratio, 0.8, lastRowY);
        })
  );
};

const getRearFillGradientRatio = (index: number, pairRows: number) => {
  if (pairRows <= 1) return 1;
  const linear = index / Math.max(1, pairRows - 1);
  return Math.pow(linear, 1.18);
};

const shouldUseFrontWallFirstSpeakerRow = (depth: number, pairRows: number, firstY: number) => {
  if (pairRows <= 1) return false;
  const maxByBackWall = depth - getWallColumnBackWallHardLimit(pairRows - 1);
  const requiredSideDepth = firstY + (pairRows - 1) * WALL_SPEAKER_MIN_SAME_SIDE_SPACING_M;
  return requiredSideDepth > maxByBackWall;
};

const getLastWallSpeakerRowY = (depth: number, pairRows: number, firstY: number, primaryMicY?: number) => {
  const hardBackWallLimit = getWallColumnBackWallHardLimit(pairRows, primaryMicY === undefined ? undefined : depth - primaryMicY);
  const maxByBackWall = Math.max(0.8, depth - hardBackWallLimit);
  if (pairRows <= 1) {
    return oneDecimal(clamp(primaryMicY === undefined ? firstY : getSingleRearFillWallSpeakerY(depth, primaryMicY, firstY), 0.8, maxByBackWall));
  }
  const preferredSpacingY = firstY + (pairRows - 1) * WALL_SPEAKER_PREFERRED_SAME_SIDE_SPACING_M;
  const minBySpacing = firstY + (pairRows - 1) * WALL_SPEAKER_MIN_SAME_SIDE_SPACING_M;
  if (maxByBackWall < minBySpacing) return maxByBackWall;
  return oneDecimal(clamp(preferredSpacingY, minBySpacing, maxByBackWall));
};

const getSingleRearFillWallSpeakerY = (depth: number, primaryMicY: number, firstY: number) => {
  const rearDepth = depth - primaryMicY;
  if (rearDepth < 6.9 || rearDepth > 8) return firstY;
  const ratio = (rearDepth - 6.9) / (8 - 6.9);
  const nearMicY = primaryMicY + 1;
  const farY = depth - 6;
  return nearMicY + (farY - nearMicY) * ratio;
};

const getWallColumnBackWallHardLimit = (rearFillRowCount: number, rearDepth?: number) => {
  if (rearFillRowCount <= 1) return 3.5;
  if (rearFillRowCount === 2 && rearDepth !== undefined && rearDepth > 8 && rearDepth <= 9) return 4;
  if (rearFillRowCount === 2) return 4.5;
  return 5.5;
};

const getWallSpeakerAim = (
  profile: ClassroomProfile,
  position: WallSpeakerPosition,
  coverageLength: number,
  arrayMics: GeneratedPoint[]
) => {
  const side = getWallSpeakerRoomSide(profile, position);
  if (position.forcePerpendicularAim) {
    return {
      horizontalAngle: 0,
      target: getPerpendicularWallSpeakerTarget(profile, position, coverageLength),
      edgeCoverage: undefined
    };
  }
  if (side === "front") {
    return {
      horizontalAngle: getOriginalFrontWallSpeakerHorizontalAngle(profile, position),
      target: undefined,
      edgeCoverage: undefined
    };
  }
  if (side === "back") {
    const target = getOriginalBackWallSpeakerTarget(profile, position, arrayMics[0]?.position.y ?? getPrimaryArrayMicY(profile));
    return {
      horizontalAngle: getOriginalWallSpeakerHorizontalAngleFromTarget(profile, position, target),
      target,
      edgeCoverage: undefined
    };
  }
  if (shouldUseOriginalMeetingSideWallSpeakerAim(profile, position)) {
    return getOriginalMeetingSideWallSpeakerAim(profile, position, arrayMics);
  }

  const candidates = getOriginalWallSpeakerTargetCandidates(profile, position, coverageLength);
  const target =
    candidates.find(
      (candidate) =>
        isOriginalWallSpeakerConeBehindArrayMicRows(profile, position, candidate, arrayMics) &&
        !doesOriginalWallSpeakerConeCoverArrayMic(position, candidate, coverageLength, arrayMics)
    ) ?? candidates[candidates.length - 1];
  return {
    horizontalAngle: getOriginalWallSpeakerHorizontalAngleFromTarget(profile, position, target),
    target,
    edgeCoverage: undefined
  };
};

const shouldUseOriginalMeetingSideWallSpeakerAim = (profile: ClassroomProfile, position: Point) => {
  const side = getWallSpeakerRoomSide(profile, position);
  return (side === "left" || side === "right") && shouldUseMeetingStyleFullRoomWallSpeakerRules(profile);
};

const getOriginalMeetingSideWallSpeakerAim = (profile: ClassroomProfile, position: Point, arrayMics: GeneratedPoint[]) => {
  const targetArrayMic = getNearestOriginalMeetingArrayMicTarget(profile, position, arrayMics);
  const target = getOriginalMeetingSideWallSpeakerTarget(profile, position, targetArrayMic);
  return {
    horizontalAngle: getOriginalMeetingSideWallSpeakerHorizontalAngleFromTarget(profile, position, target),
    target,
    edgeCoverage: undefined
  };
};

const getNearestOriginalMeetingArrayMicTarget = (profile: ClassroomProfile, position: Point, arrayMics: GeneratedPoint[]) => {
  const fallback = { x: profile.roomGeometry.width / 2, y: profile.roomGeometry.length / 2 };
  if (!arrayMics.length) return fallback;
  return arrayMics.reduce((best, mic) => (getDistance(mic.position, position) < getDistance(best.position, position) ? mic : best)).position;
};

const getOriginalMeetingSideWallSpeakerTarget = (profile: ClassroomProfile, position: Point, arrayMicTarget: Point) => {
  const vector = { x: arrayMicTarget.x - position.x, y: arrayMicTarget.y - position.y };
  if (Math.abs(vector.y) < 0.2) return clampOriginalMeetingSideWallSpeakerTarget(profile, arrayMicTarget);

  const rotatedTargets = [
    rotateOriginalMeetingTargetAroundSpeaker(position, vector, ORIGINAL_MEETING_SIDE_WALL_SPEAKER_OUTWARD_OFFSET_DEG),
    rotateOriginalMeetingTargetAroundSpeaker(position, vector, -ORIGINAL_MEETING_SIDE_WALL_SPEAKER_OUTWARD_OFFSET_DEG)
  ];
  const side = getWallSpeakerRoomSide(profile, position);
  const inwardTargets = rotatedTargets.filter((target) =>
    side === "left" ? target.x > position.x : side === "right" ? target.x < position.x : true
  );
  const prefersFrontOutward = position.y < arrayMicTarget.y;
  const outwardTargets = inwardTargets.filter((target) =>
    prefersFrontOutward ? target.y < arrayMicTarget.y : target.y > arrayMicTarget.y
  );
  const candidates = outwardTargets.length ? outwardTargets : inwardTargets.length ? inwardTargets : rotatedTargets;
  const target = candidates.reduce((best, candidate) =>
    Math.abs(candidate.y - arrayMicTarget.y) > Math.abs(best.y - arrayMicTarget.y) ? candidate : best
  );
  return clampOriginalMeetingSideWallSpeakerTarget(profile, target);
};

const rotateOriginalMeetingTargetAroundSpeaker = (speaker: Point, vector: Point, degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: speaker.x + vector.x * cos - vector.y * sin,
    y: speaker.y + vector.x * sin + vector.y * cos
  };
};

const clampOriginalMeetingSideWallSpeakerTarget = (profile: ClassroomProfile, target: Point) => ({
  x: oneDecimal(clamp(target.x, 0.45, profile.roomGeometry.width - 0.45)),
  y: oneDecimal(clamp(target.y, 0.45, profile.roomGeometry.length - 0.45))
});

const getOriginalMeetingSideWallSpeakerHorizontalAngleFromTarget = (profile: ClassroomProfile, position: Point, target: Point) => {
  const direction = position.x <= profile.roomGeometry.width / 2 ? 1 : -1;
  const angle = (Math.atan2(Math.abs(target.x - position.x), Math.max(0.8, Math.abs(target.y - position.y))) * 180) / Math.PI;
  return Math.round(direction * angle);
};

const getOriginalWallSpeakerTargetCandidates = (profile: ClassroomProfile, position: Point, coverageLength: number) => {
  const maxY = Math.max(position.y + 0.8, profile.roomGeometry.length - WALL_COLUMN_MIN_BACK_WALL_DISTANCE_M);
  const mountingAngle = getOriginalSideWallSpeakerMountingAngle(profile, position);
  return [ORIGINAL_WALL_SPEAKER_DEFAULT_TARGET_BEHIND_M, 5, 6, Math.max(coverageLength, 7)].map((behind) => {
    const y = oneDecimal(clamp(position.y + behind, position.y + 0.8, maxY));
    const forwardDistance = Math.max(0.8, y - position.y);
    const target = getOriginalSideWallSpeakerTarget(profile, position, mountingAngle, forwardDistance);
    return { x: oneDecimal(target.x), y };
  });
};

const getOriginalSideWallSpeakerMountingAngle = (profile: ClassroomProfile, position: Point) => {
  const { width } = profile.roomGeometry;
  const leftAngle =
    width <= 6
      ? 139 + ((6 - clamp(width, 0, 6)) / 6) * 5
      : width <= 8
        ? 139 + ((width - 6) / 2) * -9
        : width <= 12
          ? 130 + ((width - 8) / 4) * -15
          : 115;
  return clamp(position.x <= width / 2 ? leftAngle : 180 - leftAngle, WALL_SPEAKER_MIN_MOUNTING_ANGLE_DEG, WALL_SPEAKER_MAX_MOUNTING_ANGLE_DEG);
};

const getOriginalSideWallSpeakerTarget = (
  profile: ClassroomProfile,
  position: Point,
  mountingAngle: number,
  forwardDistance: number
) => {
  const isLeft = position.x <= profile.roomGeometry.width / 2;
  const swingAngle = isLeft ? mountingAngle - 90 : 90 - mountingAngle;
  const inwardOffset = forwardDistance / Math.tan((Math.max(1, Math.abs(swingAngle)) * Math.PI) / 180);
  return {
    x: clamp(position.x + (isLeft ? inwardOffset : -inwardOffset), 0.45, profile.roomGeometry.width - 0.45),
    y: position.y + forwardDistance
  };
};

const doesOriginalWallSpeakerConeCoverArrayMic = (
  speaker: Point,
  target: Point,
  coverageLength: number,
  arrayMics: GeneratedPoint[]
) => {
  const axis = { x: target.x - speaker.x, y: target.y - speaker.y };
  const axisLength = Math.hypot(axis.x, axis.y);
  if (axisLength <= 0) return false;
  return arrayMics.some((mic) => {
    const vector = { x: mic.position.x - speaker.x, y: mic.position.y - speaker.y };
    const distance = Math.hypot(vector.x, vector.y);
    if (distance <= 0 || distance > coverageLength) return false;
    const dot = (vector.x * axis.x + vector.y * axis.y) / (distance * axisLength);
    const micAngle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
    return micAngle <= WALL_SPEAKER_COVERAGE_HALF_ANGLE_DEG - WALL_SPEAKER_MIC_EDGE_TOLERANCE_DEG;
  });
};

const isOriginalWallSpeakerConeBehindArrayMicRows = (
  profile: ClassroomProfile,
  speaker: Point,
  target: Point,
  arrayMics: GeneratedPoint[]
) => {
  if (!arrayMics.some((mic) => mic.position.y <= speaker.y + 0.05)) return true;
  return (
    Math.abs(getOriginalWallSpeakerHorizontalAngleFromTarget(profile, speaker, target)) <=
    ORIGINAL_WALL_SPEAKER_MAX_SAFE_HORIZONTAL_ANGLE_DEG
  );
};

const getPerpendicularWallSpeakerTarget = (profile: ClassroomProfile, position: Point, coverageLength: number) => {
  const distance = Math.max(0.8, coverageLength);
  const side = getWallSpeakerRoomSide(profile, position);
  if (side === "left") return { x: oneDecimal(position.x + distance), y: position.y };
  if (side === "right") return { x: oneDecimal(position.x - distance), y: position.y };
  if (side === "front") return { x: position.x, y: oneDecimal(position.y + distance) };
  return { x: position.x, y: oneDecimal(position.y - distance) };
};

const getOriginalFrontWallSpeakerHorizontalAngle = (profile: ClassroomProfile, position: Point) => {
  const targetX = profile.roomGeometry.width / 2;
  const targetY = Math.min(profile.roomGeometry.length - WALL_COLUMN_MIN_BACK_WALL_DISTANCE_M, WALL_SPEAKER_COVERAGE_AXIS_M);
  const angle = (Math.atan2(Math.abs(targetX - position.x), Math.max(1, targetY - position.y)) * 180) / Math.PI;
  const outwardOffset = getFrontBackWallSpeakerOutwardOffset(profile);
  return Math.round(
    position.x <= profile.roomGeometry.width / 2
      ? angle - outwardOffset
      : -angle + outwardOffset
  );
};

const getOriginalBackWallSpeakerTarget = (profile: ClassroomProfile, position: Point, primaryArrayMicY: number) => {
  const distanceToArrayMic = Math.max(0.8, position.y - primaryArrayMicY);
  const outwardAngle = getFrontBackWallSpeakerOutwardOffset(profile);
  const outwardOffset = Math.tan((outwardAngle * Math.PI) / 180) * distanceToArrayMic;
  const isLeft = position.x <= profile.roomGeometry.width / 2;
  return {
    x: oneDecimal(clamp(profile.roomGeometry.width / 2 + (isLeft ? -outwardOffset : outwardOffset), 0.3, profile.roomGeometry.width - 0.3)),
    y: oneDecimal(primaryArrayMicY)
  };
};

const getFrontBackWallSpeakerOutwardOffset = (profile: ClassroomProfile) => {
  if (
    !isClassroomScenario(profile.scenario) ||
    getEffectiveAmplificationScope(profile) !== "podium" ||
    profile.roomGeometry.length > FRONT_BACK_WALL_SPEAKER_MAX_ROOM_LENGTH_M
  ) {
    return ORIGINAL_FRONT_WALL_SPEAKER_OUTWARD_OFFSET_DEG;
  }
  const maxWallWidth = getAutomaticWallSpeakerMaxWidth(profile);
  if (!maxWallWidth || maxWallWidth <= CLASSROOM_FRONT_BACK_WALL_SPEAKER_BASE_WIDTH_M) {
    return ORIGINAL_FRONT_WALL_SPEAKER_OUTWARD_OFFSET_DEG;
  }
  const widthProgress = clamp(
    (profile.roomGeometry.width - CLASSROOM_FRONT_BACK_WALL_SPEAKER_BASE_WIDTH_M) /
      (maxWallWidth - CLASSROOM_FRONT_BACK_WALL_SPEAKER_BASE_WIDTH_M),
    0,
    1
  );
  return (
    ORIGINAL_FRONT_WALL_SPEAKER_OUTWARD_OFFSET_DEG +
    (CLASSROOM_FRONT_BACK_WALL_SPEAKER_MAX_OUTWARD_OFFSET_DEG - ORIGINAL_FRONT_WALL_SPEAKER_OUTWARD_OFFSET_DEG) * widthProgress
  );
};

const getAutomaticWallSpeakerMaxWidth = (profile: ClassroomProfile) => {
  let lastWallWidth: number | undefined;
  for (let step = 0; step <= 140; step += 1) {
    const width = oneDecimal(CLASSROOM_FRONT_BACK_WALL_SPEAKER_BASE_WIDTH_M + step * 0.1);
    const candidate: ClassroomProfile = {
      ...profile,
      roomGeometry: { ...profile.roomGeometry, width },
      engineeringConstraints: { ...profile.engineeringConstraints, speakerProductOverride: "auto" }
    };
    if (getSpeakerProductId(candidate) !== "COLUMN-SPEAKER") return lastWallWidth;
    lastWallWidth = width;
  }
  return undefined;
};

const getOriginalWallSpeakerHorizontalAngleFromTarget = (profile: ClassroomProfile, position: Point, target: Point) => {
  const direction = position.x <= profile.roomGeometry.width / 2 ? 1 : -1;
  const angle = (Math.atan2(Math.abs(target.x - position.x), Math.max(0.8, target.y - position.y)) * 180) / Math.PI;
  return Math.round(direction * angle);
};

export const getDefaultSpeakerCount = (profile: ClassroomProfile, usesWallSpeaker: boolean) => {
  return Math.min(RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER, getRequiredSpeakerCount(profile, usesWallSpeaker));
};

export const getRequiredSpeakerCount = (profile: ClassroomProfile, usesWallSpeaker: boolean) => {
  const { length, width } = profile.roomGeometry;
  if (length <= 0 || width <= 0) return 0;

  if (!usesWallSpeaker) {
    const columns = getCeilingSpeakerColumnCount(profile);
    const firstRowReduction = getClassroomFirstCeilingSpeakerRowReduction(profile, columns);
    return getCeilingSpeakerRowCount(profile) * columns - firstRowReduction;
  }
  if (shouldUseMeetingStyleFullRoomWallSpeakerRules(profile)) return getFullRoomWallSpeakerCountByRoomSpan(profile);
  if (profile.scenario === "auditorium") return getRearFillRowCountByPrimaryMicRearDepth(profile) * 2;
  if (shouldReserveTeacherMonitorSpeakerRow(profile)) return getPodiumSpeakerCountByPrimaryMicRearDepth(profile);
  return length > 11 ? 6 : 4;
};

const getFullRoomWallSpeakerCountByRoomSpan = (profile: ClassroomProfile) => {
  const { length, width } = profile.roomGeometry;
  if (length <= 0 || width <= 0) return 0;
  return Math.min(RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER, 4 + getFullRoomWallSpeakerCenterFillPairCount(profile) * 2);
};

const getMeetingWallSpeakerLongSpan = (profile: ClassroomProfile) => {
  const { length, width } = profile.roomGeometry;
  if (Math.abs(length - width) <= 0.05) return Math.max(length, width);
  return Math.max(length, width);
};

export const getMeetingWallSpeakerCenterFillPairCount = (profile: ClassroomProfile) => {
  if (!isMeetingScenario(profile.scenario)) return 0;
  return getFullRoomWallSpeakerCenterFillPairCount(profile);
};

const getFullRoomWallSpeakerCenterFillPairCount = (profile: ClassroomProfile) => {
  const longSpan = getMeetingWallSpeakerLongSpan(profile);
  if (longSpan <= MEETING_WALL_SPEAKER_CENTER_FILL_FIRST_THRESHOLD_M) return 0;
  if (longSpan >= MEETING_WALL_SPEAKER_CENTER_FILL_SECOND_THRESHOLD_M) return 2;
  return 1;
};

const getCeilingSpeakerRowCount = (profile: ClassroomProfile) => {
  const { length } = profile.roomGeometry;
  if (shouldUseMeetingStyleCeilingSpeakerRules(profile)) return getMeetingCeilingSpeakerGrid(profile).rows;
  if (length <= 4) return 1;
  return Math.min(CEILING_SPEAKER_MAX_ROW_COUNT, Math.max(1, getCeilingSpeakerAxisCount(length)));
};

const getCeilingSpeakerColumnCount = (profile: ClassroomProfile) => {
  const { width } = profile.roomGeometry;
  if (width <= 0) return 0;
  if (shouldUseMeetingStyleCeilingSpeakerRules(profile)) return getMeetingCeilingSpeakerColumnCount(profile);
  return getCeilingSpeakerHorizontalColumnCount(width);
};

const getMeetingCeilingSpeakerColumnCount = (profile: ClassroomProfile) => {
  return getMeetingCeilingSpeakerGrid(profile).columns;
};

const getMeetingCeilingSpeakerGrid = (profile: ClassroomProfile) => {
  const { length, width } = profile.roomGeometry;
  let rows = Math.min(CEILING_SPEAKER_MAX_ROW_COUNT, getCeilingSpeakerAxisCount(length));
  let columns = getCeilingSpeakerHorizontalColumnCount(width);
  let changed = true;

  while (changed) {
    changed = false;
    if (length > 4 && rows < CEILING_SPEAKER_MAX_ROW_COUNT && hasMeetingCeilingSpeakerCoverageGap(profile, rows, columns, "y")) {
      rows += 1;
      changed = true;
    }

  }

  return { rows, columns };
};

const getCeilingSpeakerAxisCount = (span: number) => {
  if (span <= 0) return 0;
  if (span <= CEILING_SPEAKER_COVERAGE_RADIUS_M * 2) return 1;
  return Math.max(2, Math.ceil((span - CEILING_SPEAKER_COVERAGE_RADIUS_M * 2) / CEILING_SPEAKER_MAX_SPACING_M) + 1);
};

const getCeilingSpeakerHorizontalColumnCount = (width: number) => {
  if (width <= 0) return 0;
  const layoutWidth = Math.max(0, width - CEILING_SPEAKER_SIDE_INSTALL_INSET_M * 2);
  return Math.max(1, Math.ceil(layoutWidth / CEILING_SPEAKER_MAX_SPACING_M));
};

const hasMeetingCeilingSpeakerCoverageGap = (profile: ClassroomProfile, rows: number, columns: number, axis: "x" | "y") => {
  const speakers = getMeetingCeilingSpeakerGridCandidatePositions(profile, rows, columns);
  if (!speakers.length) return false;

  const arrayMics = getMeetingArrayMicReferencePoints(profile);
  const groupedByCrossAxis = speakers.reduce((groups, speaker) => {
    const key = oneDecimal(axis === "y" ? speaker.x : speaker.y);
    const group = groups.get(key) ?? [];
    group.push(speaker);
    groups.set(key, group);
    return groups;
  }, new Map<number, Array<{ x: number; y: number }>>());
  const span = axis === "y" ? profile.roomGeometry.length : profile.roomGeometry.width;
  const coverageStart = 0;
  const coverageEnd = span;

  return Array.from(groupedByCrossAxis.values()).some((lineSpeakers) => {
    const sorted = lineSpeakers
      .map((speaker) => ({
        position: axis === "y" ? speaker.y : speaker.x,
        radius: getCeilingSpeakerCoverageRadius(profile, speaker, speakers, arrayMics)
      }))
      .sort((a, b) => a.position - b.position);
    if (!sorted.length) return false;

    const first = sorted[0];
    if (first.position - first.radius > coverageStart) return true;
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.position - previous.position > previous.radius + current.radius) return true;
    }
    const last = sorted[sorted.length - 1];
    return last.position + last.radius < coverageEnd;
  });
};

const getMeetingCeilingSpeakerGridCandidatePositions = (profile: ClassroomProfile, rows: number, columns: number) => {
  const { length, width } = profile.roomGeometry;
  return Array.from({ length: Math.max(0, rows * columns) }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index - row * columns;
    return {
      x: width * getMeetingCeilingSpeakerXRatio(profile, column, columns),
      y: length * getMeetingCeilingSpeakerYRatio(profile, row, rows)
    };
  });
};

const getMeetingArrayMicReferencePoints = (profile: ClassroomProfile): GeneratedPoint[] => {
  const teacherY = getPrimaryArrayMicY(profile);
  const targetArrayMicCount = getDefaultArrayMicCount(profile, teacherY);
  return getArrayMicPositions(profile, teacherY, targetArrayMicCount).map((position, index) => ({
    id: `array-mic-reference-${index + 1}`,
    type: "arrayMic",
    label: "",
    position: { x: position.x, y: position.y },
    reason: ""
  }));
};

const getPodiumSpeakerCountByPrimaryMicRearDepth = (profile: ClassroomProfile) => {
  const rearFillRowCount = getRearFillRowCountByPrimaryMicRearDepth(profile);
  return (rearFillRowCount + 1) * 2;
};

const getRearFillRowCountByPrimaryMicRearDepth = (profile: ClassroomProfile) => {
  const primaryMicY = getPrimaryArrayMicY(profile);
  const rearDepth = profile.roomGeometry.length - primaryMicY;
  let rowCount =
    rearDepth <= 8
      ? 1
      : rearDepth <= 13
        ? 2
        : rearDepth <= 18
          ? 3
          : rearDepth <= 23
            ? 4
            : rearDepth <= 28
              ? 5
              : rearDepth <= 33
                ? 6
                : WALL_SPEAKER_MAX_REAR_FILL_ROWS;
  rowCount = Math.min(rowCount, WALL_SPEAKER_MAX_REAR_FILL_ROWS);
  let firstY = getPreferredFirstSideWallSpeakerYForRows(profile, primaryMicY, rowCount);
  while (rowCount > 1 && getMinSameSideWallSpeakerSpacing(profile.roomGeometry.length, rowCount, firstY, primaryMicY) < WALL_SPEAKER_MIN_SAME_SIDE_SPACING_M) {
    rowCount -= 1;
    firstY = getPreferredFirstSideWallSpeakerYForRows(profile, primaryMicY, rowCount);
  }
  return rowCount;
};

const getMinSameSideWallSpeakerSpacing = (depth: number, rowCount: number, firstY: number, primaryMicY?: number) => {
  const yValues = getSideWallSpeakerYValues(depth, rowCount, firstY, primaryMicY);
  if (yValues.length <= 1) return Number.POSITIVE_INFINITY;
  return yValues.slice(1).reduce((min, y, index) => Math.min(min, y - yValues[index]), Number.POSITIVE_INFINITY);
};

const getCeilingSpeakerPositionAwayFromMics = (
  profile: ClassroomProfile,
  target: { xRatio: number; yRatio: number },
  _arrayMics: GeneratedPoint[]
) => {
  const { length: depth, width: roomWidth } = profile.roomGeometry;
  const bounds = getCeilingSpeakerWallBounds(profile);
  return {
    x: clamp(roomWidth * target.xRatio, bounds.minX, bounds.maxX),
    y: clamp(depth * target.yRatio, bounds.minY, bounds.maxY)
  };
};

const getCeilingSpeakerWallBounds = (profile: ClassroomProfile) => {
  const { width, length } = profile.roomGeometry;
  const minX = Math.min(CEILING_SPEAKER_SIDE_INSTALL_INSET_M, Math.max(0.3, width / 2));
  const maxX = Math.max(minX, width - minX);
  const minY = Math.min(MIN_CEILING_SPEAKER_TO_FRONT_WALL_DISTANCE, Math.max(0.3, length / 2));
  const maxY = Math.max(minY, length - Math.min(MIN_CEILING_SPEAKER_TO_BACK_WALL_DISTANCE, Math.max(0.3, length / 2)));
  return { minX, maxX, minY, maxY };
};

const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const getTeacherArrayMicX = (profile: ClassroomProfile) => {
  const { width } = profile.roomGeometry;
  if (profile.scenario === "auditorium") return oneDecimal(width / 2);
  if (profile.scenario === "combinedClassroom") return oneDecimal(width / 2);
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  if (podiumPosition === "frontLeft") return oneDecimal(clamp(width * 0.38, width * 0.32, width * 0.48));
  if (podiumPosition === "frontRight") return oneDecimal(clamp(width * 0.62, width * 0.52, width * 0.68));
  if (podiumPosition === "frontCenter") return oneDecimal(width / 2);

  const text = `${profile.engineeringConstraints.notes} ${profile.existingDevices.computer}`.toLowerCase();
  const offset =
    /左侧|左边|靠左|左前|左讲台|讲台.*左/.test(text) ? -width * 0.12 : /右侧|右边|靠右|右前|右讲台|讲台.*右/.test(text) ? width * 0.12 : 0;
  return oneDecimal(clamp(width / 2 + offset, width * 0.38, width * 0.62));
};

const getPrimaryArrayMicY = (profile: ClassroomProfile) => {
  const { length } = profile.roomGeometry;
  if (isMeetingScenario(profile.scenario)) return clamp(length * 0.5, 1.4, length - 1.2);
  if ((isClassroomScenario(profile.scenario) || profile.scenario === "auditorium") && profile.amplificationScope === "podium") {
    const teacherActivityY = clamp(2.4, 1.6, length - 1.8);
    return oneDecimal(clamp(teacherActivityY + ARRAY_MIC_SPEAKER_FORWARD_OFFSET_M, 2.2, length - 1.2));
  }
  if (isClassroomScenario(profile.scenario) || profile.scenario === "auditorium") {
    const teacherActivityY = clamp(2.4, 1.6, length - 1.8);
    return oneDecimal(clamp(teacherActivityY + ARRAY_MIC_SPEAKER_FORWARD_OFFSET_M, 1.6, length - 1.2));
  }
  return clamp(length * 0.42, 1.6, length - 1.2);
};

export const getArrayMicInstallHeight = (profile: ClassroomProfile) => {
  const { height } = profile.roomGeometry;
  const risk = getReverberationRisk(profile);
  if (profile.engineeringConstraints.ceiling === "suspended") {
    return getCeilingFlushInstallHeight(profile);
  }

  if (profile.scenario === "auditorium") {
    return oneDecimal(clamp(3.3, 2.6, Math.min(3.3, height - 0.3)));
  }

  const preferred = risk === "high" ? 2.6 : risk === "medium" ? 2.9 : 3.2;
  return oneDecimal(clamp(preferred, 2.6, Math.min(3.3, height - 0.3)));
};

const getCeilingSpeakerInstallHeight = (profile: ClassroomProfile) => {
  if (hasSuspendedCeiling(profile)) return getCeilingFlushInstallHeight(profile);
  return Math.min(2.6, profile.roomGeometry.height - 0.25);
};

const getCeilingFlushInstallHeight = (profile: ClassroomProfile) => oneDecimal(profile.roomGeometry.height);

const hasSuspendedCeiling = (profile: ClassroomProfile) => profile.engineeringConstraints.ceiling === "suspended";

export const getArrayMicEffectiveAmplificationRadius = (_profile: ClassroomProfile) => ARRAY_MIC_IDEAL_AMPLIFICATION_RADIUS_M;

export const getArrayMicInstallLabel = (profile: ClassroomProfile) => {
  const height = getArrayMicInstallHeight(profile).toFixed(1);
  if (hasSuspendedCeiling(profile)) return `嵌入吊顶 ${height}m`;
  return `吊挂支架 ${height}m`;
};

export const getArrayMicInstallAdvice = (profile: ClassroomProfile) => {
  const risk = getReverberationRisk(profile);
  if (hasSuspendedCeiling(profile)) {
    return "吊顶高度会影响阵麦和吸顶音箱安装高度。";
  }
  return `无吊顶时采用吊挂支架安装；扩声模式下推荐高度 2.6-3.3m，当前按${risk === "high" ? "混响较大" : risk === "medium" ? "混响中等" : "混响较小"}取 ${getArrayMicInstallHeight(profile).toFixed(1)}m，混响越大越应适当降低，增强人声直达声。`;
};

const getUnifiedWallSpeakerInstallHeight = (profile: ClassroomProfile, maxCoverageLength: number) => {
  const ratio = clamp(
    (maxCoverageLength - WALL_SPEAKER_MIN_HEIGHT_COVERAGE_M) / (WALL_SPEAKER_MAX_HEIGHT_COVERAGE_M - WALL_SPEAKER_MIN_HEIGHT_COVERAGE_M),
    0,
    1
  );
  const height = WALL_SPEAKER_MIN_INSTALL_HEIGHT_M + ratio * (WALL_SPEAKER_MAX_INSTALL_HEIGHT_M - WALL_SPEAKER_MIN_INSTALL_HEIGHT_M);
  return oneDecimal(clamp(height, WALL_SPEAKER_MIN_INSTALL_HEIGHT_M, Math.min(WALL_SPEAKER_MAX_INSTALL_HEIGHT_M, profile.roomGeometry.height - 0.25)));
};

const getLectureClassroomStepHeightAtY = (profile: ClassroomProfile, y: number, primaryMicY: number) => {
  if (profile.scenario !== "lectureClassroom") return 0;
  const audienceStartY = primaryMicY + LECTURE_CLASSROOM_AUDIENCE_START_BEHIND_MIC_M;
  const completeStepCount = Math.floor(Math.max(0, y - audienceStartY));
  return oneDecimal(completeStepCount * LECTURE_CLASSROOM_STEP_RISE_PER_M);
};

const getWallSpeakerDownTilt = (
  profile: ClassroomProfile,
  baseInstallHeight: number,
  speakerPosition: { x: number; y: number },
  target: { x: number; y: number },
  primaryMicY: number
) => {
  const listenerEarHeight = 1.2;
  const speakerStepHeight = getLectureClassroomStepHeightAtY(profile, speakerPosition.y, primaryMicY);
  const targetStepHeight = getLectureClassroomStepHeightAtY(profile, target.y, primaryMicY);
  const heightDifference = baseInstallHeight + speakerStepHeight - (listenerEarHeight + targetStepHeight);
  const targetDistance = getDistance(speakerPosition, target);
  const angle = (Math.atan2(Math.max(0, heightDifference), Math.max(1, targetDistance)) * 180) / Math.PI;
  return Math.round(clamp(angle, 8, 32));
};

export const toCanvasPoint = (point: { x: number; y: number }, profile: ClassroomProfile, width = 640, height = 430) => {
  const layout = getCanvasRoomLayout(profile, width, height);
  return {
    x: layout.x + (point.x / profile.roomGeometry.width) * layout.width,
    y: layout.y + (point.y / profile.roomGeometry.length) * layout.height
  };
};

export const getCanvasRoomLayout = (profile: ClassroomProfile, width = 640, height = 430) => {
  const marginX = width >= 900 ? 176 : width >= 720 ? 132 : 54;
  const marginTop = 78;
  const marginBottom = 82;
  const maxWidth = width - marginX * 2;
  const maxHeight = height - marginTop - marginBottom;
  const roomWidth = Math.max(profile.roomGeometry.width, 0.1);
  const roomDepth = Math.max(profile.roomGeometry.length, 0.1);
  const meterPx = Math.min(maxWidth / roomWidth, maxHeight / roomDepth);
  const drawWidth = roomWidth * meterPx;
  const drawHeight = roomDepth * meterPx;
  return {
    x: (width - drawWidth) / 2,
    y: marginTop + (maxHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
    meterPx
  };
};
