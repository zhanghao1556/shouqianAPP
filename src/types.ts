import type { ReactNode } from "react";

export type Scenario = "meeting" | "classroom" | "lecture" | "auditorium" | "other";
export type Need =
  | "videoConference"
  | "interactiveClass"
  | "localAmplification"
  | "recording"
  | "wirelessMic"
  | "remoteTeaching"
  | "other";

export type QuestionType = "single" | "multiple" | "numberGroup" | "spatial" | "text";
export type ProductCategory = "processor" | "pickup" | "speaker" | "amplifier" | "wireless" | "accessory";
export type BudgetLevel = "standard" | "balanced" | "premium";

export interface SpaceInfo {
  length?: number;
  width?: number;
  height?: number;
  ceiling?: "yes" | "no" | "unknown";
  podium?: "front" | "center" | "side" | "none" | "unknown";
  acPositions: string[];
  glassWalls: string[];
  externalDevices: string[];
}

export interface ProjectProfile {
  scenario?: Scenario;
  needs: Need[];
  space: SpaceInfo;
  constraints: {
    budgetLevel?: BudgetLevel;
    installLimitations: string[];
    notes: string;
  };
}

export interface QuestionOption<TValue extends string = string> {
  label: string;
  value: TValue;
  helper?: string;
}

export interface QuestionStep {
  id: string;
  title: string;
  type: QuestionType;
  options?: QuestionOption[];
  requiredFields: string[];
  next: (profile: ProjectProfile) => string | null;
}

export interface ProductRule {
  productId: string;
  name: string;
  category: ProductCategory;
  matchedScenarios: Scenario[];
  matchedNeeds: Need[];
  source: string;
  quantityRule: (profile: ProjectProfile) => number;
  reason: (profile: ProjectProfile) => string;
}

export interface ProductSelection {
  productId: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  reason: string;
  source: string;
}

export interface QuantityRow {
  item: string;
  quantity: number | string;
  basis: string;
}

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: ProductCategory | "room" | "device" | "cable";
}

export interface DiagramEdge {
  from: string;
  to: string;
  label: string;
}

export interface DiagramSpec {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  note: string;
}

export interface GeneratedOutputs {
  productSelection: ProductSelection[];
  quantityTable: QuantityRow[];
  installationMap: DiagramSpec;
  wiringDiagram: DiagramSpec;
  topologyDiagram: DiagramSpec;
  cablingPlan: string[];
  projectReport: string;
  warnings: string[];
}

export interface AiAdvisor {
  getNextPrompt: (profile: ProjectProfile, missingFields: string[]) => string;
  summarizeProfile: (profile: ProjectProfile) => string;
  polishReport: (reportDraft: string) => string;
}

export interface OutputTab {
  id: string;
  label: string;
  icon: ReactNode;
}
