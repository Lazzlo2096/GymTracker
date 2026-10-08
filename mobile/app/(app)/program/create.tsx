import PlansProgramCreateScreen from "@/components/plans/PlansProgramCreateScreen";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function ProgramCreateRoute() {
  useTraceScreen("program/create");
  return <PlansProgramCreateScreen />;
}
