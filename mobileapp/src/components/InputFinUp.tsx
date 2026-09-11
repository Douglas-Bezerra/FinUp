import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { colors } from "../styles/colors";

interface InputFinUpProps extends TextInputProps {
  label: string;
}

export default function InputFinUp({
  label,
  ...textInputProps
}: InputFinUpProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        {...textInputProps}
        placeholderTextColor={colors.mutedForeground}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },

  label: {
    color: colors.mutedForeground,
    fontSize: 12,
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
    color: colors.foreground,
    fontSize: 14,
  },
});