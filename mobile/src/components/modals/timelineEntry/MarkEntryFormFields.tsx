import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import DatetimeField from "./DatetimeField";
import type { TimelineEntryFormStyles } from "./timelineEntryFormStyles";

type Props = {
  markType: "start" | "end";
  onMarkTypeChange: (type: "start" | "end") => void;
  datetime: string;
  onDatetimeChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  styles: TimelineEntryFormStyles;
  placeholderTextColor: string;
};

export default function MarkEntryFormFields({
  markType,
  onMarkTypeChange,
  datetime,
  onDatetimeChange,
  comment,
  onCommentChange,
  styles,
  placeholderTextColor,
}: Props) {
  return (
    <>
      <Text style={styles.labFull}>Тип метки</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.typeChip, markType === "start" && styles.typeChipOn]}
          onPress={() => onMarkTypeChange("start")}
        >
          <Text style={[styles.typeChipTxt, markType === "start" && styles.typeChipTxtOn]}>Начало</Text>
        </Pressable>
        <Pressable
          style={[styles.typeChip, markType === "end" && styles.typeChipOn]}
          onPress={() => onMarkTypeChange("end")}
        >
          <Text style={[styles.typeChipTxt, markType === "end" && styles.typeChipTxtOn]}>Конец</Text>
        </Pressable>
      </View>

      <DatetimeField
        value={datetime}
        onChange={onDatetimeChange}
        styles={styles}
        placeholderTextColor={placeholderTextColor}
      />

      <Text style={styles.labFull}>Комментарий</Text>
      <TextInput
        style={styles.area}
        value={comment}
        onChangeText={onCommentChange}
        placeholder="Необязательно"
        placeholderTextColor={placeholderTextColor}
        multiline
      />
    </>
  );
}
