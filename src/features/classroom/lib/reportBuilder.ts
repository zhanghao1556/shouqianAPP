import {
  ceilingAcousticTreatmentLabels,
  echoObservationLabels,
  floorMaterialLabels,
  furnishingDensityLabels,
  glassCoverageLabels,
  softTreatmentLabels,
  wallMaterialLabels,
  yiouBrand
} from "../data/initialProfile";
import type {
  AcousticAssessment,
  ClassroomProfile,
  CompletenessItem,
  ConnectionLine,
  DrawingModel,
  EngineeringBasis,
  GeneratedPoint,
  InstallationGuideItem,
  PdfReportModel,
  ProductRecommendation,
  ReportSection
} from "../types";
import { getEffectiveAmplificationScope, getRoomArea, isOversizedForFullRoomAmplification } from "./drawingEngine";
import { getCustomerVisibleConnectionLines } from "./customerOutput";
import { getAmplificationScopeText, getNeedText, getScenarioText } from "./profileText";
import { getSpeakerModelName } from "./speakerRules";

interface ReportInput {
  isFinalReady: boolean;
  completeness: CompletenessItem[];
  generatedPoints: GeneratedPoint[];
  connectionLines: ConnectionLine[];
  productSelection: ProductRecommendation[];
  engineeringBasis: EngineeringBasis[];
  installationGuide: InstallationGuideItem[];
  acousticAssessment: AcousticAssessment;
  riskItems: string[];
  reviewItems: string[];
  drawings: DrawingModel[];
}

export const buildReport = (profile: ClassroomProfile, input: ReportInput) => {
  const date = new Date().toLocaleString("zh-CN", { hour12: false });
  const needs = getNeedText(profile);
  const scenario = getScenarioText(profile);
  const speakerMode = getSpeakerModelName(profile);
  const localAreaScopeText = profile.scenario === "auditorium" ? "舞台区域扩声 + 后排线上拾音" : "讲台区域扩声 + 后排线上拾音";
  const amplificationScopeText = isOversizedForFullRoomAmplification(profile)
    ? `${getAmplificationScopeText(profile)}（方案按${getEffectiveAmplificationScope(profile) === "podium" ? localAreaScopeText : getAmplificationScopeText(profile)}落地）`
    : getAmplificationScopeText(profile);
  const acoustic = input.acousticAssessment;
  const customerConnectionLines = getCustomerVisibleConnectionLines(input.connectionLines);
  const sections: ReportSection[] = [
    {
      id: "cover",
      type: "cover",
      title: profile.projectName || "音翼教室音频方案",
      body: `${yiouBrand.fullName}\n客户：${profile.customerName || "待补充"}\n产品范围：智能天花阵列麦克风 / 吸顶音箱 / 音柱 / 无线手持麦 / 教学模拟功放主机\n图纸格式：PNG 图片\n生成时间：${date}`
    },
    {
      id: "profile",
      type: "summary",
      title: "项目档案",
      body: `使用场景：${scenario}\n核心需求：${needs}\n教室尺寸：${profile.roomGeometry.length}m x ${profile.roomGeometry.width}m x ${profile.roomGeometry.height}m\n面积：${getRoomArea(profile).toFixed(1)} 平方米\n本地扩声范围：${amplificationScopeText}\n扩声形态：${speakerMode}`
    },
    {
      id: "acoustic",
      type: "list",
      title: "声学环境与混响判断",
      bullets: [
        `地面：${floorMaterialLabels[profile.acousticEnvironment.floorMaterial]}`,
        `墙面：${wallMaterialLabels[profile.acousticEnvironment.wallMaterial]}`,
        `顶面吸声：${ceilingAcousticTreatmentLabels[profile.acousticEnvironment.ceilingAcousticTreatment ?? "unknown"]}`,
        `软装 / 吸音：${softTreatmentLabels[profile.acousticEnvironment.softTreatment]}`,
        `玻璃比例：${glassCoverageLabels[profile.acousticEnvironment.glassCoverage ?? (profile.acousticEnvironment.hasGlassWall ? "large" : "none")]}`,
        `家具布置：${furnishingDensityLabels[profile.acousticEnvironment.furnishingDensity]}`,
        `拍手测试：${echoObservationLabels[profile.acousticEnvironment.echoObservation ?? "unknown"]}`,
        profile.acousticEnvironment.measuredRt60
          ? `RT60：实测 ${profile.acousticEnvironment.measuredRt60.toFixed(2)}s`
          : `RT60：估算 ${acoustic.estimatedRt.toFixed(2)}s（${acoustic.estimatedRtRange.min.toFixed(2)}-${acoustic.estimatedRtRange.max.toFixed(2)}s）`,
        `混响判断：${acoustic.label}`,
        "混响风险会影响阵麦拾音清晰度。"
      ]
    },
    {
      id: "selection",
      type: "table",
      title: "推荐方案与设备清单",
      rows: input.productSelection.map((item) => ({
        设备: item.name,
        数量: item.quantity
      }))
    },
    {
      id: "installation-guide",
      type: "table",
      title: "点位施工交底表",
      rows: input.installationGuide.map((item) => ({
        点位: item.point,
        位置: item.location,
        高度: item.installHeight,
        朝向: item.orientation,
        避让: item.avoidance,
        验收: item.acceptance
      }))
    },
    {
      id: "connections",
      type: "table",
      title: "接口接线表",
      rows: customerConnectionLines.map((line) => ({
        源设备: line.fromDevice,
        源接口: line.fromPort,
        目标设备: line.toDevice,
        目标接口: line.toPort,
        线材: line.cableType
      }))
    },
    ...input.drawings.map((drawing) => ({
      id: drawing.type,
      type: "drawing" as const,
      title: drawing.title,
      drawingType: drawing.type,
      bullets: ["图纸点位会影响现场安装位置。"]
    })),
    {
      id: "risks",
      type: "list",
      title: "风险提示",
      bullets: input.riskItems.length ? input.riskItems : ["接口和声场条件会影响最终落地效果。"]
    },
    {
      id: "review",
      type: "list",
      title: "复勘确认项",
      bullets: input.reviewItems
    }
  ];

  const pdfReportModel: PdfReportModel = {
    title: profile.projectName || "音翼教室音频方案",
    subtitle: "售前工程方案报告",
    generatedAt: date,
    sections
  };

  return {
    pdfReportModel,
    reportText: sections
      .map((section) => {
        const content = [
          `# ${section.title}`,
          section.body,
          section.bullets?.map((item) => `- ${item}`).join("\n"),
          section.rows
            ?.map((row) =>
              Object.entries(row)
                .map(([key, value]) => `${key}：${value}`)
                .join("；")
            )
            .join("\n")
        ]
          .filter(Boolean)
          .join("\n");
        return content;
      })
      .join("\n\n")
  };
};
