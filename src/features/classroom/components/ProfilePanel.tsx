import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getRoomArea } from "../lib/drawingEngine";
import { getAmplificationScopeText, getNeedText, getScenarioText } from "../lib/profileText";
import { getSpeakerModelName } from "../lib/speakerRules";
import type { AcousticAssessment, ClassroomProfile, CompletenessItem } from "../types";

interface ProfilePanelProps {
  profile: ClassroomProfile;
  completeness: CompletenessItem[];
  risks: string[];
  acousticAssessment: AcousticAssessment;
}

export function ProfilePanel({ profile, completeness, risks, acousticAssessment }: ProfilePanelProps) {
  const completeCount = completeness.filter((item) => item.complete).length;
  const pct = Math.round((completeCount / completeness.length) * 100);
  const needText = getNeedText(profile);

  return (
    <section className="workPanel profileWorkPanel">
      <div className="panelHeader">
        <div>
          <span className="panelStep">02</span>
          <h2>项目档案</h2>
          <p>{getScenarioText(profile)} / {needText}</p>
        </div>
        <strong className={pct === 100 ? "score ok" : "score"}>{pct}%</strong>
      </div>

      <div className="profileFacts">
        <Fact label="项目" value={profile.projectName || "待补充"} />
        <Fact label="客户" value={profile.customerName || "待补充"} />
        <Fact label="场景" value={getScenarioText(profile)} />
        <Fact label="需求" value={needText} />
        <Fact label="尺寸" value={`${profile.roomGeometry.length}m x ${profile.roomGeometry.width}m x ${profile.roomGeometry.height}m`} />
        <Fact label="面积" value={`${getRoomArea(profile).toFixed(1)} 平方米`} />
        <Fact label="体积" value={`${acousticAssessment.roomVolume.toFixed(1)} 立方米`} />
        <Fact label="扩声范围" value={getAmplificationScopeText(profile)} />
        <Fact label="扩声形态" value={getSpeakerMode(profile)} />
        <Fact label="混响风险" value={acousticAssessment.label} />
        <Fact label="RT60" value={`${acousticAssessment.source === "measured" ? "实测" : "估算"} ${acousticAssessment.estimatedRt.toFixed(2)}s`} />
      </div>

      <div className={`acousticBlock ${acousticAssessment.risk}`}>
        <div>
          <strong>声学判断：{acousticAssessment.label}</strong>
          <span>混响风险会影响阵麦拾音清晰度。</span>
        </div>
      </div>

      <div className="checkList">
        {completeness.map((item) => (
          <div key={item.key} className={item.complete ? "checkItem done" : item.blocking ? "checkItem blocking" : "checkItem"}>
            {item.complete ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <div>
              <strong>{item.label}</strong>
              <span>{item.complete ? "已确认" : item.hint}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="riskBlock">
        <strong>复勘提醒</strong>
        {risks.length ? risks.map((risk) => <p key={risk}>{risk}</p>) : <p>接口和声场条件会影响最终落地效果。</p>}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getSpeakerMode(profile: ClassroomProfile) {
  if (profile.roomGeometry.length <= 0 || profile.roomGeometry.width <= 0) return "待确认";
  return getSpeakerModelName(profile);
}
