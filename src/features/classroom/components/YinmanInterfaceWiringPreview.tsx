import aj200InterfacePanel from "../../../assets/yinman-aj200-interface-panel.svg";
import aj350InterfacePanel from "../../../assets/yinman-aj350-interface-panel.svg";
import aj600InterfacePanel from "../../../assets/yinman-aj600-interface-panel.svg";
import ap150RearPanel from "../../../assets/yinman-ap150-rear-panel.svg";
import lineArrayRearPanel from "../../../assets/yinman-sa110-rear-panel.svg";
import lineArrayConverterPanel from "../../../assets/yinman-line-array-converter-interface-panel.svg";
import passiveSpeakerTerminal from "../../../assets/yinman-passive-speaker-terminal.svg";
import podiumComputerRearPanel from "../../../assets/external-podium-computer-panel.svg";
import recordingLineInputPanel from "../../../assets/external-recording-line-input-panel.svg";
import controlHostPanel from "../../../assets/external-control-host-rs232-panel.svg";
import laptopPanel from "../../../assets/external-laptop-panel.svg";
import opsAllInOnePanel from "../../../assets/external-ops-panel.svg";
import conferenceTerminalPanel from "../../../assets/external-conference-terminal-panel.svg";
import headsetSplitterPanel from "../../../assets/external-headset-splitter-panel.svg";
import wiredMicrophonePanel from "../../../assets/external-wired-microphone-panel.svg";
import ring01InterfacePanel from "../../../assets/yinman-ring01-interface-panel.svg";
import ring03InterfacePanel from "../../../assets/yinman-ring03-interface-panel.svg";
import ring08RearPanel from "../../../assets/yinman-ring08-rear-panel.svg";
import hangingMicInterfacePanel from "../../../assets/yinman-hanging-mic-interface-panel.svg";
import ringOfAInterfacePanel from "../../../assets/yinman-ringof-a-interface-panel.svg";
import wirelessReceiverRearPanel from "../../../assets/yinman-wireless-receiver-rear-panel.svg";
import legacyWirelessReceiverPanel from "../../../assets/external-legacy-wireless-receiver-panel.svg";
import {
  InterfaceWiringPreview,
  type InterfacePanelImageMap,
  type InterfaceWiringPreviewProps
} from "./InterfaceWiringPreview";

const panelImages: InterfacePanelImageMap = {
  aj200: aj200InterfacePanel,
  aj350: aj350InterfacePanel,
  aj600: aj600InterfacePanel,
  ap150: ap150RearPanel,
  lineArray: lineArrayRearPanel,
  lineArrayConverter: lineArrayConverterPanel,
  passiveSpeaker: passiveSpeakerTerminal,
  podiumComputer: podiumComputerRearPanel,
  recordingLineInput: recordingLineInputPanel,
  controlHost: controlHostPanel,
  laptop: laptopPanel,
  opsAllInOne: opsAllInOnePanel,
  conferenceTerminal: conferenceTerminalPanel,
  headsetSplitter: headsetSplitterPanel,
  wiredMicrophone: wiredMicrophonePanel,
  ring01: ring01InterfacePanel,
  ring03: ring03InterfacePanel,
  ring08: ring08RearPanel,
  hangingMic: hangingMicInterfacePanel,
  ringOfA: ringOfAInterfacePanel,
  wirelessReceiver: wirelessReceiverRearPanel,
  legacyWirelessReceiver: legacyWirelessReceiverPanel
};

export default function YinmanInterfaceWiringPreview(props: InterfaceWiringPreviewProps) {
  return <InterfaceWiringPreview {...props} interfacePanelImages={panelImages} />;
}
