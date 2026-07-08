import { lazy, Suspense } from "react";
import { ClassroomEngineeringApp } from "./features/classroom/ClassroomEngineeringApp";

export default function App() {
  if (__ENABLE_CALIBRATION_WORKBENCHES__ && window.location.port === "5175") {
    const CalibrationWorkbench = lazy(() => import("./features/classroom/CalibrationWorkbench").then((module) => ({ default: module.CalibrationWorkbench })));
    return (
      <Suspense fallback={null}>
        <CalibrationWorkbench />
      </Suspense>
    );
  }
  if (__ENABLE_CALIBRATION_WORKBENCHES__ && window.location.port === "5176") {
    const WiringTopologyCalibrationWorkbench = lazy(() =>
      import("./features/classroom/WiringTopologyCalibrationWorkbench").then((module) => ({ default: module.WiringTopologyCalibrationWorkbench }))
    );
    return (
      <Suspense fallback={null}>
        <WiringTopologyCalibrationWorkbench />
      </Suspense>
    );
  }
  return <ClassroomEngineeringApp />;
}
