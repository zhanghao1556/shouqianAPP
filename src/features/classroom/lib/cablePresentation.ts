export type CableMaterialKind = "speaker" | "audio" | "serial" | "network" | "usb" | "other";

export const CABLE_MATERIAL_COLORS: Record<CableMaterialKind, string> = {
  speaker: "#b45309",
  audio: "#0f766e",
  serial: "#7c3aed",
  network: "#2563eb",
  usb: "#eab308",
  other: "#475569"
};

export const CABLE_MATERIAL_LABELS: Record<Exclude<CableMaterialKind, "other">, string> = {
  speaker: "音箱线",
  audio: "音频线",
  serial: "232线",
  network: "网线",
  usb: "USB线"
};

export function getCableMaterialKind(cableType: string): CableMaterialKind {
  if (/网线|T568B|超五类|超六类/i.test(cableType)) return "network";
  if (/USB/i.test(cableType)) return "usb";
  if (/232/i.test(cableType)) return "serial";
  if (cableType.includes("音箱线")) return "speaker";
  if (/音频(?:跳)?线|话筒线/i.test(cableType)) return "audio";
  return "other";
}

export function getCableMaterialColor(cableType: string) {
  return CABLE_MATERIAL_COLORS[getCableMaterialKind(cableType)];
}

export function getCableMaterialLabel(cableType: string) {
  const kind = getCableMaterialKind(cableType);
  return kind === "other" ? cableType : CABLE_MATERIAL_LABELS[kind];
}
