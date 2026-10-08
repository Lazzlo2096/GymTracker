import HomeDashboardScreen from "@/components/home/HomeDashboardScreen";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function HomeTabScreen() {
  useTraceScreen("home");
  return <HomeDashboardScreen />;
}
