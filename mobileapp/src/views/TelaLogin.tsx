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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";

import { colors } from "../styles/colors";
import { RootStackParamList } from "../navigation/types";

import Input from "../components/Input";
import Logo from "../components/Logo";
import GradientButton from "../components/GradientButton";
import GradientText from "../components/GradientText";

type LoginNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function TelaLogin() {
  const navigation = useNavigation<LoginNavigationProp>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [resetFeedback, setResetFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  async function handlePasswordReset() {
    const normalizedEmail = email.trim();
    setResetFeedback(null);

    if (!normalizedEmail) {
      setResetFeedback({
        type: "error",
        message: "Informe seu e-mail para recuperar a senha.",
      });
      return;
    }

    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetFeedback({
        type: "success",
        message: "Enviamos um link para redefinir sua senha.",
      });
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
          ? error.code
          : "";

      setResetFeedback({
        type: "error",
        message:
          errorCode === "auth/invalid-email"
            ? "Digite um e-mail válido."
            : "Não foi possível enviar o link de recuperação.",
      });
    } finally {
      setResetLoading(false);
    }
  }

  async function handleLogin() {
    setEmailError("");
    setPasswordError("");

    let valido = true;

    if (!email.trim()) {
      setEmailError("Por favor, preencha o e-mail.");
      valido = false;
    }

    if (!password.trim()) {
      setPasswordError("Por favor, preencha a senha.");
      valido = false;
    }

    if (!valido) {
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // Limpa as credenciais após o login bem-sucedido
      setEmail("");
      setPassword("");

      navigation.navigate("Inicio");
    } catch (error: any) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-email"
      ) {
        setPasswordError("E-mail ou senha inválidos.");
      } else {
        setPasswordError("Não foi possível entrar. Verifique seus dados.");
      }
    }
    finally {
      setLoading(false);
    }
  }



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
            onChangeText={(text) => {
              setEmail(text);
              if (text.trim()) {
                setEmailError("");
              }
              setResetFeedback(null);
            }}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailError ? (
            <Text style={styles.emailErrorText}>
              {emailError}
            </Text>
          ) : null}


          <Input
            label="Senha"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (text.trim()) {
                setPasswordError("");
              }
            }}
            placeholder="••••••••"
            secureTextEntry
          />
          <View style={styles.passwordFooter}>
            {passwordError ? (
              <Text style={styles.errorText}>
                {passwordError}
              </Text>
            ) : (
              <View style={styles.passwordErrorPlaceholder} />
            )}

            <Pressable
              style={styles.forgotButton}
              onPress={handlePasswordReset}
              disabled={resetLoading}
              accessibilityState={{
                disabled: resetLoading,
                busy: resetLoading,
              }}
            >
              <GradientText style={styles.forgotText}>
                {resetLoading ? "Enviando..." : "Esqueci minha senha"}
              </GradientText>
            </Pressable>
          </View>

          {resetFeedback ? (
            <Text
              style={[
                styles.resetFeedback,
                resetFeedback.type === "success"
                  ? styles.resetSuccessText
                  : styles.errorText,
              ]}
              accessibilityLiveRegion="polite"
            >
              {resetFeedback.message}
            </Text>
          ) : null}

          {/* Entrar */}
          <GradientButton
            title={loading ? "Entrando..." : "Entrar"}
            onPress={handleLogin}
          />

        </View>

        {/* Criar conta */}
        <View style={styles.registerArea}>

          <Text style={styles.registerText}>
            Não tem uma conta?
          </Text>

          <Pressable onPress={() => navigation.navigate("Cadastro")}>
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
    paddingTop: 50,
    paddingBottom: 32,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 65,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingTop: 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 5,
  },
  welcome: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginBottom: 24,
    textAlign: "center",
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
  passwordFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: -10,
    marginBottom: 55,
  },
  passwordErrorPlaceholder: {
    flex: 1,
  },
  forgotButton: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
  },
  emailErrorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 30,
  },
  resetFeedback: {
    fontSize: 12,
    marginTop: -22,
    marginBottom: 16,
  },
  resetSuccessText: {
    color: colors.foreground,
  },
});