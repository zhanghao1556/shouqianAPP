import { useMemo, useState } from "react";
import {
  floorMaterialLabels,
  scenarioLabels,
  softTreatmentLabels,
  wallMaterialLabels,
  createInitialProfile
} from "./data/initialProfile";
import { getAcousticAssessment } from "./lib/engineeringRules";
import { getArrayMicCentralAirRequiredClearance, getArrayMicInstallHeight } from "./lib/drawingEngine";
import { normalizeProfile } from "./lib/profileNormalization";
import type { CeilingType, ClassroomProfile, FloorMaterial, FurnishingDensity, Scenario, SoftTreatment, WallMaterial } from "./types";

const furnishingDensityLabels: Record<FurnishingDensity, string> = {
  empty: "空旷 / 家具少",
  normal: "常规布置",
  dense: "家具 / 人员密集",
  unknown: "待确认"
};

const ceilingLabels: Record<CeilingType, string> = {
  suspended: "有吊顶",
  exposed: "无吊顶 / 裸顶",
  unknown: "待确认"
};

const presets = [
  {
    label: "小混响样例",
    patch: {
      roomGeometry: { height: 3 },
      acousticEnvironment: {
        floorMaterial: "carpet" as FloorMaterial,
        wallMaterial: "acoustic" as WallMaterial,
        softTreatment: "acousticPanels" as SoftTreatment,
        furnishingDensity: "dense" as FurnishingDensity,
        hasGlassWall: false
      }
    }
  },
  {
    label: "中混响样例",
    patch: {
      roomGeometry: { height: 3.3 },
      acousticEnvironment: {
        floorMaterial: "tile" as FloorMaterial,
        wallMaterial: "painted" as WallMaterial,
        softTreatment: "curtains" as SoftTreatment,
        furnishingDensity: "normal" as FurnishingDensity,
        hasGlassWall: false
      }
    }
  },
  {
    label: "大混响样例",
    patch: {
      roomGeometry: { height: 4.1 },
      acousticEnvironment: {
        floorMaterial: "tile" as FloorMaterial,
        wallMaterial: "hard" as WallMaterial,
        softTreatment: "none" as SoftTreatment,
        furnishingDensity: "empty" as FurnishingDensity,
        hasGlassWall: true
      }
    }
  }
];

export function ReverberationCalibrationWorkbench() {
  const [profile, setProfile] = useState<ClassroomProfile>(() => normalizeProfile(createInitialProfile()));
  const assessment = useMemo(() => getAcousticAssessment(profile), [profile]);
  const scoreItems = useMemo(() => getScoreItems(profile), [profile]);
  const hardTriggers = useMemo(() => getHardTriggers(profile), [profile]);
  const centralAirClearance = useMemo(() => getArrayMicCentralAirRequiredClearance(profile), [profile]);
  const arrayMicInstallHeight = useMemo(() => getArrayMicInstallHeight(profile), [profile]);

  const updateProfile = (patch: Partial<ClassroomProfile>) => {
    setProfile((current) => normalizeProfile({ ...current, ...patch }));
  };

  const updateRoom = (patch: Partial<ClassroomProfile["roomGeometry"]>) => {
    setProfile((current) => normalizeProfile({ ...current, roomGeometry: { ...current.roomGeometry, ...patch } }));
  };

  const updateConstraints = (patch: Partial<ClassroomProfile["engineeringConstraints"]>) => {
    setProfile((current) =>
      normalizeProfile({ ...current, engineeringConstraints: { ...current.engineeringConstraints, ...patch } })
    );
  };

  const updateAcoustic = (patch: Partial<ClassroomProfile["acousticEnvironment"]>) => {
    setProfile((current) =>
      normalizeProfile({ ...current, acousticEnvironment: { ...current.acousticEnvironment, ...patch } })
    );
  };

  const applyPreset = (preset: (typeof presets)[number]) => {
    setProfile((current) =>
      normalizeProfile({
        ...current,
        roomGeometry: { ...current.roomGeometry, ...preset.patch.roomGeometry },
        acousticEnvironment: { ...current.acousticEnvironment, ...preset.patch.acousticEnvironment }
      })
    );
  };

  return (
    <main className="engineeringShell yiouShell">
      <header className="engineeringHeader yiouHeader calibrationHeader">
        <div>
          <span className="sectionBadge">5176</span>
          <h1 className="workspaceTitle">混响校准测试台</h1>
          <p className="workspaceSubTitle">校准混响大 / 中 / 小判定，不直接改点位规则</p>
        </div>
      </header>

      <section className="engineeringGrid calibrationWorkbenchGrid reverberationWorkbenchGrid">
        <section className="workPanel">
          <div className="panelHeader">
            <div>
              <span className="sectionBadge">输入</span>
              <h2>房间与声学条件</h2>
              <p>调整参数后右侧实时显示当前规则的判断结果。</p>
            </div>
          </div>

          <div className="reverbPresetRow">
            {presets.map((preset) => (
              <button key={preset.label} type="button" className="deviceOption" onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="reverbFormGrid">
            <label>
              使用场景
              <select value={profile.scenario} onChange={(event) => updateProfile({ scenario: event.target.value as Scenario })}>
                {Object.entries(scenarioLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              吊顶情况
              <select
                value={profile.engineeringConstraints.ceiling}
                onChange={(event) => updateConstraints({ ceiling: event.target.value as CeilingType })}
              >
                {Object.entries(ceilingLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              房间长度 m
              <input
                type="number"
                min="1"
                step="0.1"
                value={profile.roomGeometry.length}
                onChange={(event) => updateRoom({ length: Number(event.target.value) })}
              />
            </label>
            <label>
              房间宽度 m
              <input
                type="number"
                min="1"
                step="0.1"
                value={profile.roomGeometry.width}
                onChange={(event) => updateRoom({ width: Number(event.target.value) })}
              />
            </label>
            <label>
              房间高度 m
              <input
                type="number"
                min="2"
                step="0.1"
                value={profile.roomGeometry.height}
                onChange={(event) => updateRoom({ height: Number(event.target.value) })}
              />
            </label>
            <label>
              地面材质
              <select
                value={profile.acousticEnvironment.floorMaterial}
                onChange={(event) => updateAcoustic({ floorMaterial: event.target.value as FloorMaterial })}
              >
                {Object.entries(floorMaterialLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              墙面情况
              <select
                value={profile.acousticEnvironment.wallMaterial}
                onChange={(event) => updateAcoustic({ wallMaterial: event.target.value as WallMaterial })}
              >
                {Object.entries(wallMaterialLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              软装 / 吸音
              <select
                value={profile.acousticEnvironment.softTreatment}
                onChange={(event) => updateAcoustic({ softTreatment: event.target.value as SoftTreatment })}
              >
                {Object.entries(softTreatmentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              家具 / 人员密度
              <select
                value={profile.acousticEnvironment.furnishingDensity}
                onChange={(event) => updateAcoustic({ furnishingDensity: event.target.value as FurnishingDensity })}
              >
                {Object.entries(furnishingDensityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkRow acousticCheck">
              <input
                type="checkbox"
                checked={profile.acousticEnvironment.hasGlassWall}
                onChange={(event) => updateAcoustic({ hasGlassWall: event.target.checked })}
              />
              有大面积玻璃墙
            </label>
          </div>
        </section>

        <section className="workPanel">
          <div className="panelHeader">
            <div>
              <span className={`sectionBadge reverbRiskBadge ${assessment.risk}`}>{riskText(assessment.risk)}</span>
              <h2>{assessment.label}</h2>
              <p>当前分数：{assessment.score}；判定阈值：0-1 小，2-4 中，5 及以上大。</p>
            </div>
          </div>

          <div className="reverbResultGrid">
            <div className={`acousticBlock ${assessment.risk}`}>
              <div>
                <strong>当前判断</strong>
                <span>{assessment.label}</span>
              </div>
              <ul>
                {assessment.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>

            <div className="reverbImpactGrid">
              <div>
                <span>中央空调避让</span>
                <strong>{centralAirClearance.toFixed(1)}m</strong>
              </div>
              <div>
                <span>阵麦安装高度</span>
                <strong>{arrayMicInstallHeight.toFixed(1)}m</strong>
              </div>
              <div>
                <span>房间面积</span>
                <strong>{(profile.roomGeometry.length * profile.roomGeometry.width).toFixed(1)}㎡</strong>
              </div>
            </div>
          </div>

          <div className="reverbScoreTable">
            <h3>打分拆解</h3>
            {scoreItems.map((item) => (
              <div key={item.label} className={item.score === 0 ? "neutral" : item.score > 0 ? "plus" : "minus"}>
                <span>{item.label}</span>
                <strong>{item.score > 0 ? `+${item.score}` : item.score}</strong>
              </div>
            ))}
          </div>

          <div className="reverbNotes">
            <h3>硬触发</h3>
            {hardTriggers.length ? (
              <ul>
                {hardTriggers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>当前没有硬触发，按材料 / 面积评分判定。</p>
            )}
          </div>

          <div className="reverbNotes">
            <h3>建议</h3>
            <ul>
              {assessment.suggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}

function riskText(risk: "low" | "medium" | "high") {
  if (risk === "high") return "大";
  if (risk === "medium") return "中";
  return "小";
}

function getScoreItems(profile: ClassroomProfile) {
  const area = profile.roomGeometry.length * profile.roomGeometry.width;
  const items = [
    scoreItem("瓷砖 / 石材地面", profile.acousticEnvironment.floorMaterial === "tile" ? 2 : 0),
    scoreItem("地毯 / 软质地面", profile.acousticEnvironment.floorMaterial === "carpet" ? -2 : 0),
    scoreItem("硬质墙面", profile.acousticEnvironment.wallMaterial === "hard" ? 2 : 0),
    scoreItem("吸音墙面", profile.acousticEnvironment.wallMaterial === "acoustic" ? -2 : 0),
    scoreItem("无软装 / 无吸音", profile.acousticEnvironment.softTreatment === "none" ? 2 : 0),
    scoreItem(
      "窗帘 / 少量软装",
      profile.acousticEnvironment.softTreatment === "curtains" || profile.acousticEnvironment.softTreatment === "mixed" ? -1 : 0
    ),
    scoreItem("吸音板 / 声学装修", profile.acousticEnvironment.softTreatment === "acousticPanels" ? -2 : 0),
    scoreItem("空间较空", profile.acousticEnvironment.furnishingDensity === "empty" ? 1 : 0),
    scoreItem("家具 / 人员密集", profile.acousticEnvironment.furnishingDensity === "dense" ? -1 : 0),
    scoreItem("大面积玻璃墙", profile.acousticEnvironment.hasGlassWall ? 2 : 0),
    scoreItem("面积 >= 80㎡", area >= 80 ? 1 : 0)
  ];
  return items.filter((item) => item.score !== 0);
}

function scoreItem(label: string, score: number) {
  return { label, score };
}

function getHardTriggers(profile: ClassroomProfile) {
  const triggers: string[] = [];
  if (profile.engineeringConstraints.ceiling === "suspended" && profile.roomGeometry.height >= 4) {
    triggers.push("吊顶高度大于等于 4m，当前规则直接判定为混响风险大。");
  }
  return triggers;
}
