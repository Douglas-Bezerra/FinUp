import {
  StyleSheet,
  Text,
  View,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import GradientText from "./GradientText";
import { colors } from "../styles/colors";

export default function Logo() {
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return (
    <View style={styles.container}>

      {/* Símbolo */}
      <LinearGradient
        colors={colors.gradient.colors}
        start={colors.gradient.start}
        end={colors.gradient.end}
        style={[styles.logoBox, compact && styles.logoBoxCompact]}
      >
        <View style={[styles.logoBoxInner, compact && styles.logoBoxInnerCompact]}>
          <Image
            source={require("../../assets/logo-tela.png")}
            style={styles.logoSymbol}
          />
        </View>
      </LinearGradient>

      {/* Nome */}
      <View style={styles.logo}>
        <Text style={[styles.logoText, compact && styles.logoTextCompact]}>
          Fin
        </Text>

        <GradientText style={[styles.logoText, compact && styles.logoTextCompact]}>
          Up
        </GradientText>
      </View>

      {/* Subtítulo */}
      <Text style={[styles.logoSubtitle, compact && styles.logoSubtitleCompact]}>
        Controle Financeiro Pessoal
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
  },

  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  logoBoxCompact: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  
  logoBoxInner: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    backgroundColor: colors.background,
    alignItems: "center",
  },

  logoBoxInnerCompact: {
    borderRadius: 19,
  },

  logoSymbol: {
    width: "80%",
    height: "100%",
    resizeMode: "contain",
  },

  logo: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoText: {
    fontSize: 60,
    fontWeight: "bold",
    color: colors.foreground,
  },

  logoTextCompact: {
    fontSize: 46,
  },

  logoSubtitle: {
    color: colors.mutedForeground,
    fontSize: 20,
    marginTop: 4,
    maxWidth: "100%",
    textAlign: "center",
  },

  logoSubtitleCompact: {
    fontSize: 14,
    textAlign: "center",
  },
});