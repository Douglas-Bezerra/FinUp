import {
    StyleSheet,
    Text,
    View,
    Pressable,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Animated,
    AppState,
    Linking,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { colors } from "../styles/colors";
import GradientText from "../components/GradientText"
import { LinearGradient } from "expo-linear-gradient";

type Msg = {
    id: number;
    role: "user" | "bot";
    text: string;
    time: string;
};

const INITIAL: Msg[] = [
    {
        id: 1,
        role: "bot",
        text: "Olá! 👋 Sou o Finn, seu assistente financeiro pessoal. Posso te ajudar com análise de gastos, dicas de investimento, metas financeiras e muito mais. Como posso te ajudar hoje?",
        time: "09:41",
    },
];

const QUICK = [
    "Como está minha saúde financeira?",
    "Onde posso cortar gastos?",
    "Melhores investimentos agora",
    "Quanto guardar por mês?",
];

const RESPONSES: Record<string, string> = {
    "Como está minha saúde financeira?":
        "📊 Análise do seu perfil:\n\nSua saúde financeira está boa — você economizou R$ 5.161 esse mês (53% da renda).\n\n• Despesas com assinaturas representam 0,6% da renda — tudo bem\n• Sua reserva de emergência cobre ~4 meses de despesas\n• Taxa de poupança acima de 20% — parabéns! 🎯",

    "Onde posso cortar gastos?":
        "🔍 Oportunidades de economia:\n\n1. Assinaturas — você gasta R$ 61,80/mês. Há duplicidade?\n2. Alimentação — R$ 312 em supermercado. Planejamento de cardápio pode reduzir ~15%\n3. Transporte — R$ 32,50 em Uber. Vale avaliar alternativas nos horários de pico\n\nTotal potencial de economia: ~R$ 120/mês 💡",

    "Melhores investimentos agora":
        "💼 Para o seu perfil (moderado):\n\nCurto prazo (reserva):\n• Tesouro Selic — segurança e liquidez\n• CDB 100% CDI\n\nMédio/longo prazo:\n• FIIs — diversificação\n• ETFs — diversificação em ações\n\n⚠️ Isso não é recomendação formal. Consulte um assessor.",

    "Quanto guardar por mês?":
        "🎯 Sua meta de poupança:\n\nCom renda de R$ 9.700 e despesas de R$ 4.539, você pode poupar R$ 5.161/mês (53%).\n\nRegra 50/30/20:\n• 50% Necessidades → R$ 4.850\n• 30% Desejos → R$ 2.910\n• 20% Poupança → R$ 1.940\n\nVocê já supera a meta! 🚀",
};

export default function TelaAssistente() {
    const navigation = useNavigation();
    const [messages, setMessages] = useState<Msg[]>(INITIAL);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);

    const scrollRef = useRef<ScrollView>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages, typing]);

    // Verificar se a permissão foi concedida após voltar das Configurações
    useEffect(() => {
        const checkPermission = async () => {
            try {
                const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
                if (status.granted) {
                    setPermissionDenied(false);
                }
            } catch {}
        };

        const sub = AppState.addEventListener("change", (nextState) => {
            if (nextState === "active") {
                checkPermission();
            }
        });

        return () => sub.remove();
    }, []);

    // Animação de pulso no microfone enquanto escuta
    useEffect(() => {
        if (isListening) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isListening]);

    // Eventos do reconhecimento de voz
    useSpeechRecognitionEvent("start", () => {
        console.log("Voz iniciada");
        setIsListening(true);
    });

    useSpeechRecognitionEvent("end", () => {
        console.log("Voz finalizada");
        setIsListening(false);
    });

    useSpeechRecognitionEvent("result", (event) => {
        if (event.results && event.results.length > 0) {
            const transcript = event.results[0]?.transcript;
            if (transcript) {
                setInput(transcript);
            }
        }
    });

    useSpeechRecognitionEvent("error", (event) => {
        console.log("Erro de voz:", event);
        setIsListening(false);
    });

    const handleToggleListening = async () => {
        if (isListening) {
            try {
                ExpoSpeechRecognitionModule.stop();
            } catch (err) {
                console.error("Erro ao parar gravação:", err);
            }
            setIsListening(false);
            return;
        }

        try {
            const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!perm.granted) {
                console.log("Permissão recusada:", perm);
                setPermissionDenied(true);

                // Se o Android marcou canAskAgain como false, o sistema não abre diálogo; oferecemos ir para as Configurações
                if (!perm.canAskAgain) {
                    Alert.alert(
                        "Permissão do Microfone",
                        "O Android bloqueou o microfone nas permissões do app. Deseja abrir as Configurações agora para permitir?",
                        [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Abrir Configurações", onPress: () => Linking.openSettings() },
                        ]
                    );
                } else {
                    Alert.alert(
                        "Permissão necessária",
                        "Permita o acesso ao microfone para pesquisar por voz."
                    );
                }
                return;
            }

            setPermissionDenied(false);

            await ExpoSpeechRecognitionModule.start({
                lang: "pt-BR",
                interimResults: true,
                continuous: false,
            });
        } catch (error) {
            console.error("Erro ao iniciar reconhecimento de voz:", error);
            Alert.alert(
                "Atenção",
                "O reconhecimento de voz requer um build nativo com suporte no Android."
            );
            setIsListening(false);
        }
    };

    function now() {
        return new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function send(text: string) {
        if (!text.trim() || typing) return;

        if (isListening) {
            try {
                ExpoSpeechRecognitionModule.stop();
            } catch {}
            setIsListening(false);
        }

        const userMsg: Msg = {
            id: Date.now(),
            role: "user",
            text: text.trim(),
            time: now(),
        };

        setMessages((current) => [...current, userMsg]);
        setInput("");
        setTyping(true);

        setTimeout(() => {
            const reply =
                RESPONSES[text.trim()] ||
                "Entendido! 📝 Analisando suas finanças...\n\nPara uma resposta mais precisa, posso verificar seu histórico de transações. O que mais você gostaria de saber sobre suas finanças?";

            setTyping(false);

            setMessages((current) => [
                ...current,
                {
                    id: Date.now() + 1,
                    role: "bot",
                    text: reply,
                    time: now(),
                },
            ]);
        }, 1200);
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
        >
            {/* Cabeçalho */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={12}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.foreground} />
                </Pressable>

                <LinearGradient
                    colors={colors.gradient.colors}
                    start={colors.gradient.start}
                    end={colors.gradient.end}
                    style={styles.finnIconBorder}
                >
                    <View style={styles.finnIcon}>
                        <GradientText style={styles.finnSymbol}>
                            ✦
                        </GradientText>
                    </View>
                </LinearGradient>

                <View>
                    <GradientText style={styles.finnName}>
                        Bufunfa
                    </GradientText>

                    <View style={styles.onlineStatus}>
                        <View style={styles.onlineIndicator} />
                        <GradientText style={styles.onlineText}>
                            Online · Assistente Financeiro
                        </GradientText>
                    </View>
                </View>
            </View>

            {/* Mensagens */}
            <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {messages.map((message) => (
                    <View
                        key={message.id}
                        style={[
                            styles.messageRow,
                            message.role === "user"
                                ? styles.userRow
                                : styles.botRow,
                        ]}
                    >
                        {message.role === "bot" && (
                            <GradientText style={styles.botIconText}>
                                ✦
                            </GradientText>
                        )}

                        <View style={styles.messageContainer}>
                            <View
                                style={[
                                    styles.messageBubble,
                                    message.role === "user"
                                        ? styles.userBubble
                                        : styles.botBubble,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.messageText,
                                        message.role === "user"
                                            ? styles.userText
                                            : styles.botText,
                                    ]}
                                >
                                    {message.text}
                                </Text>
                            </View>

                            <Text
                                style={[
                                    styles.messageTime,
                                    message.role === "user" &&
                                    styles.userTime,
                                ]}
                            >
                                {message.time}
                            </Text>
                        </View>
                    </View>
                ))}

                {/* Digitando */}
                {typing && (
                    <View style={styles.messageRow}>
                        <GradientText style={styles.botIconText}>
                            ✦
                        </GradientText>

                        <View style={styles.typingBubble}>
                            <View style={styles.typingDots}>
                                <View style={styles.dot} />
                                <View style={styles.dot} />
                                <View style={styles.dot} />
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Respostas rápidas */}
            {messages.length <= 2 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.quickScroll}
                    contentContainerStyle={styles.quickContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {QUICK.map((question) => (
                        <Pressable
                            key={question}
                            style={styles.quickButton}
                            onPress={() => send(question)}
                        >
                            <Text style={styles.quickText}>
                                {question}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            )}

            {/* Banner se microfone bloqueado nas permissões do Android */}
            {permissionDenied && (
                <View style={styles.permissionBanner}>
                    <Ionicons name="mic-off-outline" size={18} color="#EF4444" />
                    <Text style={styles.permissionText}>
                        Microfone bloqueado no Android.
                    </Text>
                    <Pressable
                        style={styles.permissionBtn}
                        onPress={() => Linking.openSettings()}
                    >
                        <Text style={styles.permissionBtnText}>Configurações</Text>
                    </Pressable>
                </View>
            )}

            {/* Indicador de escuta */}
            {isListening && (
                <View style={styles.listeningBadge}>
                    <Ionicons name="radio" size={14} color={colors.danger} />
                    <Text style={styles.listeningText}>
                        Ouvindo... Fale agora
                    </Text>
                </View>
            )}

            {/* Campo de mensagem */}
            <View style={styles.inputContainer}>
                <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder="Pergunte sobre suas finanças..."
                    placeholderTextColor={colors.mutedForeground}
                    style={styles.input}
                    multiline
                    maxLength={500}
                    editable={!typing}
                    onSubmitEditing={() => send(input)}
                    blurOnSubmit={false}
                />

                {/* Botão de Microfone */}
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Pressable
                        style={[
                            styles.micButton,
                            isListening && styles.micButtonListening,
                        ]}
                        onPress={handleToggleListening}
                        disabled={typing}
                    >
                        <Ionicons
                            name={isListening ? "mic" : "mic-outline"}
                            size={18}
                            color={isListening ? "#FFFFFF" : colors.foreground}
                        />
                    </Pressable>
                </Animated.View>

                {/* Botão de Enviar */}
                <Pressable
                    style={[
                        styles.sendButton,
                        input.trim() && !typing
                            ? styles.sendButtonActive
                            : styles.sendButtonInactive,
                    ]}
                    onPress={() => send(input)}
                    disabled={!input.trim() || typing}
                >
                    <Ionicons
                        name="send"
                        size={17}
                        color={
                            input.trim() && !typing
                                ? colors.primaryForeground
                                : colors.mutedForeground
                        }
                    />
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    /* Header */
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 14,
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    finnIcon: {
        flex: 1,
        borderRadius: 15,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
    finnIconBorder: {
        width: 50,
        height: 50,
        borderRadius: 16,
        padding: 1,
    },
    finnSymbol: {
        color: colors.primary,
        fontSize: 25,
    },
    finnName: {
        color: colors.foreground,
        fontSize: 20,
        fontWeight: "700",
    },
    onlineText: {
        fontSize: 15,
    },
    onlineStatus: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    onlineIndicator: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#22C55E",
        marginRight: 5,
    },
    /* Mensagens */
    messages: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
    },
    messageRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
    },
    botRow: {
        justifyContent: "flex-start",
    },
    userRow: {
        justifyContent: "flex-end",
    },
    botIconText: {
        color: colors.primary,
        fontSize: 13,
    },
    messageContainer: {
        maxWidth: "80%",
    },
    messageBubble: {
        paddingHorizontal: 13,
        paddingVertical: 11,
        borderRadius: 16,
    },
    botBubble: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomLeftRadius: 4,
    },
    userBubble: {
        backgroundColor: colors.foreground,
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 17,
        lineHeight: 20,
    },
    botText: {
        color: colors.cardForeground,
    },
    userText: {
        color: colors.primaryForeground,
    },
    messageTime: {
        color: colors.mutedForeground,
        fontSize: 10,
        marginTop: 3,
        marginLeft: 4,
    },
    userTime: {
        textAlign: "right",
        marginRight: 4,
    },
    /* Digitando */
    typingBubble: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomLeftRadius: 4,
        borderRadius: 16,
        paddingHorizontal: 13,
        paddingVertical: 13,
    },
    typingDots: {
        flexDirection: "row",
        gap: 4,
        alignItems: "center",
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: colors.mutedForeground,
    },
    /* Respostas rápidas */
    quickScroll: {
        flexGrow: 0,
    },
    quickContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    quickButton: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 5,
        maxWidth: 180,
    },
    quickText: {
        color: colors.mutedForeground,
        fontSize: 15,
    },
    /* Banner de Permissão */
    permissionBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(239, 68, 68, 0.3)",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    permissionText: {
        color: "#FCA5A5",
        fontSize: 13,
        flex: 1,
    },
    permissionBtn: {
        backgroundColor: "#EF4444",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    permissionBtnText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "600",
    },
    /* Indicador de escuta */
    listeningBadge: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: "rgba(255, 107, 107, 0.12)",
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 107, 107, 0.2)",
    },
    listeningText: {
        color: colors.danger,
        fontSize: 12,
        fontWeight: "600",
    },
    /* Input */
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 28 : 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
    },
    input: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        minHeight: 46,
        maxHeight: 110,
        color: colors.foreground,
        fontSize: 15,
    },
    micButton: {
        width: 46,
        height: 46,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    micButtonListening: {
        backgroundColor: colors.danger,
        borderColor: colors.danger,
    },
    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    sendButtonActive: {
        backgroundColor: colors.foreground,
    },
    sendButtonInactive: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
});
