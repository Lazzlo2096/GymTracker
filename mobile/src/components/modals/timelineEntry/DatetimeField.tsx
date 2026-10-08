import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { toLocalDateTimeInputValue } from "@/utils/localDateTimeInput";
import type { TimelineEntryFormStyles } from "./timelineEntryFormStyles";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  styles: TimelineEntryFormStyles;
  placeholderTextColor: string;
};

export default function DatetimeField({
  label = "Время",
  value,
  onChange,
  styles,
  placeholderTextColor,
}: Props) {
  return (
    <View>
      <Text style={styles.labFull}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DDTHH:MM"
        placeholderTextColor={placeholderTextColor}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={styles.nowBtn} onPress={() => onChange(toLocalDateTimeInputValue())}>
        <Text style={styles.nowBtnText}>Сейчас</Text>
      </Pressable>
    </View>
  );
}
