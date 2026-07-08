import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const devPort = Number(window.location.port);
if (__ENABLE_CALIBRATION_WORKBENCHES__ && devPort >= 5177) {
  document.documentElement.classList.add("mobilePreviewMode");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
