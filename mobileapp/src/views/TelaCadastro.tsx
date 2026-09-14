import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { RootStackParamList } from "../navigation/types";

import Input from "../components/Input";
import Logo from "../components/Logo";
import GradientButton from "../components/GradientButton";

type CadastroNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Cadastro"
>;

export default function Cadastro() {
  const navigation = useNavigation<CadastroNavigationProp>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const validateForm = () => {
    const newErrors = {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    };

    if (!name.trim()) {
      newErrors.name = "Informe seu nome completo.";
    }

    if (!email.trim()) {
      newErrors.email = "Informe seu e-mail.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Informe um e-mail válido.";
    }

    if (!password) {
      newErrors.password = "Informe uma senha.";
    } else if (password.length < 6) {
      newErrors.password = "A senha deve ter pelo menos 6 caracteres.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirme sua senha.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem.";
    }

    console.log(newErrors);
    
    setErrors(newErrors);

    return Object.values(newErrors).every((error) => !error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* Cabeçalho */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          {/* Logo */}
          <View style={styles.logoArea}>
            <Logo />
          </View>
        </View>

        {/* Formulário */}
        <View style={styles.card}>
          <Input
            label="Nome Completo"
            value={name}
            onChangeText={setName}
            placeholder="Seu nome completo"
          />

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
            placeholder="Mín. 6 caracteres"
            secureTextEntry
          />

          <Input
            label="Confirmar Senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a senha"
            secureTextEntry
          />

          <View style={styles.button}>
            <GradientButton
              title="Criar conta grátis"
              onPress={validateForm}
            />
          </View>

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
    marginBottom: 10,
    marginTop: 60,
  },

  header: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",

  },

  backIcon: {
    color: colors.foreground,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "300",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
  },

  button: {
    marginTop: 15,
  },

});