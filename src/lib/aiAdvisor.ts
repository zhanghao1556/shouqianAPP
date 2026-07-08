import { needLabels, scenarioLabels } from "../data/questionFlow";
import type { AiAdvisor, ProjectProfile } from "../types";

export const getMissingFields = (profile: ProjectProfile) => {
  const missing: string[] = [];
  if (!profile.scenario) missing.push("使用场景");
  if (profile.needs.length === 0) missing.push("使用需求");
  if (!profile.space.length) missing.push("房间长度");
  if (!profile.space.width) missing.push("房间宽度");
  if (!profile.space.height) missing.push("房间高度");
  if (!profile.constraints.budgetLevel) missing.push("预算倾向");
  if (profile.needs.includes("recording") && profile.space.externalDevices.length === 0) {
    missing.push("录播/外接设备");
  }
  return missing;
};

export const getRiskHints = (profile: ProjectProfile) => {
  const hints: string[] = [];
  const area = profile.space.length && profile.space.width ? profile.space.length * profile.space.width : 0;
  if (area > 120) hints.push("空间面积较大，建议确认是否需要分区拾音或前后补声。");
  if (profile.space.glassWalls.length > 0) hints.push("现场存在玻璃墙，报告中需要提示反射声和啸叫风险。");
  if (profile.space.acPositions.length > 0) hints.push("空调靠近拾音区时，建议避开风口并预留降噪调试。");
  if (profile.space.ceiling === "no") hints.push("无吊顶条件会影响天顶麦安装，需准备吊架或替代拾音方案。");
  return hints;
};

export const localAiAdvisor: AiAdvisor = {
  getNextPrompt(profile, missingFields) {
    const risks = getRiskHints(profile);
    if (!profile.scenario) return "我先不让客户自己提问。请先选一下这个项目的使用场景，我会按场景继续追问。";
    if (profile.needs.length === 0) return "场景已确认。接下来我需要知道实际使用需求，可以多选，这会直接影响拾音、扩声和外接设备。";
    if (!profile.space.length || !profile.space.width || !profile.space.height) {
      return "现在需要采集空间信息。长宽高越准确，后面的数量计算和点位图就越接近真实方案。";
    }
    if (profile.needs.includes("recording") && profile.space.externalDevices.length === 0) {
      return "你选择了录播，我需要继续确认录播主机、摄像机、电脑或视频会议终端等外接设备。";
    }
    if (!profile.constraints.budgetLevel) return "主体需求已经成型，最后确认预算倾向和施工限制，我会据此收敛推荐组合。";
    if (risks.length > 0) return `方案已可生成。我额外发现 ${risks.length} 个现场风险点，会写进报告：${risks[0]}`;
    if (missingFields.length > 0) return `还差 ${missingFields.join("、")}。补齐后我会生成完整售前方案。`;
    return "信息已足够生成售前方案。你可以继续补充备注，或直接查看右侧自动输出。";
  },
  summarizeProfile(profile) {
    const scenario = profile.scenario ? scenarioLabels[profile.scenario] : "待确认";
    const needs = profile.needs.length ? profile.needs.map((need) => needLabels[need]).join("、") : "待确认";
    const size =
      profile.space.length && profile.space.width && profile.space.height
        ? `${profile.space.length}m x ${profile.space.width}m x ${profile.space.height}m`
        : "待确认";
    return `当前项目为${scenario}，核心需求为${needs}，空间尺寸为${size}。`;
  },
  polishReport(reportDraft) {
    return `${reportDraft}\n\n以上方案为售前初步配置，正式施工前建议结合现场复勘、吊顶条件、强弱电走线和客户现有设备接口再次确认。`;
  }
};
