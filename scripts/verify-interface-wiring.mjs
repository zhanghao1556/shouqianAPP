import { build } from "esbuild";

const testModule = String.raw`
import assert from "node:assert/strict";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { generateEngineeringOutputs } from "./src/features/classroom/lib/engineeringRules.ts";
import { buildInterfaceWiringModel, getInterfacePanelPortAnchor, getInterfaceWiringLayout } from "./src/features/classroom/lib/interfaceWiring.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { LINE_ARRAY_PRODUCT_ID } from "./src/features/classroom/lib/lineArrayRules.ts";
import {
  PROCESSOR_AJ600_PORT_PROFILE_ID,
  PASSIVE_SPEAKER_PORT_PROFILE_ID,
  WIRELESS_RECEIVER_PORT_PROFILE_ID,
  devicePortCatalog,
  getDevicePortProfile
} from "./src/features/classroom/lib/devicePortCatalog.ts";
import { PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID } from "./src/features/classroom/lib/systemCapabilities.ts";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAIN_NAME
} from "./src/features/classroom/lib/yinmanSmallDiscRules.ts";

function makeProfile({
  scenario = "standardClassroom",
  length = 10,
  width = 8,
  height = 3,
  needs = ["localAmplification"],
  scope = "full",
  microphoneSolution = "existingArray",
  teachingWidth = width,
  teachingDepth = 4,
  computer = "",
  recordingHost = "",
  legacyWirelessMic = "",
  speakerProductOverride = "wall",
  processorTier = "auto",
  smallDiscConnectionMode = "auto",
  measuredRt60
} = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario,
    needs,
    amplificationScope: scope,
    roomGeometry: { length, width, height },
    existingDevices: {
      ...base.existingDevices,
      computer,
      recordingHost,
      legacyWirelessMic
    },
    acousticEnvironment: { ...base.acousticEnvironment, measuredRt60 },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      microphoneSolution,
      processorTier,
      smallDiscConnectionMode,
      speakerProductOverride,
      overheadSpeakerMounting: "available",
      teachingAreaSize: { width: teachingWidth, depth: teachingDepth }
    }
  });
}

function buildModel(profile, overrides = {}) {
  const outputs = generateEngineeringOutputs(profile, overrides, "yinman");
  return {
    outputs,
    model: buildInterfaceWiringModel({ profile, outputs, brandId: "yinman" })
  };
}

function node(model, id) {
  const value = model.nodes.find((item) => item.id === id);
  assert.ok(value, "Missing wiring node " + id);
  return value;
}

function processorPortLabels(model) {
  return node(model, "processor").ports.map((port) => port.label);
}

function assertNoDuplicatePortOccupancy(model) {
  for (const wiringNode of model.nodes) {
    const capabilityIds = wiringNode.ports.map((port) => port.capabilityId);
    assert.equal(new Set(capabilityIds).size, capabilityIds.length, "Duplicate occupied port on " + wiringNode.id);
  }
  const endpointIds = model.edges.flatMap((edge) => [edge.fromPortId, edge.toPortId]);
  assert.equal(new Set(endpointIds).size, endpointIds.length, "One physical port was assigned to multiple edges");
}

function assertNoPowerEdges(model) {
  assert.doesNotMatch(
    JSON.stringify(model.edges.map((edge) => [edge.cableType, edge.connectionMethod])),
    /POWER|AC\s*220|DC\s*12|电源|适配器/i
  );
}

const ringProfiles = Array.from({ length: 18 }, (_, index) => makeProfile({
  length: 6 + index,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "existingArray"
}));
const ringCases = new Map();
for (const profile of ringProfiles) {
  const result = buildModel(profile);
  const count = result.outputs.productSelection.find((item) => item.productId === PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID)?.quantity ?? 0;
  if ((count === 1 || count === 2) && !ringCases.has(count)) ringCases.set(count, result);
}
assert.ok(ringCases.has(1), "No one-RING08 fixture was found");
assert.ok(ringCases.has(2), "No two-RING08 fixture was found");
for (const count of [1, 2]) {
  const model = ringCases.get(count).model;
  assert.equal(model.candidateProcessor, "AJ350");
  assert.equal(node(model, "ring08").quantity, count);
  assert.deepEqual(
    processorPortLabels(model).filter((label) => label === "A1" || label === "A2"),
    count === 1 ? ["A1"] : ["A1", "A2"]
  );
}
console.log("PASS RING08 uses one AJ350 and A1/A2 for one or two microphones");

const singleLineProfile = makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "lineArray"
});
const singleLine = buildModel(singleLineProfile, { "COLUMN-SPEAKER": 2 });
assert.equal(singleLine.outputs.productSelection.find((item) => item.productId === LINE_ARRAY_PRODUCT_ID)?.quantity, 1);
assert.equal(singleLine.model.candidateProcessor, "AJ350");
assert.equal(singleLine.model.nodes.some((item) => item.id === "line-array-converter"), false);
assert.ok(processorPortLabels(singleLine.model).includes("AMIC"));
assert.equal(node(singleLine.model, "line-array").parentId, "processor");
console.log("PASS one SA110 directly uses AJ350 AMIC");

const oneLineWith02Profile = makeProfile({
  length: 12.4,
  width: 7.4,
  height: 3.1,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  measuredRt60: 0.4
});
const oneLineWith02 = buildModel(oneLineWith02Profile);
assert.equal(oneLineWith02.outputs.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 1);
assert.equal(oneLineWith02.outputs.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 1);
assert.equal(oneLineWith02.model.candidateProcessor, "AJ200");
assert.equal(node(oneLineWith02.model, "line-array-converter").quantity, 1);
assert.equal(node(oneLineWith02.model, "line-array").parentId, "line-array-converter");
assert.deepEqual(
  processorPortLabels(oneLineWith02.model).filter((label) => label === "MIC1" || label === "MIC2" || label === "EXTMIC").sort(),
  ["EXTMIC", "MIC1", "MIC2"]
);
console.log("PASS one SA110 plus 02 uses AJ200, one line-array extender, MIC1/MIC2 and EXTMIC");

const twoLineProfile = makeProfile({
  scenario: "combinedClassroom",
  length: 8,
  width: 14,
  scope: "podium",
  microphoneSolution: "lineArray",
  teachingWidth: 14,
  teachingDepth: 5
});
const twoLine = buildModel(twoLineProfile);
assert.equal(twoLine.outputs.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2);
assert.equal(twoLine.outputs.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 0);
assert.equal(twoLine.model.candidateProcessor, "AJ600");
assert.equal(node(twoLine.model, "line-array-converter").quantity, 1);
assert.deepEqual(
  processorPortLabels(twoLine.model).filter((label) => label === "MIC1" || label === "MIC2" || label === "EXTMIC").sort(),
  ["EXTMIC", "MIC1", "MIC2"]
);
console.log("PASS two SA110 without 02 use AJ600 with one EXTMIC direct path and one extender");

const twoLineWith02Profile = makeProfile({
  scenario: "combinedClassroom",
  length: 12,
  width: 14,
  needs: ["interactiveClass"],
  scope: "podium",
  microphoneSolution: "lineArray",
  teachingWidth: 14,
  teachingDepth: 5,
  measuredRt60: 0.4
});
const supplementProductTemplate = oneLineWith02.outputs.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID);
const supplementPointTemplate = oneLineWith02.outputs.generatedPoints.find((point) => point.pickupKind === "smallDisc02");
assert.ok(supplementProductTemplate);
assert.ok(supplementPointTemplate);
const twoLineWith02Outputs = {
  ...twoLine.outputs,
  productSelection: [
    ...twoLine.outputs.productSelection.filter((item) => item.productId !== SMALL_DISC_02_PRODUCT_ID),
    { ...supplementProductTemplate, quantity: 2 }
  ],
  generatedPoints: [
    ...twoLine.outputs.generatedPoints,
    { ...supplementPointTemplate, id: "test-small-disc-02-1", position: { x: 4.6, y: 7.2 } },
    { ...supplementPointTemplate, id: "test-small-disc-02-2", position: { x: 9.4, y: 7.2 } }
  ]
};
const twoLineWith02 = {
  outputs: twoLineWith02Outputs,
  model: buildInterfaceWiringModel({ profile: twoLineWith02Profile, outputs: twoLineWith02Outputs, brandId: "yinman" })
};
assert.equal(twoLineWith02.outputs.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2);
assert.ok(twoLineWith02.outputs.generatedPoints.some((point) => point.pickupKind === "smallDisc02"));
assert.equal(twoLineWith02.model.candidateProcessor, "AJ600");
assert.equal(node(twoLineWith02.model, "line-array-converter").quantity, 2);
assert.equal(twoLineWith02.model.edges.filter((edge) => edge.id.startsWith("line-array-converter-link-")).length, 2);
assert.equal(twoLineWith02.model.edges.filter((edge) => edge.id.startsWith("line-array-converter-mic-")).length, 4);
assert.deepEqual(
  processorPortLabels(twoLineWith02.model).filter((label) => /^MIC[1-4]$/.test(label) || label === "EXTMIC").sort(),
  ["EXTMIC", "MIC1", "MIC2", "MIC3", "MIC4"]
);
console.log("PASS two SA110 plus 02 use AJ600, two extenders, MIC1-MIC4 and one EXTMIC chain");

const smallDisc01Profile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  recordingHost: "录播主机",
  smallDiscConnectionMode: "usb"
});
const smallDisc01 = buildModel(smallDisc01Profile);
assert.equal(smallDisc01.outputs.productSelection.find((item) => item.productId === SMALL_DISC_01_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01.outputs.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity, 3);
assert.equal(smallDisc01.outputs.productSelection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01.model.rootNodeId, "small-disc-01");
assert.equal(node(smallDisc01.model, "small-disc-extender").level, 2);
assert.equal(node(smallDisc01.model, "small-disc-02").cascade?.label, "级联 ×3");
const smallDisc01Recording = smallDisc01.model.nodes.find((item) => item.label === "录播主机");
assert.ok(smallDisc01Recording);
assert.equal(smallDisc01Recording.level, 3);
assert.equal(smallDisc01Recording.parentId, "small-disc-extender");

const smallDisc03Profile = makeProfile({
  length: 10,
  width: 10,
  needs: ["recording"],
  scope: "podium",
  microphoneSolution: "smallDisc03",
  recordingHost: "录播主机"
});
const smallDisc03 = buildModel(smallDisc03Profile);
assert.equal(smallDisc03.outputs.productSelection.find((item) => item.productId === SMALL_DISC_03_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc03.model.rootNodeId, "small-disc-03");
assert.equal(node(smallDisc03.model, "small-disc-extender").level, 2);
const smallDisc03Recording = smallDisc03.model.nodes.find((item) => item.label === "录播主机");
assert.ok(smallDisc03Recording);
assert.equal(smallDisc03Recording.level, 3);
console.log("PASS 01/03 remain level-one roots and the 01 extender remains a separate level-two device");

const smallDiscUsbProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  recordingHost: "录播主机、录播摄像机、中控主机",
  smallDiscConnectionMode: "usb"
});
const smallDiscUsb = buildModel(smallDiscUsbProfile);
const usbEdge = smallDiscUsb.model.edges.find((edge) => edge.id.includes("small-disc-01-usb-host"));
assert.ok(usbEdge);
assert.match(node(smallDiscUsb.model, usbEdge.toNodeId).label, /电脑|一体机/);
const invalidUsbOutputs = {
  ...smallDiscUsb.outputs,
  connectionLines: [
    ...smallDiscUsb.outputs.connectionLines,
    {
      id: "test-invalid-usb-target",
      fromDevice: SMALL_DISC_MAIN_NAME,
      fromPort: "USB数字音频接口",
      toDevice: "录播主机",
      toPort: "USB音频接口",
      cableType: "USB音频线",
      note: "测试非法USB目标"
    }
  ]
};
const invalidUsbModel = buildInterfaceWiringModel({
  profile: smallDiscUsbProfile,
  outputs: invalidUsbOutputs,
  brandId: "yinman"
});
assert.ok(invalidUsbModel.findings.some((item) => item.code.startsWith("usb.invalid-target") && item.severity === "hard"));
assert.equal(invalidUsbModel.edges.some((edge) => edge.id.includes("test-invalid-usb-target")), false);
console.log("PASS USB audio only connects to a computer or all-in-one and invalid targets are blocked");

const unknownPortProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["videoConference"],
  scope: "podium",
  microphoneSolution: "lineArray",
  computer: "讲台电脑",
  recordingHost: "中控主机"
});
const unknownPort = buildModel(unknownPortProfile);
assert.ok(unknownPort.model.findings.some((item) => item.code.startsWith("external-port.") && item.severity === "review"));
assert.ok(unknownPort.model.nodes.some((item) => item.ports.some((port) => !port.confirmed && port.label.includes("需复核"))));
console.log("PASS unknown external interfaces stay visible as review items without blocking generation");

const overflowLines = Array.from({ length: 5 }, (_, index) => ({
  id: "test-line-out-" + (index + 1),
  fromDevice: "智能音频处理主机",
  fromPort: "Line Out / 模拟输出",
  toDevice: "外接音频终端" + (index + 1),
  toPort: "音频输入",
  cableType: "音频线",
  note: "接口容量测试"
}));
const overflowOutputs = {
  ...singleLine.outputs,
  connectionLines: [...singleLine.outputs.connectionLines, ...overflowLines]
};
const overflowModel = buildInterfaceWiringModel({
  profile: singleLineProfile,
  outputs: overflowOutputs,
  brandId: "yinman"
});
assert.equal(overflowModel.candidateProcessor, "AJ350");
assert.ok(overflowModel.findings.some((item) => item.code.startsWith("port-capacity.processor.lineOut") && item.severity === "hard"));
assert.equal(overflowModel.edges.filter((edge) => edge.id.startsWith("candidate-test-line-out-")).length, 4);
console.log("PASS interface exhaustion stops excess edges and reports a hard capacity finding");

const speakerEdge = smallDisc01.model.edges.find((edge) => edge.cableType.includes("音箱线"));
assert.ok(speakerEdge, "No field-terminated speaker cable was generated");
assert.deepEqual(
  speakerEdge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalLabel, conductor.toTerminalLabel]),
  [["红线", "+", "+"], ["白线", "-", "-"]]
);
console.log("PASS speaker cable maps red + to + and white - to -");

const hangingProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "hangingMic",
  teachingWidth: 8,
  teachingDepth: 4
});
const hanging = buildModel(hangingProfile);
const balancedEdge = hanging.model.edges.find((edge) => edge.id.startsWith("hanging-mic-"));
assert.ok(balancedEdge, "No hanging-microphone balanced cable was generated");
assert.deepEqual(
  balancedEdge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalLabel, conductor.toTerminalLabel]),
  [["红线", "2 (+)", "+"], ["白线", "3 (-)", "-"], ["屏蔽线", "1 (G)", "G"]]
);
console.log("PASS balanced microphone cable maps positive, negative and ground conductors");

const rj45Edge = ringCases.get(1).model.edges.find((edge) => edge.conductors.length === 8);
assert.ok(rj45Edge, "No T568B network cable was generated");
assert.deepEqual(
  rj45Edge.conductors.map((conductor, index) => [conductor.fromTerminalId, conductor.toTerminalId, conductor.label, index + 1]),
  Array.from({ length: 8 }, (_, index) => ["pin" + (index + 1), "pin" + (index + 1), (index + 1) + " " + ["白橙", "橙", "白绿", "蓝", "白蓝", "绿", "白棕", "棕"][index], index + 1])
);
console.log("PASS T568B network cable maps pins 1-8 straight through");

for (const profile of Object.values(devicePortCatalog)) {
  if (!profile.interfacePanel) continue;
  for (const [portId, portAnchor] of Object.entries(profile.interfacePanel.portAnchors)) {
    assert.ok(portAnchor.x >= 0 && portAnchor.x <= 1, profile.productId + ":" + portId + " x anchor is outside the panel");
    assert.ok(portAnchor.y >= 0 && portAnchor.y <= 1, profile.productId + ":" + portId + " y anchor is outside the panel");
    for (const [terminalId, terminalAnchor] of Object.entries(portAnchor.terminalAnchors ?? {})) {
      assert.ok(terminalAnchor.x >= 0 && terminalAnchor.x <= 1, profile.productId + ":" + portId + ":" + terminalId + " x anchor is outside the panel");
      assert.ok(terminalAnchor.y >= 0 && terminalAnchor.y <= 1, profile.productId + ":" + portId + ":" + terminalId + " y anchor is outside the panel");
    }
  }
}
const aj600Profile = getDevicePortProfile(PROCESSOR_AJ600_PORT_PROFILE_ID);
assert.ok(aj600Profile?.interfacePanel);
assert.equal(aj600Profile.interfacePanel.assetKey, "aj600");
assert.match(aj600Profile.interfacePanel.source, /AJ600上面板/);
const aj600MicPorts = aj600Profile.ports.filter((port) => /^mic\d+$/.test(port.id));
assert.equal(aj600MicPorts.length, 6);
assert.deepEqual(new Set(aj600MicPorts.map((port) => port.physicalGroupId)), new Set(["mic-block"]));
const passiveSpeakerPanel = getDevicePortProfile(PASSIVE_SPEAKER_PORT_PROFILE_ID)?.interfacePanel;
assert.ok(passiveSpeakerPanel);
assert.equal(passiveSpeakerPanel.aspectRatio, 0.5);
assert.deepEqual([
  Number(passiveSpeakerPanel.portAnchors.terminals.x.toFixed(2)),
  Number(passiveSpeakerPanel.portAnchors.terminals.y.toFixed(2)),
  Number(passiveSpeakerPanel.portAnchors.terminals.terminalAnchors.positive.x.toFixed(2)),
  Number(passiveSpeakerPanel.portAnchors.terminals.terminalAnchors.negative.x.toFixed(2))
], [0.5, 0.64, 0.58, 0.42]);
assert.match(passiveSpeakerPanel.source, /完整背面接线线稿/);
const groupedSpeakerAnchors = Array.from({ length: 4 }, (_, index) =>
  getInterfacePanelPortAnchor(passiveSpeakerPanel, "terminals-direct-speaker-" + (index + 1), index, 4)
);
assert.deepEqual(groupedSpeakerAnchors.map((anchor) => [
  Number(anchor?.x.toFixed(2)),
  Number(anchor?.y.toFixed(2))
]), [
  [0.44, 0.6],
  [0.56, 0.6],
  [0.44, 0.68],
  [0.56, 0.68]
]);
const lineArrayPanel = getDevicePortProfile(LINE_ARRAY_PRODUCT_ID)?.interfacePanel;
assert.ok(lineArrayPanel);
assert.equal(lineArrayPanel.assetKey, "lineArray");
assert.deepEqual([
  Number(lineArrayPanel.portAnchors.rj45.x.toFixed(3)),
  Number(lineArrayPanel.portAnchors.rj45.y.toFixed(2))
], [0.505, 0.47]);
assert.match(lineArrayPanel.source, /用户提供SA110完整背面接线图/);
const wirelessReceiverPanel = getDevicePortProfile(WIRELESS_RECEIVER_PORT_PROFILE_ID)?.interfacePanel;
assert.ok(wirelessReceiverPanel);
assert.equal(wirelessReceiverPanel.assetKey, "wirelessReceiver");
assert.deepEqual(
  ["positive", "negative", "ground"].map((terminalId) => [
    terminalId,
    Number(wirelessReceiverPanel.portAnchors.balOut.terminalAnchors?.[terminalId].x.toFixed(3))
  ]),
  [["positive", 0.391], ["negative", 0.408], ["ground", 0.426]]
);
console.log("PASS interface-panel anchors are normalized, physical rear panels are mapped and grouped speakers use a 2x2 anchor grid");

assert.equal(singleLine.model.findings.some((item) => item.code === "interface-panel.missing.line-array"), false);
assert.ok(oneLineWith02.model.findings.some((item) => item.code === "interface-panel.missing.line-array-converter"));
assert.equal(smallDisc01.model.findings.some((item) => item.code === "interface-panel.missing.small-disc-extender"), false);
console.log("PASS missing and partial interface images create review findings while confirmed panels do not");

const crossingProfile = makeProfile({
  length: 14.3,
  width: 7.4,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "existingArray",
  computer: "讲台电脑",
  recordingHost: "录播主机"
});
const crossingCase = buildModel(crossingProfile);
const crossingLayout = getInterfaceWiringLayout(crossingCase.model, 993);
const crossingComputer = crossingCase.model.nodes.find((item) => item.label === "讲台电脑");
assert.ok(crossingComputer);
assert.ok(crossingLayout.positions.speakers.centerX < crossingLayout.positions[crossingComputer.id].centerX);
console.log("PASS child devices follow their root-port side so SPK and USB routes do not cross by default");

const models = [
  ...Array.from(ringCases.values()).map((item) => item.model),
  singleLine.model,
  oneLineWith02.model,
  twoLine.model,
  twoLineWith02.model,
  smallDisc01.model,
  smallDisc03.model,
  smallDiscUsb.model,
  unknownPort.model,
  overflowModel,
  hanging.model,
  crossingCase.model
];
for (const model of models) {
  assertNoDuplicatePortOccupancy(model);
  assertNoPowerEdges(model);
  assert.equal(new Set(model.nodes.map((item) => item.id)).size, model.nodes.length, "Duplicate wiring nodes");
}
const deterministicModel = buildModel(oneLineWith02Profile).model;
assert.deepEqual(deterministicModel, oneLineWith02.model);
assert.deepEqual(getInterfaceWiringLayout(deterministicModel), getInterfaceWiringLayout(oneLineWith02.model));
console.log("PASS unique ports, no power lines, no duplicate nodes and deterministic output");

function assertLayoutFitsWidth(model, width) {
  const layout = getInterfaceWiringLayout(model, width);
  assert.equal(layout.width, width, "Wiring canvas must keep the browser-provided width");
  const rectangles = Object.entries(layout.positions).map(([id, position]) => ({ id, ...position }));
  for (const rectangle of rectangles) {
    assert.ok(rectangle.x >= 0, rectangle.id + " starts outside the left canvas edge");
    assert.ok(rectangle.x + rectangle.width <= layout.width, rectangle.id + " exceeds the right canvas edge");
    assert.ok(rectangle.y >= 0, rectangle.id + " starts above the drawing title band");
    assert.ok(rectangle.y + rectangle.height <= layout.height, rectangle.id + " exceeds the bottom canvas edge");
  }
  for (let index = 0; index < rectangles.length; index += 1) {
    const left = rectangles[index];
    for (const right of rectangles.slice(index + 1)) {
      const overlaps = !(
        left.x + left.width <= right.x ||
        right.x + right.width <= left.x ||
        left.y + left.height <= right.y ||
        right.y + right.height <= left.y
      );
      assert.equal(overlaps, false, left.id + " overlaps " + right.id + " at canvas width " + width);
    }
  }
  assert.equal(layout.positions[model.rootNodeId]?.centerX, width / 2, "Level-one device must remain horizontally centered");
}

for (const width of [520, 993, 1120]) {
  for (const model of [oneLineWith02.model, smallDisc01.model, smallDisc03.model, smallDiscUsb.model]) {
    assertLayoutFitsWidth(model, width);
    assert.deepEqual(getInterfaceWiringLayout(model, width), getInterfaceWiringLayout(model, width));
  }
}
console.log("PASS responsive wiring layouts stay within browser width without node overlap");
`;

const result = await build({
  stdin: {
    contents: testModule,
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "interface-wiring-rule-check.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  loader: { ".png": "dataurl" },
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Interface wiring test bundle was empty.");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`;
await import(moduleUrl);
