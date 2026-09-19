import { StyleSheet, Text, View } from "react-native";

import { colors } from "../styles/colors";

export default function TelaInicial() {
    return (
        <View style={styles.container}>
            {/* Cabeçalho */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Bom dia! 👋</Text>
                    <Text style={styles.title}>Visão Geral</Text>
                </View>

                <View style={styles.profile}>
                    <Text style={styles.profileIcon}>👤</Text>
                </View>
            </View>

            {/* Card de saldo */}
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>SALDO TOTAL</Text>

                <Text style={styles.balance}>
                    R$ <Text>24.680,50</Text>
                </Text>

                <View style={styles.summary}>
                    <View>
                        <Text style={styles.summaryLabel}>Receitas</Text>
                        <Text style={styles.income}>+R$ 8.500</Text>
                    </View>

                    <View style={styles.divider} />

                    <View>
                        <Text style={styles.summaryLabel}>Despesas</Text>
                        <Text style={styles.expense}>-R$ 4.200</Text>
                    </View>

                    <View style={styles.divider} />

                    <View>
                        <Text style={styles.summaryLabel}>Caixinha</Text>
                        <Text style={styles.savings}>R$ 2.350</Text>
                    </View>
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
        backgroundColor: "#0F2318",
        borderWidth: 1,
        borderColor: "rgba(74, 222, 128, 0.15)",
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
        color: "#60A5FA",
        fontSize: 20,
        fontWeight: "600",
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
        marginHorizontal: 14,
    },
});