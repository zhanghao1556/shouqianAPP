import type { ClassroomProfile, Need, Scenario } from "../types";
import { externalDeviceOptions } from "../data/initialProfile";

const classroomScenarios: Scenario[] = ["standardClassroom", "lectureClassroom", "combinedClassroom"];

export const isClassroomScenario = (scenario: Scenario) => classroomScenarios.includes(scenario);
export const isMeetingScenario = (scenario: Scenario) => scenario === "meetingRoom";
export const isAuditoriumScenario = (scenario: Scenario) => scenario === "auditorium";

export const isNeedAllowedForScenario = (scenario: Scenario, need: Need) => {
  if (isClassroomScenario(scenario)) return need !== "videoConference";
  if (isMeetingScenario(scenario)) return need !== "recording" && need !== "interactiveClass";
  return true;
};

export const getAllowedRecordingHostOptions = (scenario: Scenario, options: readonly string[]) => {
  if (isClassroomScenario(scenario)) return options.filter((item) => item !== "视频会议终端");
  if (isMeetingScenario(scenario)) return options.filter((item) => item === "视频会议终端" || item === "中控主机");
  return options;
};

export const getAllowedComputerOptions = (scenario: Scenario, options: readonly string[]) => {
  if (isMeetingScenario(scenario)) return options.filter((item) => item === "笔记本电脑" || item === "会议一体机");
  return options;
};

export const normalizeProfileForScenario = (profile: ClassroomProfile): ClassroomProfile => {
  const needs = profile.needs.filter((need) => isNeedAllowedForScenario(profile.scenario, need)).slice(0, 2);
  const normalizedNeeds = needs.length ? needs : defaultNeedsForScenario(profile.scenario);
  const amplificationScope = normalizeAmplificationScopeForScenario(profile.scenario, profile.amplificationScope);
  const podiumPosition = isMeetingScenario(profile.scenario) || isAuditoriumScenario(profile.scenario) ? "frontCenter" : profile.engineeringConstraints.podiumPosition;

  return {
    ...profile,
    needs: normalizedNeeds,
    amplificationScope,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      podiumPosition
    },
    existingDevices: {
      ...profile.existingDevices,
      recordingHost: normalizeRecordingHost(profile.scenario, profile.existingDevices.recordingHost),
      computer: normalizeComputer(profile.scenario, profile.existingDevices.computer),
      legacyWirelessMic: normalizeLegacyWirelessMic(profile.existingDevices.legacyWirelessMic)
    }
  };
};

const normalizeAmplificationScopeForScenario = (scenario: Scenario, scope: ClassroomProfile["amplificationScope"]) => {
  if (isMeetingScenario(scenario)) return "full";
  if (isAuditoriumScenario(scenario) || scenario === "combinedClassroom" || scenario === "lectureClassroom") return "podium";
  return scope;
};

const defaultNeedsForScenario = (scenario: Scenario): Need[] => {
  if (isMeetingScenario(scenario)) return ["videoConference"];
  if (isClassroomScenario(scenario)) return ["localAmplification"];
  return ["localAmplification"];
};

const normalizeRecordingHost = (scenario: Scenario, value: string) => {
  const items = splitDeviceText(value);
  const allowedOptions = getAllowedRecordingHostOptions(scenario, externalDeviceOptions.recordingHost);
  const allowed = items.filter((item) => {
    return allowedOptions.includes(item);
  });
  return allowed.join("、");
};

const normalizeComputer = (scenario: Scenario, value: string) => {
  const items = splitDeviceText(value);
  const allowedOptions = getAllowedComputerOptions(scenario, externalDeviceOptions.computer);
  const allowed = items.filter((item) => {
    return allowedOptions.includes(item);
  });
  return allowed.join("、");
};

const normalizeLegacyWirelessMic = (value: string) => {
  const items = splitDeviceText(value);
  const allowedOptions = new Set<string>(externalDeviceOptions.legacyWirelessMic);
  const allowed = items.filter((item) => allowedOptions.has(item));
  return allowed.join("、");
};

function splitDeviceText(value: string) {
  return value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
