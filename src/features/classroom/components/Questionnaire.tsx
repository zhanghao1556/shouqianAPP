import {
  floorMaterialLabels,
  externalDeviceOptions,
  needOptions,
  podiumPositionLabels,
  scenarioOptions,
  softTreatmentLabels,
  wallMaterialLabels
} from "../data/initialProfile";
import { useEffect, useRef, useState } from "react";
import type {
  AmplificationScope,
  ClassroomProfile,
  FloorMaterial,
  Need,
  PodiumPosition,
  Scenario,
  SoftTreatment,
  WallMaterial
} from "../types";
import {
  getAllowedComputerOptions,
  getAllowedRecordingHostOptions,
  isAuditoriumScenario,
  isMeetingScenario,
  isNeedAllowedForScenario,
  normalizeProfileForScenario
} from "../lib/scenarioRules";

interface QuestionnaireProps {
  profile: ClassroomProfile;
  onChange: (profile: ClassroomProfile) => void;
}

type ExistingDeviceTextKey = "recordingHost" | "computer" | "legacyWirelessMic";

const LEGACY_SOUND_ROOT = "原有音频系统";
const LEGACY_SOUND_ROOT_ALIASES = [LEGACY_SOUND_ROOT, "原有扩声系统"];
const LEGACY_SOUND_DETAIL_OPTIONS = ["调音台", "反馈抑制器", "音频处理器", "功放", "有源音箱", "无源音箱"] as const;

export function Questionnaire({ profile, onChange }: QuestionnaireProps) {
  const setProfile = (patch: Partial<ClassroomProfile>) => onChange(normalizeProfileForScenario({ ...profile, ...patch }));
  const setGeometry = (key: keyof ClassroomProfile["roomGeometry"], value: number) =>
    setProfile({ roomGeometry: { ...profile.roomGeometry, [key]: value } });
  const setConstraints = (patch: Partial<ClassroomProfile["engineeringConstraints"]>) =>
    setProfile({ engineeringConstraints: { ...profile.engineeringConstraints, ...patch } });
  const setStageSize = (key: keyof ClassroomProfile["engineeringConstraints"]["stageSize"], value: number) =>
    setConstraints({ stageSize: { ...profile.engineeringConstraints.stageSize, [key]: value } });
  const setTeachingAreaSize = (key: keyof ClassroomProfile["engineeringConstraints"]["teachingAreaSize"], value: number) =>
    setConstraints({ teachingAreaSize: { ...profile.engineeringConstraints.teachingAreaSize, [key]: value } });
  const setAcoustic = (patch: Partial<ClassroomProfile["acousticEnvironment"]>) =>
    setProfile({ acousticEnvironment: { ...profile.acousticEnvironment, ...patch } });
  const setExisting = (patch: Partial<ClassroomProfile["existingDevices"]>) =>
    setProfile({ existingDevices: { ...profile.existingDevices, ...patch } });

  const toggleExistingDevice = (key: ExistingDeviceTextKey, label: string) => {
    const current = splitDeviceText(profile.existingDevices[key]);
    const next = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
    const nextText = next.join("、");
    setExisting({ [key]: nextText });
  };

  const setLegacySoundItems = (items: string[]) => {
    const normalizedItems = items.map((item) => (LEGACY_SOUND_ROOT_ALIASES.includes(item) ? LEGACY_SOUND_ROOT : item));
    const uniqueItems = Array.from(new Set(normalizedItems.filter(Boolean)));
    const orderedItems = [
      uniqueItems.includes(LEGACY_SOUND_ROOT) ? LEGACY_SOUND_ROOT : "",
      ...LEGACY_SOUND_DETAIL_OPTIONS.filter((option) => uniqueItems.includes(option))
    ].filter(Boolean);
    setExisting(orderedItems.length ? { legacySoundSystem: orderedItems.join("、") } : { legacySoundSystem: "", legacySpeakerPoints: [] });
  };

  const toggleLegacySoundRoot = () => {
    const current = splitDeviceText(profile.existingDevices.legacySoundSystem);
    if (current.length) {
      setExisting({ legacySoundSystem: "", legacySpeakerPoints: [] });
      return;
    }
    setLegacySoundItems([LEGACY_SOUND_ROOT, "有源音箱"]);
  };

  const toggleLegacySoundDetail = (label: string) => {
    const current = splitDeviceText(profile.existingDevices.legacySoundSystem);
    const hasLabel = current.includes(label);
    let next = current.length ? current : [LEGACY_SOUND_ROOT, "有源音箱"];

    if (label === "有源音箱") {
      if (hasLabel) return;
      next = [...next.filter((item) => item !== "无源音箱" && item !== "功放"), "有源音箱"];
    } else if (label === "无源音箱") {
      if (hasLabel) {
        next = [...next.filter((item) => item !== "无源音箱" && item !== "功放"), "有源音箱"];
      } else {
        next = [...next.filter((item) => item !== "有源音箱"), "功放", "无源音箱"];
      }
    } else if (label === "功放") {
      if (hasLabel) {
        next = [...next.filter((item) => item !== "功放" && item !== "无源音箱"), "有源音箱"];
      } else {
        next = [...next.filter((item) => item !== "有源音箱"), "功放", "无源音箱"];
      }
    } else {
      next = hasLabel ? next.filter((item) => item !== label) : [...next, label];
    }

    setLegacySoundItems([LEGACY_SOUND_ROOT, ...next]);
  };

  const toggleNeed = (need: Need) => {
    if (!isNeedAllowedForScenario(profile.scenario, need)) return;
    const needs = profile.needs.includes(need)
      ? profile.needs.filter((item) => item !== need)
      : [...profile.needs.slice(-1), need];
    setProfile({ needs });
  };

  const selectScenario = (scenario: Scenario) => {
    setProfile({
      scenario,
      amplificationScope: isMeetingScenario(scenario) ? "full" : isAuditoriumScenario(scenario) ? "podium" : profile.amplificationScope
    });
  };

  return (
    <aside className="workPanel intakePanel">
      <div className="panelHeader">
        <div>
          <span className="panelStep">01</span>
          <h2>售前采集</h2>
        </div>
      </div>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>项目信息</h3>
          <span className="sectionBadge">基础</span>
        </div>
        <div className="doubleGrid">
          <label>
            项目名称
            <input value={profile.projectName} onChange={(event) => setProfile({ projectName: event.target.value })} />
          </label>
          <label>
            客户名称
            <input value={profile.customerName} onChange={(event) => setProfile({ customerName: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>第一步：使用场景？</h3>
          <span className="sectionBadge">单选</span>
        </div>
        <div className="choiceGrid">
          {scenarioOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={profile.scenario === option.value ? "choiceButton active" : "choiceButton"}
              onClick={() => selectScenario(option.value as Scenario)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {profile.scenario === "other" && (
          <label className="customField">
            自定义场景
            <input value={profile.customScenario} onChange={(event) => setProfile({ customScenario: event.target.value })} placeholder="请输入使用场景" />
          </label>
        )}
      </section>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>第二步：使用需求？</h3>
          <span className="sectionBadge">单选 / 双选</span>
        </div>
        <div className="needGrid">
          {needOptions.filter((option) => isNeedAllowedForScenario(profile.scenario, option.value)).map((option) => (
            <button
              key={option.value}
              type="button"
              className={profile.needs.includes(option.value) ? "needButton active" : "needButton"}
              onClick={() => toggleNeed(option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.helper}</span>
            </button>
          ))}
        </div>
        {profile.needs.includes("other") && (
          <label className="customField">
            自定义需求
            <input value={profile.customNeed} onChange={(event) => setProfile({ customNeed: event.target.value })} placeholder="请输入使用需求" />
          </label>
        )}
        {profile.needs.includes("localAmplification") && isMeetingScenario(profile.scenario) && (
          <div className="subChoicePanel">
            <h4>本地扩声范围</h4>
            <p className="sectionHint">会议室默认按全场扩声生成方案。</p>
          </div>
        )}
        {profile.needs.includes("localAmplification") && isAuditoriumScenario(profile.scenario) && (
          <div className="subChoicePanel">
            <h4>本地扩声范围</h4>
            <p className="sectionHint">报告厅仅按舞台区域扩声生成方案。</p>
          </div>
        )}
        {profile.needs.includes("localAmplification") && profile.scenario === "lectureClassroom" && (
          <div className="subChoicePanel">
            <h4>本地扩声范围</h4>
            <p className="sectionHint">阶梯教室仅按讲台区域扩声生成方案。</p>
          </div>
        )}
        {profile.needs.includes("localAmplification") && profile.scenario === "combinedClassroom" && (
          <div className="subChoicePanel">
            <h4>本地扩声范围</h4>
            <p className="sectionHint">合班教室仅按上课区扩声生成方案，声音覆盖给后方或两侧坐席区听。</p>
          </div>
        )}
        {profile.needs.includes("localAmplification") && !isMeetingScenario(profile.scenario) && !isAuditoriumScenario(profile.scenario) && profile.scenario !== "combinedClassroom" && profile.scenario !== "lectureClassroom" && (
          <div className="subChoicePanel">
            <h4>本地扩声范围</h4>
            <div className="choiceGrid twoChoiceGrid">
              {[
                { value: "podium", label: "讲台区域扩声" },
                { value: "full", label: "全场扩声" }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={profile.amplificationScope === option.value ? "choiceButton active" : "choiceButton"}
                  onClick={() => setProfile({ amplificationScope: option.value as AmplificationScope })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>房间尺寸</h3>
          <span className="sectionBadge">米</span>
        </div>
        <div className="tripleGrid dimensionGrid">
          <NumberField label="长" value={profile.roomGeometry.length} onChange={(value) => setGeometry("length", value)} />
          <NumberField label="宽" value={profile.roomGeometry.width} onChange={(value) => setGeometry("width", value)} />
          <NumberField label="高" value={profile.roomGeometry.height} onChange={(value) => setGeometry("height", value)} />
        </div>
        {isAuditoriumScenario(profile.scenario) && (
          <div className="tripleGrid dimensionGrid">
            <label>
              前方区域
              <input value="居中舞台（靠前墙）" readOnly />
            </label>
            <NumberField label="舞台宽 m" value={profile.engineeringConstraints.stageSize?.width ?? 0} onChange={(value) => setStageSize("width", value)} />
            <NumberField label="舞台纵深 m" value={profile.engineeringConstraints.stageSize?.depth ?? 0} onChange={(value) => setStageSize("depth", value)} />
          </div>
        )}
        {profile.scenario === "combinedClassroom" && (
          <div className="tripleGrid dimensionGrid">
            <label>
              前方区域
              <input value="上课区（靠前）" readOnly />
            </label>
            <NumberField label="上课区宽 m" value={profile.engineeringConstraints.teachingAreaSize?.width ?? 0} onChange={(value) => setTeachingAreaSize("width", value)} />
            <NumberField label="上课区纵深 m" value={profile.engineeringConstraints.teachingAreaSize?.depth ?? 0} onChange={(value) => setTeachingAreaSize("depth", value)} />
          </div>
        )}
      </section>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>现场条件与声学因素</h3>
          <span className="sectionBadge">声场</span>
        </div>

        <div className="doubleGrid">
          <label>
            吊顶情况
            <CustomSelect
              value={profile.engineeringConstraints.ceiling}
              options={[
                { value: "suspended", label: "有吊顶" },
                { value: "exposed", label: "无吊顶 / 裸顶" },
                { value: "unknown", label: "待确认" }
              ]}
              onChange={(value) => setConstraints({ ceiling: value as ClassroomProfile["engineeringConstraints"]["ceiling"] })}
            />
          </label>
          {!isMeetingScenario(profile.scenario) && !isAuditoriumScenario(profile.scenario) && (
            <label>
              讲台位置
              <CustomSelect
                value={profile.engineeringConstraints.podiumPosition}
                options={Object.entries(podiumPositionLabels).map(([value, label]) => ({ value, label }))}
                onChange={(value) => setConstraints({ podiumPosition: value as PodiumPosition })}
              />
            </label>
          )}
          <label>
            中央空调
            <CustomSelect
              value={profile.engineeringConstraints.hasCentralAirConditioner ? "yes" : "no"}
              options={[
                { value: "no", label: "无中央空调" },
                { value: "yes", label: "有中央空调" }
              ]}
              onChange={(value) =>
                setConstraints({
                  hasCentralAirConditioner: value === "yes",
                  centralAirConditionerCount: value === "yes" ? Math.max(1, profile.engineeringConstraints.centralAirConditionerPoints?.length ?? 0) : 0,
                  centralAirConditionerPoints: value === "yes" ? (profile.engineeringConstraints.centralAirConditionerPoints ?? []) : []
                })
              }
            />
          </label>
          {isAuditoriumScenario(profile.scenario) && (
            <label>
              后排补声 / 辅助音箱
              <CustomSelect
                value={profile.engineeringConstraints.auditoriumRearFillSpeakers ?? "unknown"}
                options={[
                  { value: "unknown", label: "待确认" },
                  { value: "present", label: "有后排补声 / 辅助音箱" },
                  { value: "absent", label: "无后排补声 / 辅助音箱" }
                ]}
                onChange={(value) =>
                  setConstraints({
                    auditoriumRearFillSpeakers: value as ClassroomProfile["engineeringConstraints"]["auditoriumRearFillSpeakers"]
                  })
                }
              />
            </label>
          )}
          <label>
            地面材质
            <CustomSelect
              value={profile.acousticEnvironment.floorMaterial}
              options={Object.entries(floorMaterialLabels).map(([value, label]) => ({ value, label }))}
              onChange={(value) => setAcoustic({ floorMaterial: value as FloorMaterial })}
            />
          </label>
          <label>
            墙面情况
            <CustomSelect
              value={profile.acousticEnvironment.wallMaterial}
              options={Object.entries(wallMaterialLabels).map(([value, label]) => ({ value, label }))}
              onChange={(value) => setAcoustic({ wallMaterial: value as WallMaterial })}
            />
          </label>
          <label>
            软装 / 吸音
            <CustomSelect
              value={profile.acousticEnvironment.softTreatment}
              options={Object.entries(softTreatmentLabels).map(([value, label]) => ({ value, label }))}
              onChange={(value) => setAcoustic({ softTreatment: value as SoftTreatment })}
            />
          </label>
          <label className="checkRow acousticCheck">
            <input
              type="checkbox"
              checked={profile.acousticEnvironment.hasGlassWall}
              onChange={(event) => setAcoustic({ hasGlassWall: event.target.checked })}
            />
            有大面积玻璃墙
          </label>
        </div>
      </section>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>外接设备</h3>
          <span className="sectionBadge">多选</span>
        </div>
        <div className="externalDeviceGroups">
          <DeviceOptionGroup
            title="录播 / 会议平台"
            options={getAllowedRecordingHostOptions(profile.scenario, externalDeviceOptions.recordingHost)}
            value={profile.existingDevices.recordingHost}
            onToggle={(label) => toggleExistingDevice("recordingHost", label)}
          />
          <DeviceOptionGroup
            title="电脑 / 一体机"
            options={getAllowedComputerOptions(profile.scenario, externalDeviceOptions.computer)}
            value={profile.existingDevices.computer}
            onToggle={(label) => toggleExistingDevice("computer", label)}
          />
          <LegacySoundOptionGroup
            value={profile.existingDevices.legacySoundSystem}
            onToggleRoot={toggleLegacySoundRoot}
            onToggleDetail={toggleLegacySoundDetail}
          />
          <DeviceOptionGroup
            title="麦克风"
            options={externalDeviceOptions.legacyWirelessMic}
            value={profile.existingDevices.legacyWirelessMic}
            onToggle={(label) => toggleExistingDevice("legacyWirelessMic", label)}
            hint="有线麦克风需自供电或由前级设备供电，并提供音频信号。"
          />
        </div>
      </section>

      <section className="formSection">
        <div className="sectionTitleRow">
          <h3>备注</h3>
          <span className="sectionBadge">内部</span>
        </div>
        <p className="sectionHint">建议补充会影响阵麦点位的信息：后排是否过道、两侧是座位还是过道、门窗/梁位/投影/讲台是否限制安装。</p>
        <textarea
          value={profile.engineeringConstraints.notes}
          onChange={(event) => setConstraints({ notes: event.target.value })}
          placeholder="例如：后排过道约1.2m；两侧为座位 / 两侧过道；右侧有门，左前有投影幕，阵麦需避开灯具和空调风口"
        />
      </section>
    </aside>
  );
}

function splitDeviceText(value: string) {
  return value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function DeviceOptionGroup({
  title,
  options,
  value,
  onToggle,
  hint
}: {
  title: string;
  options: readonly string[];
  value: string;
  onToggle: (label: string) => void;
  hint?: string;
}) {
  const selected = splitDeviceText(value);

  return (
    <div className="deviceOptionGroup">
      <h4>{title}</h4>
      <div className="deviceOptionGrid">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={selected.includes(option) ? "deviceOption active" : "deviceOption"}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {hint ? <p className="deviceOptionHint">{hint}</p> : null}
    </div>
  );
}

function LegacySoundOptionGroup({
  value,
  onToggleRoot,
  onToggleDetail
}: {
  value: string;
  onToggleRoot: () => void;
  onToggleDetail: (label: string) => void;
}) {
  const selected = splitDeviceText(value);
  const isActive = selected.length > 0;
  const isRootActive = selected.some((item) => LEGACY_SOUND_ROOT_ALIASES.includes(item)) || isActive;

  return (
    <div className="deviceOptionGroup legacySoundOptionGroup">
      <h4>音频与处理设备</h4>
      <div className="deviceOptionGrid">
        <button
          type="button"
          className={isRootActive ? "deviceOption active" : "deviceOption"}
          onClick={onToggleRoot}
        >
          {LEGACY_SOUND_ROOT}
        </button>
      </div>
      {isActive ? (
        <div className="deviceSubOptions">
          <div className="deviceOptionGrid">
            {LEGACY_SOUND_DETAIL_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={selected.includes(option) ? "deviceOption active" : "deviceOption"}
                onClick={() => onToggleDetail(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="deviceOptionHint">音箱必选；无源音箱需配功放。</p>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" min="0" step="0.1" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value) || 0)} />
    </label>
  );
}

function CustomSelect({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutside);
    return () => window.removeEventListener("pointerdown", closeOnOutside);
  }, [isOpen]);

  return (
    <div className={isOpen ? "customSelect open" : "customSelect"} ref={rootRef}>
      <button type="button" className="customSelectButton" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <span>{activeOption?.label ?? "待选择"}</span>
        <span aria-hidden="true" className="customSelectArrow">⌄</span>
      </button>
      {isOpen ? (
        <div className="customSelectMenu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "customSelectOption active" : "customSelectOption"}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
