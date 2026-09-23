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

import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

import { colors } from "../styles/colors";
import { RootStackParamList } from "../navigation/types";
import { criarUsuario } from "../dataconnect-generated";

{/* Importando Componentes para "montar" TelaCadastro */ }
import Input from "../components/Input";
import Logo from "../components/Logo";
import GradientButton from "../components/GradientButton";

type CadastroNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Cadastro"
>;

export default function TelaCadastro() {
  const navigation = useNavigation<CadastroNavigationProp>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [firebaseError, setFirebaseError] = useState("");

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

    {/* Validação do nome */ }
    if (!name.trim()) {
      newErrors.name = "Informe seu nome completo.";
    } else if (/\d/.test(name)) {
      newErrors.name = "O nome não pode conter números.";
    }

    {/* Validação do e-mail */ }
    if (!email.trim()) {
      newErrors.email = "Informe seu e-mail.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Informe um e-mail válido.";
    }

    {/* Validação da senha */ }
    if (!password) {
      newErrors.password = "Informe uma senha.";
    } else if (password.length < 6) {
      newErrors.password = "A senha deve ter pelo menos 6 caracteres.";
    }

    {/* Validação da confirmação de senha */ }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirme sua senha.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem.";
    }

    setErrors(newErrors);

    return Object.values(newErrors).every((error) => !error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ScrollView para permitir rolagem quando o teclado estiver aberto */}
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
            onChangeText={(text) => {
              setName(text);
              setErrors((prev) => ({ ...prev, name: "" }));
            }}
            placeholder="Seu nome completo"
          />
          {/* Exibe mensagem de erro se houver erro no campo nome */}
          {errors.name ? (
            <Text style={styles.error}>{errors.name}</Text>
          ) : null}

          <Input
            label="E-mail"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors((prev) => ({ ...prev, email: "" }));
              setFirebaseError("");
            }}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {/* Exibe mensagem de erro se houver erro no campo e-mail */}
          {firebaseError ? (
            <Text style={styles.error}>{firebaseError}</Text>
          ) : null}


          <Input
            label="Senha"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors((prev) => ({ ...prev, password: "" }));
            }}
            placeholder="Mín. 6 caracteres"
            secureTextEntry
          />
          {/* Exibe mensagem de erro se houver erro no campo senha */}
          {errors.password ? (
            <Text style={styles.error}>{errors.password}</Text>
          ) : null}

          <Input
            label="Confirmar Senha"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors((prev) => ({ ...prev, confirmPassword: "" }));
            }}
            placeholder="Repita a senha"
            secureTextEntry
          />
          {/* Exibe mensagem de erro se houver erro no campo confirmar senha */}
          {errors.confirmPassword ? (
            <Text style={styles.error}>{errors.confirmPassword}</Text>
          ) : null}

          <View style={styles.button}>
            <GradientButton
              title="Criar conta grátis"
              onPress={async () => {
                const isValid = validateForm();

                if (!isValid) {
                  return;
                }
                try {
                  await createUserWithEmailAndPassword(
                    auth,
                    email.trim(),
                    password
                  );

                  await criarUsuario({
                    nome: name.trim(),
                    email: email.trim(),
                    papel: "PRINCIPAL",
                  });
                }
                catch (error: any) {
                  if (error.code === "auth/email-already-in-use") {
                    setFirebaseError("Este e-mail já está cadastrado.");
                  } else {
                    setFirebaseError("Não foi possível criar sua conta.");
                  }
                }
              }}
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
    marginTop: 20,
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
  error: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 16,
  },

});