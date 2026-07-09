import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { createInitialProfile } from "./data/initialProfile";
import { EngineeringOutputs } from "./components/EngineeringOutputs";
import { ProfilePanel } from "./components/ProfilePanel";
import { Questionnaire } from "./components/Questionnaire";
import { exportPdfReport } from "./lib/pdfExporter";
import { generateEngineeringOutputs } from "./lib/engineeringRules";
import { normalizeProfile } from "./lib/profileNormalization";
import { getAppBrand, getBrandLogoSrc } from "./brand";
import type { ClassroomProfile, LegacySpeakerType, LegacyWallAdjustability, Point, QuantityOverrides } from "./types";
import yinyiTechLogo from "../../assets/yinyi-tech-logo.svg";
import yinmanLogo from "../../assets/yinman-logo.png";

const defaultCentralAirConditionerSize = { width: 0.8, depth: 0.8 };
const presalesDraftStorageKey = "yiou-presales-draft-v1";
const legacyBrandText = JSON.parse('"\\u7ffc\\u6b27"') as string;
const oldDefaultProjectName = `${legacyBrandText}大客户普通教室音频方案`;
const oldDefaultCustomerName = `${legacyBrandText}大客户`;

export function ClassroomEngineeringApp() {
  const brand = getAppBrand();
  const [initialDraft] = useState(() => (isReleaseBuild() ? createCleanReleasePresalesDraft() : loadSavedPresalesDraft()));
  const [profile, setProfile] = useState<ClassroomProfile>(() => sanitizeHiddenProfileState(initialDraft.profile));
  const [quantityOverrides, setQuantityOverrides] = useState<QuantityOverrides>(() => initialDraft.quantityOverrides);
  const importInputRef = useRef<HTMLInputElement>(null);
  const outputs = useMemo(() => generateEngineeringOutputs(profile, quantityOverrides), [profile, quantityOverrides]);

  useEffect(() => {
    if (isReleaseBuild()) return;
    savePresalesDraft(profile, quantityOverrides);
  }, [profile, quantityOverrides]);

  const updateProfile = (nextProfile: ClassroomProfile) => {
    setProfile(sanitizeHiddenProfileState(normalizeProfile(nextProfile)));
    setQuantityOverrides({});
  };

  const markCentralAirConditionerPoint = (position: Point, index = 0) => {
    const existingPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
    const existing = existingPoints[index];
    const count = Math.max(profile.engineeringConstraints.centralAirConditionerCount ?? 1, index + 1);
    const nextPoints = [...existingPoints];
    nextPoints[index] = {
      id: existing?.id ?? `central-ac-${Date.now()}-${index + 1}`,
      label: existing?.label ?? `中央空调${index + 1}`,
      position,
      size: existing?.size ?? defaultCentralAirConditionerSize
    };
    updateProfile({
      ...profile,
      engineeringConstraints: {
        ...profile.engineeringConstraints,
        hasCentralAirConditioner: true,
        centralAirConditionerCount: count,
        centralAirConditionerPoints: nextPoints
      }
    });
  };

  const updateCentralAirConditionerCount = (count: number) => {
    const nextPoints = (profile.engineeringConstraints.centralAirConditionerPoints ?? []).slice(0, count);
    updateProfile({
      ...profile,
      engineeringConstraints: {
        ...profile.engineeringConstraints,
        hasCentralAirConditioner: count > 0,
        centralAirConditionerCount: count,
        centralAirConditionerPoints: nextPoints
      }
    });
  };

  const addLegacySpeakerPoint = (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => {
    const currentPoints = profile.existingDevices.legacySpeakerPoints ?? [];
    const nextIndex = currentPoints.length + 1;
    updateProfile({
      ...profile,
      existingDevices: {
        ...profile.existingDevices,
        legacySpeakerPoints: [
          ...currentPoints,
          {
            id: `legacy-speaker-${Date.now()}-${nextIndex}`,
            label: `利旧音箱${nextIndex}`,
            type: input.type,
            position: input.position,
            wallAdjustability: input.type === "wall" ? input.wallAdjustability : "unknown"
          }
        ]
      }
    });
  };

  const removeLastLegacySpeakerPoint = () => {
    updateProfile({
      ...profile,
      existingDevices: {
        ...profile.existingDevices,
        legacySpeakerPoints: (profile.existingDevices.legacySpeakerPoints ?? []).slice(0, -1)
      }
    });
  };

  const updateLegacySpeakerPointTarget = (index: number, target: Point) => {
    const currentPoints = profile.existingDevices.legacySpeakerPoints ?? [];
    if (!currentPoints[index] || currentPoints[index].type !== "wall") return;
    updateProfile({
      ...profile,
      existingDevices: {
        ...profile.existingDevices,
        legacySpeakerPoints: currentPoints.map((point, pointIndex) => (pointIndex === index ? { ...point, target } : point))
      }
    });
  };

  const importReport = async (file: File | undefined) => {
    if (!file) return;
    const parsed = await parseImportedReport(file);
    updateProfile(normalizeProfile({ ...createInitialProfile(), ...parsed.profile }));
    setQuantityOverrides({});
  };

  return (
    <main className={`engineeringShell ${brand.id === "yinman" ? "yinmanShell" : "yiouShell"}`}>
      <header className={`engineeringHeader ${brand.id === "yinman" ? "yinmanHeader" : "yiouHeader"}`}>
        <div className="brandCluster">
          <div className="yiouLogo" aria-label={brand.companyName}>
            <img src={getBrandLogoSrc(yinyiTechLogo, yinmanLogo)} alt={`${brand.companyName} logo`} />
          </div>
          <div className="brandText">
            <h1 className="workspaceTitle">{brand.appName}</h1>
            <p className="workspaceSubTitle">高端教育空间声学方案</p>
          </div>
        </div>
        <div className="headerToolBar">
          <button type="button" onClick={() => importInputRef.current?.click()}>
            <Upload size={16} /> 导入报告
          </button>
          <input
            ref={importInputRef}
            className="hiddenFileInput"
            type="file"
            accept="application/json,.json,text/html,.html,application/pdf,.pdf"
            onChange={(event) => importReport(event.target.files?.[0])}
          />
          <button type="button" onClick={() => void exportPdfReport(profile, outputs, quantityOverrides)}>
            <Download size={16} /> 导出报告
          </button>
        </div>
      </header>

      <section className="engineeringGrid fullWorkbenchGrid">
        <Questionnaire profile={profile} onChange={updateProfile} />
        <section className="unifiedWorkspace">
          <ProfilePanel
            profile={profile}
            completeness={outputs.completeness}
            risks={outputs.riskItems}
            acousticAssessment={outputs.acousticAssessment}
          />
          <EngineeringOutputs
            profile={profile}
            outputs={outputs}
            quantityOverrides={quantityOverrides}
            onQuantityOverride={setQuantityOverrides}
            onCentralAirConditionerPointChange={markCentralAirConditionerPoint}
            onCentralAirConditionerCountChange={updateCentralAirConditionerCount}
            onLegacySpeakerPointAdd={addLegacySpeakerPoint}
            onLegacySpeakerPointRemoveLast={removeLastLegacySpeakerPoint}
            onLegacySpeakerPointTargetChange={updateLegacySpeakerPointTarget}
          />
        </section>
      </section>
      <div className="referenceNotice">方案仅供参考，如有拿捏不准或者 BUG 请联系张灏</div>
    </main>
  );
}

async function parseImportedReport(file: File): Promise<{ profile: Partial<ClassroomProfile> }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return parseImportedPdfReport(await file.arrayBuffer());
  }
  return parseImportedTextReport(await file.text());
}

function parseImportedTextReport(text: string): { profile: Partial<ClassroomProfile> } {
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    const document = new DOMParser().parseFromString(trimmed, "text/html");
    const encoded = document.querySelector<HTMLElement>("[data-yiou-report-payload]")?.dataset.yiouReportPayload;
    if (!encoded) throw new Error("Report payload not found.");
    return decodeReportPayload(encoded);
  }
  const parsed = JSON.parse(trimmed) as Partial<ClassroomProfile> | { profile?: Partial<ClassroomProfile> };
  if ("profile" in parsed && parsed.profile) {
    return { profile: parsed.profile };
  }
  return { profile: parsed as Partial<ClassroomProfile> };
}

function parseImportedPdfReport(buffer: ArrayBuffer): { profile: Partial<ClassroomProfile> } {
  const bytes = new Uint8Array(buffer);
  let text = "";
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    text += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  const match = /\/Keywords\s*\(([^)]*)\)/.exec(text);
  if (!match?.[1]) throw new Error("PDF report payload not found.");
  return decodeReportPayload(match[1]);
}

function decodeReportPayload(encoded: string): { profile: Partial<ClassroomProfile> } {
  const binary = atob(encoded.split("").reverse().join(""));
  const json = decodeURIComponent(
    Array.from(binary)
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
  const payload = JSON.parse(json) as { profile?: Partial<ClassroomProfile> };
  if (!payload.profile) throw new Error("Report profile not found.");
  return { profile: payload.profile };
}

function loadSavedPresalesDraft(): { profile: ClassroomProfile; quantityOverrides: QuantityOverrides } {
  const fallback = { profile: normalizeProfile(createInitialProfile()), quantityOverrides: {} };
  try {
    const raw = localStorage.getItem(presalesDraftStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{ profile: Partial<ClassroomProfile>; quantityOverrides: QuantityOverrides }>;
    if (!parsed.profile) return fallback;
    return {
      profile: normalizeProfile(mergeProfileWithInitial(parsed.profile)),
      quantityOverrides: parsed.quantityOverrides ?? {}
    };
  } catch {
    return fallback;
  }
}

function createCleanReleasePresalesDraft(): { profile: ClassroomProfile; quantityOverrides: QuantityOverrides } {
  const initial = createInitialProfile();
  return {
    profile: {
      ...initial,
      needs: [],
      roomGeometry: { ...initial.roomGeometry, length: 0, width: 0, height: 0 },
      existingDevices: {
        recordingHost: "",
        computer: "",
        legacySoundSystem: "",
        legacyWirelessMic: "",
        legacySpeakerPoints: []
      },
      engineeringConstraints: {
        ...initial.engineeringConstraints,
        ceiling: "unknown",
        stageSize: { width: 0, depth: 0 },
        teachingAreaSize: { width: 0, depth: 0 },
        hasCentralAirConditioner: false,
        centralAirConditionerCount: 0,
        centralAirConditionerPoints: [],
        auditoriumRearFillSpeakers: "unknown",
        speakerProductOverride: "auto",
        notes: ""
      }
    },
    quantityOverrides: {}
  };
}

function savePresalesDraft(profile: ClassroomProfile, quantityOverrides: QuantityOverrides) {
  try {
    localStorage.setItem(presalesDraftStorageKey, JSON.stringify({ profile: sanitizeHiddenProfileState(profile), quantityOverrides }));
  } catch {
    // localStorage may be unavailable in privacy modes; the app can still run without persistence.
  }
}

function isReleaseBuild() {
  return Boolean(window.__YIOU_RELEASE_BUILD__);
}

function sanitizeHiddenProfileState(profile: ClassroomProfile): ClassroomProfile {
  const hasCentralAirConditioner = Boolean(profile.engineeringConstraints.hasCentralAirConditioner);
  const hasLegacySoundSystem = profile.existingDevices.legacySoundSystem.trim().length > 0;
  return {
    ...profile,
    projectName: profile.projectName === oldDefaultProjectName ? "" : profile.projectName,
    customerName: profile.customerName === oldDefaultCustomerName ? "" : profile.customerName,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      speakerProductOverride: "auto",
      centralAirConditionerCount: hasCentralAirConditioner ? profile.engineeringConstraints.centralAirConditionerCount : 0,
      centralAirConditionerPoints: hasCentralAirConditioner ? profile.engineeringConstraints.centralAirConditionerPoints : []
    },
    existingDevices: {
      ...profile.existingDevices,
      legacySpeakerPoints: hasLegacySoundSystem ? profile.existingDevices.legacySpeakerPoints : []
    }
  };
}

function mergeProfileWithInitial(profile: Partial<ClassroomProfile>): ClassroomProfile {
  const initial = createInitialProfile();
  return {
    ...initial,
    ...profile,
    roomGeometry: { ...initial.roomGeometry, ...profile.roomGeometry },
    existingDevices: { ...initial.existingDevices, ...profile.existingDevices },
    engineeringConstraints: {
      ...initial.engineeringConstraints,
      ...profile.engineeringConstraints,
      stageSize: { ...initial.engineeringConstraints.stageSize, ...profile.engineeringConstraints?.stageSize },
      teachingAreaSize: { ...initial.engineeringConstraints.teachingAreaSize, ...profile.engineeringConstraints?.teachingAreaSize },
      centralAirConditionerPoints: profile.engineeringConstraints?.centralAirConditionerPoints ?? initial.engineeringConstraints.centralAirConditionerPoints
    },
    acousticEnvironment: { ...initial.acousticEnvironment, ...profile.acousticEnvironment }
  };
}
