/// <reference types="vite/client" />

declare const __ENABLE_CALIBRATION_WORKBENCHES__: boolean;
declare const __ENABLE_YINMAN_INTERFACE_WIRING__: boolean;

interface Window {
  __YIOU_RELEASE_BUILD__?: boolean;
  __APP_BRAND__?: "yinyi" | "yinman";
}
