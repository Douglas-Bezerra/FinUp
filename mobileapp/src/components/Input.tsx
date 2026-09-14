import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../styles/colors";


interface InputFinUpProps extends TextInputProps {
  label: string;
}

export default function InputFinUp({
  label,
  secureTextEntry,
  ...textInputProps
}: InputFinUpProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          {...textInputProps}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />

        {isPassword && (
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },

  label: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },

  input: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    paddingRight: 48,
    color: colors.foreground,
    fontSize: 14,
  },

  inputContainer: {
    position: "relative",
  },

  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});