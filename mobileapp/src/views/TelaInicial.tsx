import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/types";

import { colors } from "../styles/colors";
import { auth, db } from "../firebase";
import { listarContas, obterExtrato, obterUsuario } from "../../../shared/services/finupService";

import type { Transacao } from "../../../shared/types/finup";

export default function TelaInicial() {

    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [nomeUsuario, setNomeUsuario] = useState("");
    const [saldoTotal, setSaldoTotal] = useState(0);
    const [receitas, setReceitas] = useState(0);
    const [despesas, setDespesas] = useState(0);
    const [loadError, setLoadError] = useState("");

    const [transacoes, setTransacoes] = useState<Transacao[]>([]);
    const [larguraGrafico, setLarguraGrafico] = useState(0);

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
                setTransacoes(transactions);
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

    {/* Fluxo Mensal */ }
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth();
    const diaAtual = new Date().getDate();

    const meses = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];

    const fluxoMensal = meses.map((nome, mes) => {
        const movimentacoes = transacoes.filter((item) => {
            const data = item.dataTransacao;

            return (
                data.getFullYear() === anoAtual &&
                data.getMonth() === mes &&
                item.status === "EFETIVADO" &&
                !item.estornado
            );
        });

        const totalReceitas = movimentacoes
            .filter((item) => item.tipoMovimentacao === "RECEITA")
            .reduce((total, item) => total + item.valor, 0);

        const totalDespesas = movimentacoes
            .filter((item) => item.tipoMovimentacao === "DESPESA")
            .reduce((total, item) => total + item.valor, 0);

        return {
            nome,
            mes,
            receitas: totalReceitas,
            despesas: totalDespesas,
            resultado: totalReceitas - totalDespesas,
        };
    });

    // Altura proporcional das barras, mantendo um limite visual.
    const maiorResultado = Math.max(
        1,
        ...fluxoMensal.map((item) => Math.abs(item.resultado)),
    );

    const alturaMaximaBarra = 76;

    // Compara o mês atual com o anterior até o mesmo dia,
    // limitando a comparação ao último dia de cada mês.
    const inicioMesAtual = new Date(anoAtual, mesAtual, 1);
    const inicioMesAnterior = new Date(anoAtual, mesAtual - 1, 1);

    const diasComparacaoAnterior = Math.min(
        diaAtual,
        new Date(
            inicioMesAnterior.getFullYear(),
            inicioMesAnterior.getMonth() + 1,
            0,
        ).getDate(),
    );

    const totalAteData = (
        ano: number,
        mes: number,
        diaLimite: number,
    ) => {
        return transacoes
            .filter((item) => {
                const data = item.dataTransacao;

                return (
                    data.getFullYear() === ano &&
                    data.getMonth() === mes &&
                    data.getDate() <= diaLimite &&
                    item.status === "EFETIVADO" &&
                    !item.estornado &&
                    (
                        item.tipoMovimentacao === "RECEITA" ||
                        item.tipoMovimentacao === "DESPESA"
                    )
                );
            })
            .reduce((total, item) => {
                return total + (
                    item.tipoMovimentacao === "RECEITA"
                        ? item.valor
                        : -item.valor
                );
            }, 0);
    };

    const resultadoAtual = totalAteData(
        anoAtual,
        mesAtual,
        diaAtual,
    );

    const resultadoAnterior = totalAteData(
        inicioMesAnterior.getFullYear(),
        inicioMesAnterior.getMonth(),
        diasComparacaoAnterior,
    );

    // Só existe percentual comparável se o período anterior
    // tiver resultado diferente de zero.
    const percentualFluxo =
        resultadoAnterior !== 0
            ? ((resultadoAtual - resultadoAnterior) /
                Math.abs(resultadoAnterior)) * 100
            : null;

    const fluxoPositivo = resultadoAtual >= 0;

    const percentualTexto =
        percentualFluxo === null
            ? "—"
            : `${percentualFluxo > 0 ? "+" : ""}${percentualFluxo
                .toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                })}% ${percentualFluxo > 0
                    ? "↑"
                    : percentualFluxo < 0
                        ? "↓"
                        : "→"}`;

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
                    <View>
                        <Text style={styles.cashFlowTitle}>
                            Fluxo de Caixa
                        </Text>
                        <Text style={styles.cashFlowSubtitle}>
                            Resultado Mensal · {anoAtual}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.percentageBadge,
                            fluxoPositivo
                                ? styles.percentageBadgePositive
                                : styles.percentageBadgeNegative,
                        ]}
                    >
                        <Text
                            style={[
                                styles.percentageText,
                                fluxoPositivo
                                    ? styles.percentageTextPositive
                                    : styles.percentageTextNegative,
                            ]}
                        >
                            {percentualTexto}
                        </Text>
                    </View>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                    onLayout={(event) =>
                        setLarguraGrafico(event.nativeEvent.layout.width)
                    }
                    contentContainerStyle={styles.chartScrollContent}
                >
                    {fluxoMensal.map((item) => {
                        const positivo = item.resultado > 0;
                        const negativo = item.resultado < 0;
                        const mesSelecionado = item.mes === mesAtual;

                        const alturaBarra =
                            item.resultado === 0
                                ? 3
                                : Math.max(
                                    5,
                                    (
                                        Math.abs(item.resultado) /
                                        maiorResultado
                                    ) * alturaMaximaBarra,
                                );

                        const corBarra = positivo
                            ? "#4ADE80"
                            : negativo
                                ? "#FF6B6B"
                                : colors.border;

                        return (
                            <View
                                key={item.nome}
                                style={[
                                    styles.chartMonthColumn,
                                    larguraGrafico > 0 && {
                                        width: larguraGrafico / 6,
                                    },
                                ]}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.chartValue,
                                        {
                                            color: corBarra,
                                        },
                                    ]}
                                >
                                    {item.resultado === 0
                                        ? "R$ 0"
                                        : `${negativo ? "-" : "+"}${Math.abs(
                                            item.resultado,
                                        ).toLocaleString("pt-BR", {
                                            maximumFractionDigits: 0,
                                        })}`}
                                </Text>

                                <View style={styles.chartBarArea}>
                                    <View
                                        style={[
                                            styles.chartBar,
                                            {
                                                height: alturaBarra,
                                                backgroundColor: corBarra,
                                            },
                                        ]}
                                    />
                                </View>

                                <View
                                    style={[
                                        styles.month,
                                        mesSelecionado && styles.monthActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.monthText,
                                            mesSelecionado &&
                                            styles.monthTextActive,
                                        ]}
                                    >
                                        {item.nome}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
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
        fontSize: 15,
        marginBottom: 3,
    },
    income: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: "600",
    },
    expense: {
        color: "#FF6B6B",
        fontSize: 18,
        fontWeight: "600",
    },
    savings: {
        color: colors.info,
        fontSize: 18,
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
        marginTop: 30,
    },
    cashFlowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 30,
    },
    cashFlowTitle: {
        color: colors.foreground,
        fontSize: 20,
        fontWeight: "600",
    },
    cashFlowSubtitle: {
        color: colors.mutedForeground,
        fontSize: 15,
        marginTop: 4,
    },
    percentageBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    percentageBadgePositive: {
        backgroundColor: "rgba(74, 222, 128, 0.1)",
    },
    percentageBadgeNegative: {
        backgroundColor: "rgba(255, 107, 107, 0.12)",
    },
    percentageText: {
        fontSize: 15,
        fontWeight: "600",
    },
    percentageTextPositive: {
        color: "#4ADE80",
    },
    percentageTextNegative: {
        color: "#FF6B6B",
    },
    chartScrollContent: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingTop: 4,
    },
    chartMonthColumn: {
        width: 42,
        alignItems: "center",
    },
    chartValue: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
    },
    chartBarArea: {
        height: 80,
        width: "100%",
        alignItems: "center",
        justifyContent: "flex-end",
    },
    chartBar: {
        width: 22,
        borderRadius: 5,
        minHeight: 3,
    },
    month: {
        paddingHorizontal: 7,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 8,
    },
    monthActive: {
        backgroundColor: colors.primary,
    },
    monthText: {
        color: colors.mutedForeground,
        fontSize: 13,
    },
    monthTextActive: {
        color: colors.primaryForeground,
        fontWeight: "600",
    },
});