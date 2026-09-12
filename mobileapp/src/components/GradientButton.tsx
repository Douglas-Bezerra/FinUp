import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../styles/colors";

interface GradientButtonProps {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function GradientButton({
  title,
  onPress,
  style,
  textStyle,
}: GradientButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={style}
    >
      <LinearGradient
        colors={colors.gradient.colors}
        start={colors.gradient.start}
        end={colors.gradient.end}
        style={styles.gradient}
      >
        <Text style={[styles.text, textStyle]}>
          {title}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  text: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});