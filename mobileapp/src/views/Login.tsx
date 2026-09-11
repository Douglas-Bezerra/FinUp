import InputFinUp from "../components/InputFinUp";

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
          <View style={styles.logoBox}>
            <Text style={styles.logoSymbol}>◉</Text>
          </View>

          <Text style={styles.logoText}>
            Fin<Text style={styles.logoHighlight}>Up</Text>
          </Text>

          <Text style={styles.logoSubtitle}>
            Controle financeiro pessoal
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Entrar na conta</Text>

          <Text style={styles.welcome}>
            Bem-vindo de volta
          </Text>

          <InputFinUp
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <InputFinUp
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {/* Esqueci senha */}
          <Pressable style={styles.forgotButton}>
            <Text style={styles.forgotText}>
              Esqueci minha senha
            </Text>
          </Pressable>

          {/* Entrar */}
          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>
              Entrar
            </Text>
          </Pressable>
        </View>

        {/* Criar conta */}
        <View style={styles.registerArea}>
          <Text style={styles.registerText}>
            Não tem uma conta?
          </Text>

          <Pressable>
            <Text style={styles.registerLink}>
              Criar conta grátis
            </Text>
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
  },

  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  logoSymbol: {
    color: colors.primary,
    fontSize: 28,
  },

  logoText: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "800",
  },

  logoHighlight: {
    color: colors.primary,
  },

  logoSubtitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 24,
  },

  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
  },

  welcome: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 20,
  },

  forgotText: {
    color: colors.primary,
    fontSize: 12,
  },

  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "700",
  },

  registerArea: {
    flexDirection: "row",
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
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});