import {
    StyleSheet,
    Text,
    View,
    Pressable,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../styles/colors";

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
    const [messages, setMessages] = useState<Msg[]>(INITIAL);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);

    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages, typing]);

    function now() {
        return new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function send(text: string) {
        if (!text.trim() || typing) return;

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
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* Cabeçalho */}
            <View style={styles.header}>
                <View style={styles.finnIcon}>
                    <Text style={styles.finnSymbol}>✦</Text>

                    <View style={styles.onlineDot} />
                </View>

                <View>
                    <Text style={styles.finnName}>Finn</Text>

                    <Text style={styles.onlineText}>
                        ● Online · Assistente Financeiro
                    </Text>
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
                            <View style={styles.botIcon}>
                                <Text style={styles.botIconText}>✦</Text>
                            </View>
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
                        <View style={styles.botIcon}>
                            <Text style={styles.botIconText}>✦</Text>
                        </View>

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
        paddingTop: 20,
        paddingBottom: 14,
        gap: 12,
    },
    finnIcon: {
        width: 42,
        height: 42,
        borderRadius: 16,
        backgroundColor: "rgba(74, 222, 128, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(74, 222, 128, 0.3)",
        alignItems: "center",
        justifyContent: "center",
    },
    finnSymbol: {
        color: colors.primary,
        fontSize: 21,
    },
    onlineDot: {
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: colors.background,
    },
    finnName: {
        color: colors.foreground,
        fontSize: 15,
        fontWeight: "700",
    },
    onlineText: {
        color: colors.primary,
        fontSize: 11,
        marginTop: 2,
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
    botIcon: {
        width: 28,
        height: 28,
        borderRadius: 11,
        backgroundColor: "rgba(74, 222, 128, 0.15)",
        alignItems: "center",
        justifyContent: "center",
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
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 13,
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
        paddingVertical: 9,
        maxWidth: 180,
    },
    quickText: {
        color: colors.mutedForeground,
        fontSize: 12,
    },
    /* Input */
    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: colors.foreground,
        fontSize: 13,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    sendButtonActive: {
        backgroundColor: colors.primary,
    },
    sendButtonInactive: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
});