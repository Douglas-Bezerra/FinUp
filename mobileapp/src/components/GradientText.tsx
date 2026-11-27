import { Text, StyleProp, TextStyle } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../styles/colors";

const MaskedViewAny = MaskedView as any;

interface GradientTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function GradientText({
  children,
  style,
  numberOfLines,
}: GradientTextProps) {
  return (
    <MaskedViewAny
      maskElement={
        <Text style={style} numberOfLines={numberOfLines}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors.gradient.colors}
        start={colors.gradient.start}
        end={colors.gradient.end}
      >
        <Text style={[style, { opacity: 0 }]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedViewAny>
  );
}