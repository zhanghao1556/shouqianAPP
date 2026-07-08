export type Need =
  | "videoConference"
  | "interactiveClass"
  | "localAmplification"
  | "recording"
  | "remoteTeaching"
  | "wirelessMic"
  | "other";

export type Scenario = "meetingRoom" | "standardClassroom" | "lectureClassroom" | "auditorium" | "combinedClassroom" | "other";
export type AmplificationScope = "podium" | "full";
export type PodiumPosition = "frontCenter" | "frontLeft" | "frontRight" | "unknown";
export type CeilingType = "suspended" | "exposed" | "unknown";
export type AuditoriumRearFillSpeakerStatus = "present" | "absent" | "unknown";
export type FloorMaterial = "tile" | "wood" | "carpet" | "unknown";
export type WallMaterial = "painted" | "hard" | "acoustic" | "unknown";
export type SoftTreatment = "none" | "curtains" | "acousticPanels" | "mixed" | "unknown";
export type FurnishingDensity = "empty" | "normal" | "dense" | "unknown";
export type ReverberationRisk = "low" | "medium" | "high";
export type GeneratedPointType = "arrayMic" | "speaker";
export type ProductCategory = "pickup" | "speaker" | "wireless" | "amplifier";
export type ReportSectionType = "cover" | "summary" | "table" | "drawing" | "list";
export type DrawingType = "installation" | "wiring" | "topology" | "system";
export type LegacySpeakerType = "ceiling" | "wall";
export type LegacyWallAdjustability = "universal" | "fixed" | "unknown";
export type SpeakerProductOverride = "auto" | "ceiling" | "wall";

export interface RoomGeometry {
  length: number;
  width: number;
  height: number;
  scale: number;
  coordinateUnit: "meter";
}

export interface Point {
  x: number;
  y: number;
}

export interface ExistingDevices {
  recordingHost: string;
  computer: string;
  legacySoundSystem: string;
  legacyWirelessMic: string;
  legacySpeakerPoints: LegacySpeakerPoint[];
}

export interface EngineeringConstraints {
  ceiling: CeilingType;
  podiumPosition: PodiumPosition;
  stageSize: {
    width: number;
    depth: number;
  };
  teachingAreaSize: {
    width: number;
    depth: number;
  };
  hasCentralAirConditioner: boolean;
  centralAirConditionerCount: number;
  centralAirConditionerPoints: CentralAirConditionerPoint[];
  auditoriumRearFillSpeakers?: AuditoriumRearFillSpeakerStatus;
  speakerProductOverride?: SpeakerProductOverride;
  notes: string;
}

export interface AcousticEnvironment {
  floorMaterial: FloorMaterial;
  wallMaterial: WallMaterial;
  softTreatment: SoftTreatment;
  furnishingDensity: FurnishingDensity;
  hasGlassWall: boolean;
}

export interface ClassroomProfile {
  scenario: Scenario;
  customScenario: string;
  customNeed: string;
  amplificationScope: AmplificationScope;
  projectName: string;
  customerName: string;
  needs: Need[];
  roomGeometry: RoomGeometry;
  existingDevices: ExistingDevices;
  engineeringConstraints: EngineeringConstraints;
  acousticEnvironment: AcousticEnvironment;
}

export interface CompletenessItem {
  key: string;
  label: string;
  complete: boolean;
  blocking: boolean;
  hint: string;
}

export interface GeneratedPoint {
  id: string;
  type: GeneratedPointType;
  label: string;
  position: Point;
  installHeight?: number;
  installHeightBase?: number;
  installHeightOffset?: number;
  horizontalAngle?: number;
  downTiltAngle?: number;
  coverageRadius?: number;
  afcSendLevelOffset?: number;
  target?: Point;
  reason: string;
}

export interface LegacySpeakerPoint {
  id: string;
  label: string;
  type: LegacySpeakerType;
  position: Point;
  wallAdjustability?: LegacyWallAdjustability;
  target?: Point;
}

export interface CentralAirConditionerPoint {
  id: string;
  label: string;
  position: Point;
  size: {
    width: number;
    depth: number;
  };
}

export interface ProductRecommendation {
  productId: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  why: string;
  where: string;
  wiring: string;
  basis: string;
  missingConfirmation?: string;
}

export type QuantityOverrides = Record<string, number>;

export interface ConnectionLine {
  id: string;
  fromDevice: string;
  fromPort: string;
  toDevice: string;
  toPort: string;
  cableType: string;
  note: string;
}

export interface EngineeringBasis {
  item: string;
  basis: string;
  result: string;
}

export interface InstallationGuideItem {
  id: string;
  point: string;
  location: string;
  installHeight: string;
  orientation: string;
  avoidance: string;
  acceptance: string;
}

export interface AudioPlan {
  mode: string;
  summary: string;
  pickupGoal: string;
  amplificationGoal: string;
  areaBoundary: string;
  environmentBoundary: string;
  tuning: string[];
}

export interface AcousticAssessment {
  risk: ReverberationRisk;
  score: number;
  label: string;
  reasons: string[];
  suggestions: string[];
}

export interface DrawingModel {
  title: string;
  type: DrawingType;
  notes: string[];
}

export interface ReportSection {
  id: string;
  type: ReportSectionType;
  title: string;
  body?: string;
  rows?: Array<Record<string, string | number>>;
  bullets?: string[];
  drawingType?: DrawingModel["type"];
}

export interface PdfReportModel {
  title: string;
  subtitle: string;
  generatedAt: string;
  sections: ReportSection[];
}

export interface GeneratedOutputs {
  isFinalReady: boolean;
  completeness: CompletenessItem[];
  generatedPoints: GeneratedPoint[];
  connectionLines: ConnectionLine[];
  productSelection: ProductRecommendation[];
  engineeringBasis: EngineeringBasis[];
  installationGuide: InstallationGuideItem[];
  audioPlan: AudioPlan;
  acousticAssessment: AcousticAssessment;
  riskItems: string[];
  reviewItems: string[];
  drawings: DrawingModel[];
  pdfReportModel: PdfReportModel;
  reportText: string;
}
