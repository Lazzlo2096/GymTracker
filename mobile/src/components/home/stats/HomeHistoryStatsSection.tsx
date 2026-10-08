import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import HomeBestStreaks from "@/components/home/stats/HomeBestStreaks";
import HomeCalendarHeatmap from "@/components/home/stats/HomeCalendarHeatmap";
import HomeHistoryChart from "@/components/home/stats/HomeHistoryChart";

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Блоки статистики на главной: история, календарь, лучшие серии (реальные API). */
export default function HomeHistoryStatsSection({ style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <HomeHistoryChart />
      <HomeCalendarHeatmap />
      <HomeBestStreaks />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
});
