import PlansScreen from "@/components/plans/PlansScreen";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function PlansTabScreen() {
  useTraceScreen("plans");
  return <PlansScreen />;
}
