import React from "react";
import { Text, TextInput } from "react-native";
import DatetimeField from "./DatetimeField";
import type { TimelineEntryFormStyles } from "./timelineEntryFormStyles";

type Props = {
  datetime: string;
  onDatetimeChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  styles: TimelineEntryFormStyles;
  placeholderTextColor: string;
  /** create — «Обязательно», edit — то же по умолчанию */
  commentPlaceholder?: string;
};

export default function CommentEntryFormFields({
  datetime,
  onDatetimeChange,
  comment,
  onCommentChange,
  styles,
  placeholderTextColor,
  commentPlaceholder = "Обязательно",
}: Props) {
  return (
    <>
      <DatetimeField
        value={datetime}
        onChange={onDatetimeChange}
        styles={styles}
        placeholderTextColor={placeholderTextColor}
      />
      <Text style={styles.labFull}>Текст комментария</Text>
      <TextInput
        style={styles.area}
        value={comment}
        onChangeText={onCommentChange}
        placeholder={commentPlaceholder}
        placeholderTextColor={placeholderTextColor}
        multiline
      />
    </>
  );
}
