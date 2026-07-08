import type { ClassroomProfile } from "../types";

export const needsAuditoriumRearFillSpeakers = (profile: ClassroomProfile) => {
  if (profile.scenario !== "auditorium") return false;
  const rearFillStatus = profile.engineeringConstraints.auditoriumRearFillSpeakers;
  if (rearFillStatus === "absent" || rearFillStatus === "unknown") return true;
  if (rearFillStatus === "present") return false;
  const text = `${profile.engineeringConstraints.notes} ${profile.existingDevices.legacySoundSystem} ${profile.customNeed} ${profile.customScenario}`;
  return (
    /(?:\u7f3a\u5c11|\u65e0|\u6ca1\u6709).*(?:\u540e\u6392|\u540e\u573a).*(?:\u8865\u58f0|\u8f85\u52a9\u97f3\u7bb1)/.test(text) ||
    /(?:\u7f3a\u5c11|\u65e0|\u6ca1\u6709).*\u8f85\u52a9\u97f3\u7bb1/.test(text) ||
    /(?:\u540e\u6392|\u540e\u573a).*(?:\u8865\u58f0|\u4e0d\u8db3)/.test(text) ||
    /\u8f85\u52a9\u97f3\u7bb1.*(?:\u7f3a\u5c11|\u65e0|\u6ca1\u6709|\u4e0d\u8db3)/.test(text)
  );
};
