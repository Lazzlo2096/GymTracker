import StatsScreen from "@/components/stats/StatsScreen";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function StatsTabScreen() {
  useTraceScreen("stats");
  return <StatsScreen />;
}
