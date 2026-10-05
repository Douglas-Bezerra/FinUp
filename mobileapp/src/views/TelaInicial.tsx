import { StyleSheet, Text, View, Pressable } from "react-native";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/types";

import { colors } from "../styles/colors";
import { auth, db } from "../firebase";
import { listarContas, obterExtrato, obterUsuario } from "../../../shared/services/finupService";

export default function TelaInicial() {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [nomeUsuario, setNomeUsuario] = useState("");
    const [saldoTotal, setSaldoTotal] = useState(0);
    const [receitas, setReceitas] = useState(0);
    const [despesas, setDespesas] = useState(0);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function carregarResumo() {
            try {
                const currentUser = auth.currentUser;
                if (!currentUser) throw new Error("Sua sessão expirou.");
                const profile = await obterUsuario(db, currentUser.uid);
                if (!profile) throw new Error("Não encontramos seu perfil financeiro.");
                const [accounts, transactions] = await Promise.all([
                    listarContas(db, profile.familiaId),
                    obterExtrato(db, profile.familiaId),
                ]);
                if (cancelled) return;
                setNomeUsuario(profile.nome);
                setSaldoTotal(accounts.reduce((total, account) => total + account.saldoAtual, 0));
                const currentMonth = new Date().toISOString().slice(0, 7);
                setReceitas(transactions
                    .filter((item) => item.tipoMovimentacao === "RECEITA" && item.status === "EFETIVADO" && !item.estornado
                        && item.dataTransacao.toISOString().slice(0, 7) === currentMonth)
                    .reduce((total, item) => total + item.valor, 0));
                setDespesas(transactions
                    .filter((item) => item.tipoMovimentacao === "DESPESA" && item.status === "EFETIVADO" && !item.estornado
                        && item.dataTransacao.toISOString().slice(0, 7) === currentMonth)
                    .reduce((total, item) => total + item.valor, 0));
            } catch (error) {
                console.error("Erro ao carregar resumo financeiro:", error);
                if (!cancelled) setLoadError("Não foi possível carregar seu resumo financeiro.");
            }
        }
        void carregarResumo();
        return () => {
            cancelled = true;
        };
    }, []);

    const currency = (value: number) => value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    });

    return (
        <View style={styles.container}>

            {/* Cabeçalho */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{nomeUsuario ? `Olá, ${nomeUsuario.split(/\s+/)[0]}` : "Sua vida financeira"}</Text>
                    <Text style={styles.title}>Visão Geral</Text>
                </View>

                <View style={styles.profile}>
                    <Text style={styles.profileIcon}>👤</Text>
                </View>
            </View>

            {/* Ações rápidas */}
            <View style={styles.quickActions}>
                <Pressable
                    style={styles.quickAction}
                    onPress={() => navigation.navigate("CadastroRegistros")}
                >
                    <View
                        style={[
                            styles.actionIcon,
                            { backgroundColor: "rgba(74, 222, 128, 0.12)" },
                        ]}
                    >
                        <Text style={[styles.actionIconText, { color: colors.primary }]}>
                            ↑
                        </Text>
                    </View>

                    <Text style={styles.actionLabel}>Receita</Text>
                </Pressable>

                <Pressable
                    style={styles.quickAction}
                    onPress={() => navigation.navigate("CadastroRegistros")}
                >
                    <View
                        style={[
                            styles.actionIcon,
                            { backgroundColor: "rgba(255, 107, 107, 0.12)" },
                        ]}
                    >
                        <Text style={[styles.actionIconText, { color: colors.danger }]}>
                            ↓
                        </Text>
                    </View>

                    <Text style={styles.actionLabel}>Despesa</Text>
                </Pressable>

                <View style={styles.quickAction}>
                    <View style={[styles.actionIcon, { backgroundColor: "rgba(96, 165, 250, 0.12)" }]}>
                        <Text style={[styles.actionIconText, { color: colors.info }]}>$</Text>
                    </View>

                    <Text style={styles.actionLabel}>Caixinha</Text>
                </View>

                <Pressable
                    style={styles.quickAction}
                    onPress={() => navigation.navigate("Assistente")}
                >
                    <View
                        style={[
                            styles.actionIcon,
                            { backgroundColor: "rgba(192, 132, 252, 0.12)" },
                        ]}
                    >
                        <Text
                            style={[
                                styles.actionIconText,
                                { color: "#C084FC" },
                            ]}
                        >
                            ✦
                        </Text>
                    </View>

                    <Text style={styles.actionLabel}>Assistente</Text>
                </Pressable>

            </View>

            {/* Card de saldo */}
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>SALDO TOTAL</Text>

                <Text style={styles.balance}>
                    {currency(saldoTotal)}
                </Text>

                {loadError ? <Text style={styles.greeting}>{loadError}</Text> : null}
                <View style={styles.summary}>
                    <View>
                        <Text style={styles.summaryLabel}>Receitas</Text>
                        <Text style={styles.income}>+{currency(receitas)}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View>
                        <Text style={styles.summaryLabel}>Despesas</Text>
                        <Text style={styles.expense}>-{currency(despesas)}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View>
                        <Text style={styles.summaryLabel}>Caixinha</Text>
                        <Text style={styles.savings}>{currency(0)}</Text>
                    </View>
                </View>
            </View>

            {/* Fluxo de Caixa */}
            <View style={styles.cashFlowCard}>
                <View style={styles.cashFlowHeader}>
                    <Text style={styles.cashFlowTitle}>Fluxo de Caixa</Text>

                    <View style={styles.percentageBadge}>
                        <Text style={styles.percentageText}>+18,2% ↑</Text>
                    </View>
                </View>

                {/* Meses */}
                <View style={styles.months}>
                    {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"].map((month, index) => (
                        <View
                            key={month}
                            style={[
                                styles.month,
                                index === 6 && styles.monthActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.monthText,
                                    index === 6 && styles.monthTextActive,
                                ]}
                            >
                                {month}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>


        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 20,
        paddingTop: 50,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    greeting: {
        color: colors.mutedForeground,
        fontSize: 15,
    },
    title: {
        color: colors.foreground,
        fontSize: 30,
        fontWeight: "700",
        marginTop: 2,
    },
    profile: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    profileIcon: {
        fontSize: 16,
    },
    balanceCard: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderRadius: 16,
        padding: 20,
    },
    balanceLabel: {
        color: colors.mutedForeground,
        fontSize: 12,
        fontWeight: "500",
        letterSpacing: 1,
    },
    balance: {
        color: colors.foreground,
        fontSize: 34,
        fontWeight: "700",
        marginTop: 6,
    },
    summary: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 20,
    },
    summaryLabel: {
        color: colors.mutedForeground,
        fontSize: 20,
        marginBottom: 3,
    },
    income: {
        color: colors.primary,
        fontSize: 20,
        fontWeight: "600",
    },
    expense: {
        color: "#FF6B6B",
        fontSize: 20,
        fontWeight: "600",
    },
    savings: {
        color: colors.info,
        fontSize: 20,
        fontWeight: "600",
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
        marginHorizontal: 14,
    },
    quickActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 30
    },
    quickAction: {
        width: "23%",
        alignItems: "center",
        paddingVertical: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
    },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: 27,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    actionIconText: {
        fontSize: 27,
        fontWeight: "700",
    },
    actionLabel: {
        color: colors.mutedForeground,
        fontSize: 15,
        fontWeight: "500",
    },
    cashFlowCard: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
    },
    cashFlowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    cashFlowTitle: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: "600",
    },
    percentageBadge: {
        backgroundColor: "rgba(74, 222, 128, 0.1)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    percentageText: {
        color: colors.primary,
        fontSize: 11,
    },
    months: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 16,
    },
    month: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    monthActive: {
        backgroundColor: colors.primary,
    },
    monthText: {
        color: colors.mutedForeground,
        fontSize: 11,
    },
    monthTextActive: {
        color: colors.primaryForeground,
        fontWeight: "600",
    },
});