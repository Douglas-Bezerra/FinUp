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

import { signInWithEmailAndPassword } from "firebase/auth";
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
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin() {
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Por favor, preencha o e-mail e a senha.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigation.navigate("Inicio");
    } catch (error: any) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-email"
      ) {
        setErrorMessage("E-mail ou senha inválidos.");
      } else {
        setErrorMessage("Não foi possível entrar. Verifique seus dados.");
      }
    } finally {
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
          {errorMessage ? (
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          {/* Esqueci senha */}
          <Pressable style={styles.forgotButton}>
            <GradientText style={styles.forgotText}>
              Esqueci minha senha
            </GradientText>
          </Pressable>


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
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 30,
    marginTop: -10,
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
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 15,
    textAlign: "center",
  },
});