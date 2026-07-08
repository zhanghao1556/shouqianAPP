import { needLabels, scenarioLabels } from "../data/initialProfile";
import type { ClassroomProfile, Need } from "../types";

export const getScenarioText = (profile: ClassroomProfile) => {
  if (profile.scenario === "other") return profile.customScenario.trim() || "其他（待补充）";
  return scenarioLabels[profile.scenario];
};

export const getNeedText = (profile: ClassroomProfile) => {
  const labels = profile.needs.map((need) => getSingleNeedText(profile, need));
  return labels.join("、") || "待选择需求";
};

export const getSingleNeedText = (profile: ClassroomProfile, need: Need) => {
  if (need === "other") return profile.customNeed.trim() || "其他（待补充）";
  return needLabels[need];
};

export const getAmplificationScopeText = (profile: ClassroomProfile) =>
  profile.amplificationScope === "podium"
    ? profile.scenario === "auditorium"
      ? "舞台区域扩声"
      : profile.scenario === "combinedClassroom"
        ? "上课区扩声"
        : "讲台区域扩声"
    : "全场扩声";

export const getLegacyDeviceSummary = (profile: ClassroomProfile) => {
  const items = [
    profile.existingDevices.legacySoundSystem.trim() ? `利旧音频链路：${getLegacySoundSystemText(profile)}` : "",
    (profile.existingDevices.legacySpeakerPoints ?? []).length ? `利旧音箱点位：${profile.existingDevices.legacySpeakerPoints.length} 个` : "",
    profile.existingDevices.legacyWirelessMic.trim() ? `利旧手持麦：${profile.existingDevices.legacyWirelessMic.trim()}` : ""
  ].filter(Boolean);
  return items.length ? items.join("；") : "无利旧设备信息";
};

export const getLegacySoundSystemText = (profile: ClassroomProfile) => {
  const value = profile.existingDevices.legacySoundSystem.trim();
  if (!value) return "未填写";
  const hasActiveSpeaker = value.includes("有源音箱");
  const hasPassiveSpeaker = value.includes("无源音箱") || value.includes("音箱");
  const hasPowerAmp = value.includes("功放");
  const hasMixer = value.includes("调音台");
  const hasFeedbackSuppressor = value.includes("反馈抑制");
  const hasProcessor = value.includes("处理器");
  const chain: string[] = [
    hasMixer ? "调音台" : "",
    hasProcessor ? "音频处理器" : ""
  ].filter(Boolean);
  if (hasFeedbackSuppressor && hasPowerAmp && chain.length > 0) chain.push("反馈抑制器");
  if (hasPowerAmp) chain.push("功放");
  if (hasActiveSpeaker) chain.push("有源音箱");
  else if (hasPassiveSpeaker) chain.push("无源音箱");
  const canFormSystem = hasActiveSpeaker || (hasPowerAmp && hasPassiveSpeaker);
  const normalizedValue = value.replace(/原有扩声系统/g, "原有音频系统");
  return `${chain.length ? chain.join(" → ") : normalizedValue}${canFormSystem ? "（可构成利旧音频系统）" : "（需补齐功放/音箱链路）"}`;
};
