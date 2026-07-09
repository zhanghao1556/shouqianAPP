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
    const ReverberationCalibrationWorkbench = lazy(() =>
      import("./features/classroom/ReverberationCalibrationWorkbench").then((module) => ({ default: module.ReverberationCalibrationWorkbench }))
    );
    return (
      <Suspense fallback={null}>
        <ReverberationCalibrationWorkbench />
      </Suspense>
    );
  }
  return <ClassroomEngineeringApp />;
}
