export const ruleChangePolicy = {
  version: "2026-06-29-manual-approval",
  mode: "manual-approval-required",
  summary: "不擅自改规则；校准不通过、备注和导出记录只进入待确认，不自动修改规则。任何规则变更必须先说明触发原因和修改方案，并经过用户明确申请或确认后才能落地。",
  requiredSteps: [
    "先定位是哪条现有规则导致当前输出",
    "先向用户说明原因和可选修改方向",
    "等待用户明确申请或确认改规则",
    "确认后再修改规则，并在记录中保留来源"
  ]
} as const;

export const createRuleChangeApproval = () => ({
  required: true,
  policyVersion: ruleChangePolicy.version,
  state: "notRequested" as const,
  note: ruleChangePolicy.summary
});
