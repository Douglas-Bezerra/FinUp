import { StyleSheet, Text, View } from "react-native";

import { colors } from "../styles/colors";

export default function TelaCadastroReceitas() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nova Receita</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },

  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "700",
  },
});