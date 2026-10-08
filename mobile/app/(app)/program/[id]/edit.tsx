import { useLocalSearchParams } from "expo-router";
import PlansProgramCreateScreen from "@/components/plans/PlansProgramCreateScreen";
import { useTraceScreen } from "@/debug/useTraceScreen";

export default function ProgramEditRoute() {
  useTraceScreen("program/[id]/edit");
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);

  return <PlansProgramCreateScreen programId={Number.isInteger(programId) ? programId : undefined} />;
}
