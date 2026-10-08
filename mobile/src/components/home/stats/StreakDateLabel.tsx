import React, { useMemo } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { createHomeStatsStyles } from "@/components/home/stats/homeStatsStyles";
import { homeStatsTextProps } from "@/components/home/stats/homeStatsTextProps";
import { splitStreakDateLabel } from "@/components/home/stats/historyStatsUtils";
import { useAppTheme } from "@/theme/appTheme";

type Props = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export default function StreakDateLabel({ label, style }: Props) {
  const theme = useAppTheme();
  const { styles } = useMemo(() => createHomeStatsStyles(theme), [theme]);
  const [dayMonth, year] = splitStreakDateLabel(label);

  return (
    <View style={[styles.streakDateCell, style]}>
      <Text style={styles.streakDateLine} {...homeStatsTextProps}>
        {dayMonth}
      </Text>
      {year ? (
        <Text style={styles.streakDateLine} {...homeStatsTextProps}>
          {year}
        </Text>
      ) : null}
    </View>
  );
}
