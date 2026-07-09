import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const devPort = Number(window.location.port);
if (__ENABLE_CALIBRATION_WORKBENCHES__ && devPort >= 5177 && devPort < 5180) {
  document.documentElement.classList.add("mobilePreviewMode");
}
if (devPort === 5180) {
  window.__APP_BRAND__ = "yinman";
}
if (window.__APP_BRAND__ === "yinman") {
  document.title = "音曼AI售前工具";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
