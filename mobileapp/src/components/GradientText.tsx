import { Text, StyleProp, TextStyle } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../styles/colors";

interface GradientTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export default function GradientText({
  children,
  style,
}: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <Text style={style}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors.gradient.colors}
        start={colors.gradient.start}
        end={colors.gradient.end}
      >
        <Text style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}