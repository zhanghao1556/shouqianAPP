/// <reference types="vite/client" />

declare const __ENABLE_CALIBRATION_WORKBENCHES__: boolean;
declare const __ENABLE_YINYI_INTERFACE_WIRING__: boolean;
declare const __ENABLE_YINMAN_INTERFACE_WIRING__: boolean;
declare const __APP_VERSION__: string;

interface Window {
  __YIOU_RELEASE_BUILD__?: boolean;
  __YIOU_RELEASE_VERSION__?: string;
  __APP_BRAND__?: "yinyi" | "yinman";
}
