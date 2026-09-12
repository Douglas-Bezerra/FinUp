import Input from "../components/Input";
import Logo from "../components/Logo";
import ButtonFinUp from "../components/ButtonFinUp";
import GradientText from "../components/GradientText";

import { useState } from "react";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../styles/colors";

export default function TelaLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* Logo */}
        <View style={styles.logoArea}>
          <Logo />
        </View>

        {/* Card */}
        <View style={styles.card}>

          <Text style={styles.title}>
            Entrar na conta
          </Text>

          <Text style={styles.welcome}>
            Bem-vindo de volta
          </Text>

          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {/* Esqueci senha */}
          <Pressable style={styles.forgotButton}>
            <GradientText style={styles.forgotText}>
              Esqueci minha senha
            </GradientText>
          </Pressable>

          {/* Entrar */}
          <ButtonFinUp
            title="Entrar"
            onPress={() => {
              // Login futuramente
            }}
          />

        </View>

        {/* Criar conta */}
        <View style={styles.registerArea}>

          <Text style={styles.registerText}>
            Não tem uma conta?
          </Text>

          <Pressable>
            <GradientText style={styles.registerLink}>
              Criar conta grátis
            </GradientText>
          </Pressable>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },

  logoArea: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 36,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
  },

  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },

  welcome: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
    textAlign: "center",
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 20,
  },

  forgotText: {
    fontSize: 12,
    fontWeight: "600",
  },

  registerArea: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    gap: 6,
  },

  registerText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },

  registerLink: {
    fontSize: 13,
    fontWeight: "700",
  },
});