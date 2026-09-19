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


{/* Importando Componentes para "montar" TelaInicial */ }
import Input from "../components/Input";

type TelaInicialNavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    "TelaInicial"
>;

export default function TelaInicial() {
    const navigation = useNavigation<TelaInicialNavigationProp>();

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
                <View style={styles.teste}>

                    <Text style={styles.title}>
                        Tela Inicial
                    </Text>


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
    teste: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.foreground,
    },

});