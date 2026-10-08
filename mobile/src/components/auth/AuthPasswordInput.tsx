import React, { forwardRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { authScreenStyles } from "@/components/auth/authScreenStyles";
import { colors } from "@/theme/colors";

type AuthPasswordInputProps = Omit<TextInputProps, "secureTextEntry"> & {
  containerStyle?: object;
};

const AuthPasswordInput = forwardRef<TextInput, AuthPasswordInputProps>(function AuthPasswordInput(
  { style, containerStyle, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        {...rest}
        ref={ref}
        style={[authScreenStyles.input, styles.input, style]}
        secureTextEntry={!visible}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setVisible((prev) => !prev)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Скрыть пароль" : "Показать пароль"}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
});

export default AuthPasswordInput;

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    marginBottom: 12,
  },
  input: {
    marginBottom: 0,
    paddingRight: 48,
  },
  toggle: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 32,
  },
});
