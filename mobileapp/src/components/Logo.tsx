import {
  StyleSheet,
  Text,
  View,
  Image,
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
          <Image
            source={require("../../assets/logo-tela.png")}
            style={styles.logoSymbol}
          />
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
    width: 80,
    height: 80,
    borderRadius: 24,
    padding: 2,
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

  logoSubtitle: {
    color: colors.mutedForeground,
    fontSize: 20,
    marginTop: 4,
  },
});