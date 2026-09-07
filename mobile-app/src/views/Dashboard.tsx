import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/colors";

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FinUp</Text>

      <Text style={styles.subtitle}>
        Controle suas finanças de forma simples.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "center",
  },

  title: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },

  subtitle: {
    color: colors.secondaryForeground,
    fontSize: 16,
  },
});