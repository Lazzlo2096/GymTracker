import PlansTemplateDetailScreen from "@/components/plans/PlansTemplateDetailScreen";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function PlanTemplateRoute() {
  useTraceScreen("plan-template/[id]");
  return <PlansTemplateDetailScreen />;
}
