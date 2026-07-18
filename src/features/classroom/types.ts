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
export type CeilingAcousticTreatment = "hard" | "partial" | "acoustic" | "unknown";
export type GlassCoverage = "none" | "partial" | "large" | "unknown";
export type EchoObservation = "none" | "tail" | "obvious" | "unknown";
export type ReverberationRisk = "low" | "medium" | "high";
export type AcousticAssessmentSource = "measured" | "estimated";
export type AcousticAssessmentConfidence = "high" | "medium" | "low";
export type GeneratedPointType = "arrayMic" | "speaker";
export type ProductCategory = "pickup" | "speaker" | "wireless" | "processor" | "amplifier" | "accessory";
export type ReportSectionType = "cover" | "summary" | "table" | "drawing" | "list";
export type DrawingType = "installation" | "wiring" | "topology" | "system";
export type LegacySpeakerType = "ceiling" | "wall";
export type LegacyWallAdjustability = "universal" | "fixed" | "unknown";
export type SpeakerProductOverride = "auto" | "ceiling" | "wall";
export type MicrophoneSolution = "auto" | "existingArray" | "lineArray" | "hangingMic" | "smallDisc01" | "smallDisc03";
export type SmallDiscConnectionMode = "auto" | "usb" | "extender";
export type OverheadSpeakerMounting = "available" | "unavailable" | "unknown";
export type LineArrayMode = "auto" | "front" | "full";
export type LineArrayInstallation = "auto" | "podium" | "hanging";
export type ProcessorTier = "auto" | "twoMic" | "sixMic" | "highPerformance";

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
  microphoneSolution?: MicrophoneSolution;
  overheadSpeakerMounting?: OverheadSpeakerMounting;
  hasPodium?: boolean;
  lineArrayMode?: LineArrayMode;
  lineArrayInstallation?: LineArrayInstallation;
  processorTier?: ProcessorTier;
  smallDiscConnectionMode?: SmallDiscConnectionMode;
  notes: string;
}

export interface AcousticEnvironment {
  floorMaterial: FloorMaterial;
  wallMaterial: WallMaterial;
  softTreatment: SoftTreatment;
  furnishingDensity: FurnishingDensity;
  hasGlassWall: boolean;
  ceilingAcousticTreatment?: CeilingAcousticTreatment;
  glassCoverage?: GlassCoverage;
  echoObservation?: EchoObservation;
  measuredRt60?: number;
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

export type SpeakerSignalMode = "afc" | "withoutLineArrayAfc";

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
  pickupKind?: "existingArray" | "lineArray" | "hangingMic" | "smallDisc01" | "smallDisc02" | "smallDisc03";
  pickupPattern?: "front180" | "full360";
  installationMode?: "podium" | "hanging" | "tabletop";
  speakerSignalMode?: SpeakerSignalMode;
  afcSendLevelOffset?: number;
  target?: Point;
  responsibilityEdgeCoverage?: {
    covered: number;
    total: number;
  };
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
  speakerSignalMode?: SpeakerSignalMode;
  afcSendLevelOffset?: number;
}

export type InterfacePortDirection = "input" | "output" | "bidirectional";
export type InterfaceWiringFindingSeverity = "info" | "review" | "hard";
export type InterfaceTerminalRole = "positive" | "negative" | "ground" | "pin" | "signal";

export interface DevicePortTerminal {
  id: string;
  label: string;
  role: InterfaceTerminalRole;
  color: string;
}

export interface DevicePortVisualAnchor {
  x: number;
  y: number;
  terminalAnchors?: Record<string, { x: number; y: number }>;
}

export interface DeviceInterfacePanel {
  assetKey: string;
  aspectRatio: number;
  confirmed: boolean;
  source: string;
  portAnchors: Record<string, DevicePortVisualAnchor>;
}

export interface DevicePortCapability {
  id: string;
  panelLabel: string;
  interfaceType: string;
  direction: InterfacePortDirection;
  maxConnections: number;
  confirmed: boolean;
  source: string;
  terminals: DevicePortTerminal[];
  physicalGroupId?: string;
}

export interface DevicePortProfile {
  productId: string;
  internalModel?: string;
  customerName: string;
  ports: DevicePortCapability[];
  interfacePanel?: DeviceInterfacePanel;
}

export interface InterfaceWiringPort {
  id: string;
  capabilityId: string;
  label: string;
  interfaceType: string;
  direction: InterfacePortDirection;
  peerNodeId: string;
  peerPortLabel: string;
  cableType: string;
  connectionMethod: string;
  confirmed: boolean;
  terminals: DevicePortTerminal[];
  physicalGroupId?: string;
}

export interface InterfaceWiringConductor {
  id: string;
  label: string;
  color: string;
  fromTerminalId: string;
  fromTerminalLabel: string;
  toTerminalId: string;
  toTerminalLabel: string;
  confirmed: boolean;
}

export interface InterfaceWiringCascade {
  segments: number;
  label: string;
  fromPortLabel: string;
  toPortLabel: string;
  cableType: string;
}

export interface InterfaceWiringNode {
  id: string;
  productId: string;
  label: string;
  internalModel?: string;
  category: "microphone" | "processor" | "extender" | "amplifier" | "speaker" | "external";
  quantity: number;
  level: 1 | 2 | 3;
  parentId?: string;
  ports: InterfaceWiringPort[];
  cascade?: InterfaceWiringCascade;
}

export interface InterfaceWiringEdge {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  cableType: string;
  connectionMethod: string;
  signalDirection: "fromTo" | "bidirectional";
  quantity: number;
  conductors: InterfaceWiringConductor[];
}

export interface InterfaceWiringFinding {
  code: string;
  severity: InterfaceWiringFindingSeverity;
  title: string;
  message: string;
  nodeId?: string;
}

export interface InterfaceWiringModel {
  title: string;
  status: "ready" | "review" | "blocked";
  rootNodeId?: string;
  nodes: InterfaceWiringNode[];
  edges: InterfaceWiringEdge[];
  findings: InterfaceWiringFinding[];
  candidateProcessor?: "AJ200" | "AJ350" | "AJ600";
  generatedFrom: "calibrationCandidate";
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
  label: string;
  source: AcousticAssessmentSource;
  confidence: AcousticAssessmentConfidence;
  roomVolume: number;
  targetRt: number;
  highRiskRt: number;
  estimatedRt: number;
  estimatedRtRange: {
    min: number;
    max: number;
  };
  reference: string;
  factors: Array<{
    label: string;
    impact: "strongIncrease" | "slightIncrease" | "neutral" | "slightDecrease" | "strongDecrease";
    detail: string;
  }>;
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

export type PointValidationSeverity = "info" | "warning" | "error" | "hard";

export interface PointValidationFinding {
  code: string;
  severity: PointValidationSeverity;
  title: string;
  actual?: string | number;
  limit?: string | number;
  internalMessage: string;
  customerMessage?: string;
  sourceRefs: string[];
}

export interface PointValidationResult {
  status: "pass" | "review" | "hard";
  findings: PointValidationFinding[];
  hardCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  customerMessage?: string;
}

export interface CustomerSolutionChoice<T extends string> {
  recommended: T;
  selected: T;
  userSelected: boolean;
  isNonRecommended: boolean;
  selectedLabel: string;
  recommendedLabel: string;
  advantages: string;
  cautions: string;
  recommendationReason: string;
  decisionFactors: string[];
}

export interface CustomerSolutionSelection {
  microphone: CustomerSolutionChoice<Exclude<MicrophoneSolution, "auto">> & {
    lineArraySupported: boolean;
    lineArrayCoverageWarning?: string;
    hangingMicCapacityWarning?: string;
    smallDiscReviewWarning?: string;
  };
  speaker: CustomerSolutionChoice<Exclude<SpeakerProductOverride, "auto">> & {
    requiresSpecialReview: boolean;
  };
  processor?: CustomerSolutionChoice<Exclude<ProcessorTier, "auto">> & {
    alternative: "twoMic" | "sixMic";
    alternativeLabel: string;
    interfaceDemand: number;
  };
  drawingBlocked: boolean;
  blockingCode?: "smallDisc01Interfaces";
  blockingMessage?: string;
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
  pointValidation: PointValidationResult;
  solutionSelection: CustomerSolutionSelection;
}
