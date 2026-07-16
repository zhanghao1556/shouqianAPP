import type { ClassroomProfile, GeneratedPoint } from "../types";
import { getAppBrand, type AppBrandId } from "../brand";
import { needsAuditoriumRearFillSpeakers } from "./auditoriumRules";
import { isClassroomScenario, isMeetingScenario } from "./scenarioRules";

export const DT_SPK_OUTPUT_COUNT = 4;
export const SPEAKERS_PER_SPK_OUTPUT = 2;
export const MAX_SPEAKERS_PER_DT = DT_SPK_OUTPUT_COUNT * SPEAKERS_PER_SPK_OUTPUT;
export const EXTERNAL_AMPLIFIER_PRODUCT_ID = "YY-POWER-AMP";
export const EXTERNAL_AMPLIFIER_CHANNEL_COUNT = 4;
export const SPEAKERS_PER_EXTERNAL_AMPLIFIER_CHANNEL = 2;
export const EXTERNAL_AMPLIFIER_SPEAKER_CAPACITY = EXTERNAL_AMPLIFIER_CHANNEL_COUNT * SPEAKERS_PER_EXTERNAL_AMPLIFIER_CHANNEL;
export const EXTERNAL_AMPLIFIER_CHANNELS_PER_LINE_OUT = 2;
export const EXTERNAL_AMPLIFIER_MAX_LINE_OUT_COUNT = Math.ceil(
  EXTERNAL_AMPLIFIER_CHANNEL_COUNT / EXTERNAL_AMPLIFIER_CHANNELS_PER_LINE_OUT
);
export const RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER = MAX_SPEAKERS_PER_DT + EXTERNAL_AMPLIFIER_SPEAKER_CAPACITY;

export type SpeakerProductId = "CEILING-SPEAKER" | "COLUMN-SPEAKER";
export type SpeakerSelectionResult = SpeakerProductId | "BOTH_ACCEPTABLE" | "NO_NEW_SPEAKER";

export const WALL_SPEAKER_COVERAGE_LIMIT_M = 5;
export const WALL_SPEAKER_MAX_ROOM_WIDTH_M = WALL_SPEAKER_COVERAGE_LIMIT_M * 2;
export const CEILING_SPEAKER_WIDE_ROOM_WIDTH_M = 10;
export const EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M = 12;
export const CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M = 2;
const LECTURE_CLASSROOM_SUSPENDED_CEILING_SWITCH_WIDTH_M = 12;
const LECTURE_CLASSROOM_HIGH_CEILING_OR_EXPOSED_SWITCH_WIDTH_M = 14;

export const hasHighCeilingReverberationRisk = (profile: ClassroomProfile) =>
  profile.scenario !== "auditorium" && profile.engineeringConstraints.ceiling === "suspended" && profile.roomGeometry.height >= 4;

export const getSpeakerSelectionResult = (
  profile: ClassroomProfile,
  brandId: AppBrandId = getAppBrand().id
): SpeakerSelectionResult => {
  if (shouldUseAuditoriumLegacySystemOnly(profile)) return "NO_NEW_SPEAKER";
  const override = profile.engineeringConstraints.speakerProductOverride ?? "auto";
  if (override === "ceiling") return "CEILING-SPEAKER";
  if (override === "wall") return "COLUMN-SPEAKER";
  if (brandId === "yinman") return "COLUMN-SPEAKER";
  return getAutomaticSpeakerSelectionResult(profile);
};

const getAutomaticSpeakerSelectionResult = (profile: ClassroomProfile): SpeakerSelectionResult => {
  const { length, width } = profile.roomGeometry;
  if (length <= 0 || width <= 0) return "CEILING-SPEAKER";
  if (needsAuditoriumRearFillSpeakers(profile)) return "COLUMN-SPEAKER";
  if (profile.engineeringConstraints.overheadSpeakerMounting === "unavailable") return "COLUMN-SPEAKER";
  if (shouldUseLectureClassroomCeilingSpeaker(profile)) return "CEILING-SPEAKER";
  if (
    profile.engineeringConstraints.overheadSpeakerMounting === "available" &&
    (profile.scenario === "standardClassroom" || profile.scenario === "combinedClassroom") &&
    profile.amplificationScope === "full"
  ) {
    return "CEILING-SPEAKER";
  }
  if (hasHighCeilingReverberationRisk(profile)) return "COLUMN-SPEAKER";
  if (profile.engineeringConstraints.ceiling === "unknown") return "COLUMN-SPEAKER";
  if (isMeetingScenario(profile.scenario) && profile.engineeringConstraints.ceiling !== "suspended") return "COLUMN-SPEAKER";
  if (isMeetingScenario(profile.scenario) && profile.engineeringConstraints.ceiling === "suspended" && Math.max(length, width) >= 12) return "CEILING-SPEAKER";
  if (isMeetingScenario(profile.scenario)) return "COLUMN-SPEAKER";
  if (profile.engineeringConstraints.ceiling === "exposed" && width <= EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M) return "COLUMN-SPEAKER";
  if (isClassroomScenario(profile.scenario) && profile.scenario !== "lectureClassroom" && profile.amplificationScope === "full" && profile.engineeringConstraints.ceiling === "suspended") return "CEILING-SPEAKER";
  if (profile.scenario === "combinedClassroom" && profile.amplificationScope === "podium" && profile.engineeringConstraints.ceiling === "suspended" && width >= 10) {
    return "BOTH_ACCEPTABLE";
  }
  if (profile.scenario !== "lectureClassroom" && width > length && width > CEILING_SPEAKER_WIDE_ROOM_WIDTH_M) return "CEILING-SPEAKER";
  if (profile.scenario !== "lectureClassroom" && profile.engineeringConstraints.ceiling === "exposed" && width > EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M) return "CEILING-SPEAKER";
  return "COLUMN-SPEAKER";
};

export const getSpeakerProductId = (
  profile: ClassroomProfile,
  brandId: AppBrandId = getAppBrand().id
): SpeakerProductId => {
  const result = getSpeakerSelectionResult(profile, brandId);
  return result === "CEILING-SPEAKER" || result === "BOTH_ACCEPTABLE" ? "CEILING-SPEAKER" : "COLUMN-SPEAKER";
};

export const getSpeakerModelName = (profile: ClassroomProfile, brandId: AppBrandId = getAppBrand().id) =>
  getSpeakerSelectionResult(profile, brandId) === "NO_NEW_SPEAKER"
    ? "利旧原音频系统"
    : getSpeakerSelectionResult(profile, brandId) === "BOTH_ACCEPTABLE"
      ? "吸顶音箱或壁挂音箱"
      : getSpeakerProductId(profile, brandId) === "CEILING-SPEAKER"
        ? "吸顶音箱"
        : "壁挂音箱";

export const getSpeakerSelectionReason = (profile: ClassroomProfile, brandId: AppBrandId = getAppBrand().id) => {
  const { length, width } = profile.roomGeometry;
  const modelName = getSpeakerModelName(profile, brandId);
  const override = profile.engineeringConstraints.speakerProductOverride ?? "auto";
  if (length <= 0 || width <= 0) return `房间尺寸待补充，暂按 ${modelName} 作为默认扩声形态。`;
  if (shouldUseAuditoriumLegacySystemOnly(profile)) {
    return "报告厅已确认有后排补声 / 辅助音箱，默认使用利旧原音频系统，不新增吸顶音箱或壁挂音柱。";
  }
  if (override === "ceiling") {
    return `客户已选择吸顶音箱方案，系统按 ${modelName} 输出；需复核吊顶、开孔、层高、检修口、灯具空调避让和后期维护条件。`;
  }
  if (override === "wall") {
    return `客户已选择壁挂音箱方案，系统按 ${modelName} 输出；需复核墙面承重、走线路径、门窗遮挡、投影幕布、覆盖均匀性和啸叫风险。`;
  }
  if (needsAuditoriumRearFillSpeakers(profile)) {
    return `报告厅默认利旧原音频系统；当原系统缺少后排补声或辅助音箱时，仅新增 ${modelName} 用于后排补声，不做舞台区域和前场监听。`;
  }
  if (brandId === "yinman") {
    return "音曼自动方案默认采用壁挂音箱；如需吸顶方案可手动选择并复核供货与安装条件。";
  }
  if (profile.scenario === "lectureClassroom") {
    if (shouldUseLectureClassroomCeilingSpeaker(profile)) {
      if (profile.engineeringConstraints.ceiling === "suspended" && profile.roomGeometry.height < 4) {
        return `阶梯教室仅按讲台区域扩声；现场有吊顶且宽度大于 ${LECTURE_CLASSROOM_SUSPENDED_CEILING_SWITCH_WIDTH_M}m，自动推荐 ${modelName}。`;
      }
      return `阶梯教室仅按讲台区域扩声；当前宽度达到 ${LECTURE_CLASSROOM_HIGH_CEILING_OR_EXPOSED_SWITCH_WIDTH_M}m，自动推荐 ${modelName}。`;
    }
    return `阶梯教室仅按讲台区域扩声；当前宽度未达到吸顶切换条件，自动推荐 ${modelName}。`;
  }
  if (hasHighCeilingReverberationRisk(profile)) {
    return `吊顶高度大于等于 4m，扩声清晰度风险增加，自动推荐 ${modelName}。`;
  }
  if (profile.engineeringConstraints.ceiling === "unknown") {
    return `吊顶条件未知，先按无吊顶风险处理，优先推荐 ${modelName}；复勘确认有吊顶后可再评估吸顶方案。`;
  }
  if (isMeetingScenario(profile.scenario) && profile.engineeringConstraints.ceiling !== "suspended") {
    return `会议室现场无吊顶或吊顶条件不明确，优先推荐 ${modelName}；确认有吊顶后再评估吸顶方案。`;
  }
  if (isMeetingScenario(profile.scenario) && profile.engineeringConstraints.ceiling === "suspended" && Math.max(length, width) >= 12) {
    return `会议室长宽任一边达到 12m 及以上，优先推荐 ${modelName} 以提升大空间覆盖均匀度。`;
  }
  if (isMeetingScenario(profile.scenario)) {
    return `会议室长宽均小于 12m，吸顶和壁挂都可；当前默认推荐 ${modelName}，壁挂点位优先前后墙布置。`;
  }
  if (profile.engineeringConstraints.ceiling === "exposed" && width <= EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M) {
    return `现场为裸顶或局部裸顶，且宽度未超过 ${EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M}m，优先推荐 ${modelName}。`;
  }
  if (profile.engineeringConstraints.ceiling === "exposed" && width > EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M) {
    return `现场为裸顶或局部裸顶，但宽度超过 ${EXPOSED_CEILING_SPEAKER_MIN_WIDTH_M}m，可评估吸顶补声方案，当前推荐 ${modelName}。`;
  }
  if (isClassroomScenario(profile.scenario) && profile.amplificationScope === "full" && profile.engineeringConstraints.ceiling === "suspended") {
    return `教室全场扩声场景且现场有吊顶，优先推荐 ${modelName} 以获得更均匀的全场覆盖。`;
  }
  if (profile.scenario === "combinedClassroom" && profile.amplificationScope === "podium" && profile.engineeringConstraints.ceiling === "suspended" && width >= 10) {
    return `合班教室上课区扩声且现场有吊顶，房间宽度达到 ${width}m，吸顶和壁挂都可进入方案比选；当前工程默认仍按壁挂音柱出点位。`;
  }
  if (width > length && width > CEILING_SPEAKER_WIDE_ROOM_WIDTH_M) {
    return `房间宽 ${width}m 大于长 ${length}m，且宽度超过 ${CEILING_SPEAKER_WIDE_ROOM_WIDTH_M}m，吸顶音箱更利于宽向均匀覆盖，推荐 ${modelName}。`;
  }
  return `未命中“宽大于长且宽度超过 ${CEILING_SPEAKER_WIDE_ROOM_WIDTH_M}m”的吸顶条件，反向优先推荐 ${modelName}。`;
};

const shouldUseAuditoriumLegacySystemOnly = (profile: ClassroomProfile) =>
  profile.scenario === "auditorium" && profile.engineeringConstraints.auditoriumRearFillSpeakers === "present";

const shouldUseLectureClassroomCeilingSpeaker = (profile: ClassroomProfile) => {
  if (profile.scenario !== "lectureClassroom") return false;
  const { width, height } = profile.roomGeometry;
  if (profile.engineeringConstraints.ceiling === "suspended") {
    return height >= 4 ? width >= LECTURE_CLASSROOM_HIGH_CEILING_OR_EXPOSED_SWITCH_WIDTH_M : width > LECTURE_CLASSROOM_SUSPENDED_CEILING_SWITCH_WIDTH_M;
  }
  if (profile.engineeringConstraints.ceiling === "exposed") return width >= LECTURE_CLASSROOM_HIGH_CEILING_OR_EXPOSED_SWITCH_WIDTH_M;
  return false;
};

export const clampSpeakerQuantity = (quantity: number) => Math.min(RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER, Math.max(0, Math.round(quantity)));

export const getExternalSpeakerCount = (quantity: number) => Math.max(0, quantity - MAX_SPEAKERS_PER_DT);

export const getExternalAmplifierCountForSpeakers = (quantity: number) =>
  getExternalSpeakerCount(quantity) > 0 ? 1 : 0;

export const getExternalAmplifierChannelCountForSpeakers = (quantity: number) => {
  const externalSpeakerCount = Math.min(getExternalSpeakerCount(quantity), EXTERNAL_AMPLIFIER_SPEAKER_CAPACITY);
  if (externalSpeakerCount <= 0) return 0;
  if (externalSpeakerCount <= EXTERNAL_AMPLIFIER_CHANNEL_COUNT) return externalSpeakerCount;
  return EXTERNAL_AMPLIFIER_CHANNEL_COUNT;
};

export const getExternalAmplifierLineOutCountForSpeakers = (quantity: number) => {
  const amplifierCount = getExternalAmplifierCountForSpeakers(quantity);
  if (amplifierCount <= 0) return 0;
  const channelCount = getExternalAmplifierChannelCountForSpeakers(quantity);
  return Math.min(EXTERNAL_AMPLIFIER_MAX_LINE_OUT_COUNT * amplifierCount, Math.ceil(channelCount / EXTERNAL_AMPLIFIER_CHANNELS_PER_LINE_OUT));
};

export const hasSpeakerCapacityOverflow = (quantity: number) => getExternalSpeakerCount(quantity) > 0;

export const hasRecommendedSpeakerSystemOverflow = (quantity: number) => quantity > RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER;

export const getUsedSpeakerOutputCount = (quantity: number) => Math.min(quantity, DT_SPK_OUTPUT_COUNT);

export const getSpeakerCapacityText = (speakerName = "音箱") =>
  `阵麦内置 ${DT_SPK_OUTPUT_COUNT} 个 SPK 功放输出口，每个输出口最多并联 ${SPEAKERS_PER_SPK_OUTPUT} 只${speakerName}，内置 SPK 可直接带 ${MAX_SPEAKERS_PER_DT} 只；加 1 台教学模拟功放主机后推荐上限为 ${RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER} 只。扩展功放为四通道功放，扩展音箱小于等于 4 只时一通道一只，大于 4 只时开始并线，单台扩展功放最多扩展 ${EXTERNAL_AMPLIFIER_SPEAKER_CAPACITY} 只，阵麦 1 根 Line Out 音频线默认带 2 个功放通道。`;

export const getExternalAmplifierSummary = (quantity: number) => {
  const externalSpeakerCount = getExternalSpeakerCount(quantity);
  if (externalSpeakerCount <= 0) return "音箱数量未超过阵列麦主机内置 SPK 输出容量，无需外接扩展功放。";
  const amplifierCount = getExternalAmplifierCountForSpeakers(quantity);
  const expandedSpeakerCount = Math.min(externalSpeakerCount, EXTERNAL_AMPLIFIER_SPEAKER_CAPACITY);
  const channelCount = getExternalAmplifierChannelCountForSpeakers(quantity);
  const lineOutCount = getExternalAmplifierLineOutCountForSpeakers(quantity);
  const overflowText = hasRecommendedSpeakerSystemOverflow(quantity)
    ? `超过 ${RECOMMENDED_MAX_SPEAKERS_WITH_EXTERNAL_AMPLIFIER} 只后不自动继续增加功放，需拆区或增加系统。`
    : "";
  return `超过内置 SPK 的 ${externalSpeakerCount} 只音箱中，最多 ${expandedSpeakerCount} 只通过 ${amplifierCount} 台教学模拟功放主机扩展；扩展功放占用 ${channelCount} 个功放通道，预计使用 ${lineOutCount} 根阵麦 Line Out 音频线。${overflowText}`;
};

export const getSpeakerOutputSummary = (quantity: number) => {
  if (quantity <= 0) return "未配置新增音箱。";
  const usedOutputCount = getUsedSpeakerOutputCount(quantity);
  const externalText = hasSpeakerCapacityOverflow(quantity) ? `；${getExternalAmplifierSummary(quantity)}` : "";
  return `共 ${quantity} 只，其中 ${Math.min(quantity, MAX_SPEAKERS_PER_DT)} 只使用阵列麦主机内置 SPK 输出，占用 ${usedOutputCount} / ${DT_SPK_OUTPUT_COUNT} 路 SPK 功放输出；每路最多并联 ${SPEAKERS_PER_SPK_OUTPUT} 只${externalText}。`;
};

export const allocateSpeakerOutputs = (speakerLabels: string[]) => {
  const groups = speakerLabels.slice(0, DT_SPK_OUTPUT_COUNT).map((label) => [label]);
  speakerLabels.slice(DT_SPK_OUTPUT_COUNT, MAX_SPEAKERS_PER_DT).forEach((label, index) => {
    groups[index]?.push(label);
  });
  getExternalAmplifierSpeakerGroups(speakerLabels.slice(MAX_SPEAKERS_PER_DT)).forEach((group) => groups.push(group));
  return groups;
};

export const getSpeakerOutputGroups = (points: GeneratedPoint[]) => {
  const speakers = points.filter((point) => point.type === "speaker").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  if (shouldUseCeilingSpeakerOutputGrouping(speakers)) return mapSpeakerOutputGroups(buildCeilingSpeakerOutputGroups(speakers));
  return getLegacySpeakerOutputGroups(speakers);
};

const shouldUseCeilingSpeakerOutputGrouping = (speakers: GeneratedPoint[]) =>
  speakers.length > 0 && speakers.every((speaker) => speaker.horizontalAngle === undefined && speaker.downTiltAngle === undefined);

const getLegacySpeakerOutputGroups = (speakers: GeneratedPoint[]) => {
  const rows = speakers.reduce<GeneratedPoint[][]>((groups, speaker) => {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].position.y - speaker.position.y) <= 0.35) {
      last.push(speaker);
    } else {
      groups.push([speaker]);
    }
    return groups;
  }, []);

  if (speakers.length <= 4) {
    return rows.flatMap((row) => row.sort((a, b) => a.position.x - b.position.x)).reduce((map, speaker, index) => {
      map.set(speaker.id, `SPK${Math.min(index + 1, DT_SPK_OUTPUT_COUNT)}`);
      return map;
    }, new Map<string, string>());
  }

  let externalChannelIndex = 0;
  return rows.reduce((map, row, rowIndex) => {
    const sortedRow = row.sort((a, b) => a.position.x - b.position.x);
    if (rowIndex < DT_SPK_OUTPUT_COUNT) {
      const groupLabel = `SPK${rowIndex + 1}`;
      sortedRow.forEach((speaker) => map.set(speaker.id, groupLabel));
      return map;
    }
    const amplifierGroups = getExternalAmplifierSpeakerGroups(sortedRow);
    amplifierGroups.forEach((group) => {
      const ampIndex = Math.floor(externalChannelIndex / EXTERNAL_AMPLIFIER_CHANNEL_COUNT) + 1;
      const channelIndex = (externalChannelIndex % EXTERNAL_AMPLIFIER_CHANNEL_COUNT) + 1;
      const groupLabel = `扩展功放${ampIndex} CH${channelIndex}`;
      group.forEach((speaker) => map.set(speaker.id, groupLabel));
      externalChannelIndex += 1;
    });
    return map;
  }, new Map<string, string>());
};

const buildCeilingSpeakerOutputGroups = (speakers: GeneratedPoint[]) => {
  if (speakers.length > MAX_SPEAKERS_PER_DT) {
    return [
      ...buildDtCeilingSpeakerOutputGroups(speakers.slice(0, MAX_SPEAKERS_PER_DT)),
      ...getExternalAmplifierSpeakerGroups(speakers.slice(MAX_SPEAKERS_PER_DT))
    ];
  }
  return buildDtCeilingSpeakerOutputGroups(speakers);
};

const buildDtCeilingSpeakerOutputGroups = (speakers: GeneratedPoint[]) => {
  const rows = getSpeakerRowsByY(speakers);
  const idealGroups = rows.flatMap(getCeilingSpeakerRowOutputGroups);
  const maxGroupCount = DT_SPK_OUTPUT_COUNT;
  if (idealGroups.length <= maxGroupCount) return idealGroups;

  const compactedGroups = mergeSingleSpeakerGroupsByFrontBackOrder(idealGroups, maxGroupCount);
  if (compactedGroups.length <= maxGroupCount) return compactedGroups;

  return chunkSpeakersByOutputCapacity(compactedGroups.flat());
};

const getSpeakerRowsByY = (speakers: GeneratedPoint[]) =>
  speakers.reduce<GeneratedPoint[][]>((groups, speaker) => {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].position.y - speaker.position.y) <= 0.35) {
      last.push(speaker);
    } else {
      groups.push([speaker]);
    }
    return groups;
  }, []);

const getCeilingSpeakerRowOutputGroups = (row: GeneratedPoint[]) => {
  const sortedRow = [...row].sort((a, b) => a.position.x - b.position.x);
  if (sortedRow.length <= SPEAKERS_PER_SPK_OUTPUT) return [sortedRow];

  const groups: GeneratedPoint[][] = [];
  let left = 0;
  let right = sortedRow.length - 1;
  while (left < right) {
    groups.push([sortedRow[left], sortedRow[right]]);
    left += 1;
    right -= 1;
  }
  if (left === right) groups.push([sortedRow[left]]);
  return groups;
};

const mergeSingleSpeakerGroupsByFrontBackOrder = (groups: GeneratedPoint[][], maxGroupCount: number) => {
  const mergesNeeded = groups.length - maxGroupCount;
  if (mergesNeeded <= 0) return groups;

  const singleIndexes = groups.flatMap((group, index) => (group.length === 1 ? [index] : []));
  const mergeStarts = new Map<number, GeneratedPoint[]>();
  const skippedIndexes = new Set<number>();
  let mergeCount = 0;

  for (let index = 0; index + 1 < singleIndexes.length && mergeCount < mergesNeeded; index += 2) {
    const firstIndex = singleIndexes[index];
    const secondIndex = singleIndexes[index + 1];
    mergeStarts.set(firstIndex, [groups[firstIndex][0], groups[secondIndex][0]]);
    skippedIndexes.add(secondIndex);
    mergeCount += 1;
  }

  return groups.flatMap((group, index) => {
    if (skippedIndexes.has(index)) return [];
    return [mergeStarts.get(index) ?? group];
  });
};

const chunkSpeakersByOutputCapacity = (speakers: GeneratedPoint[]) => {
  const groups: GeneratedPoint[][] = [];
  for (let index = 0; index < speakers.length; index += SPEAKERS_PER_SPK_OUTPUT) {
    groups.push(speakers.slice(index, index + SPEAKERS_PER_SPK_OUTPUT));
  }
  return groups;
};

const mapSpeakerOutputGroups = (groups: GeneratedPoint[][]) =>
  groups.reduce((map, group, groupIndex) => {
    const groupLabel = getSpeakerOutputGroupLabel(groupIndex);
    group.forEach((speaker) => map.set(speaker.id, groupLabel));
    return map;
  }, new Map<string, string>());

const getSpeakerOutputGroupLabel = (groupIndex: number) => {
  if (groupIndex < DT_SPK_OUTPUT_COUNT) return `SPK${groupIndex + 1}`;
  const externalChannelIndex = groupIndex - DT_SPK_OUTPUT_COUNT;
  const ampIndex = Math.floor(externalChannelIndex / EXTERNAL_AMPLIFIER_CHANNEL_COUNT) + 1;
  const channelIndex = (externalChannelIndex % EXTERNAL_AMPLIFIER_CHANNEL_COUNT) + 1;
  return `扩展功放${ampIndex} CH${channelIndex}`;
};

function getExternalAmplifierSpeakerGroups<T>(items: T[]) {
  if (items.length <= EXTERNAL_AMPLIFIER_CHANNEL_COUNT) return items.map((item) => [item]);
  const groups = items.slice(0, EXTERNAL_AMPLIFIER_CHANNEL_COUNT).map((item) => [item]);
  items.slice(EXTERNAL_AMPLIFIER_CHANNEL_COUNT).forEach((item, index) => {
    groups[index % EXTERNAL_AMPLIFIER_CHANNEL_COUNT].push(item);
  });
  return groups;
}
