import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import GradientText from "./GradientText";

import { colors } from "../styles/colors";

export default function Logo() {
  return (
    <View style={styles.container}>

      {/* Símbolo */}
      <LinearGradient
        colors={colors.gradient.colors}
        start={colors.gradient.start}
        end={colors.gradient.end}
        style={styles.logoBox}
      >
        <View style={styles.logoBoxInner}>
          <GradientText style={styles.logoSymbol}>
            ◉
          </GradientText>
        </View>
      </LinearGradient>

      {/* Nome */}
      <View style={styles.logo}>
        <Text style={styles.logoText}>
          Fin
        </Text>

        <GradientText style={styles.logoText}>
          Up
        </GradientText>
      </View>

      {/* Subtítulo */}
      <Text style={styles.logoSubtitle}>
        Controle Financeiro Pessoal
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },

  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 24,
    padding: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  logoBoxInner: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  logoSymbol: {
    fontSize: 30,
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

  logoSubtitle: {
    color: colors.mutedForeground,
    fontSize: 20,
    marginTop: 4,
  },
});