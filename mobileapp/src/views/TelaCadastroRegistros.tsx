import { StyleSheet, Text, View, Pressable } from "react-native";
import { useState } from "react";

import { colors } from "../styles/colors";

export default function TelaCadastroRegistros() {

  const [novoAberto, setNovoAberto] = useState(false);

  const transacoes = [
    {
      id: "1",
      tipo: "income",
      descricao: "Salário",
      categoria: "Salário",
      valor: 5000,
      data: "05/08/2026",
    }
  ];

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.month}>Agosto 2026</Text>
          <Text style={styles.title}>Registros</Text>
        </View>

        <Pressable
          style={styles.newButton}
          onPress={() => setNovoAberto(true)}
        >
          <Text style={styles.newButtonText}>+ Novo</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={[styles.summaryCard, styles.incomeCard]}>
          <Text style={styles.summaryLabel}>Receitas</Text>
          <Text style={styles.incomeValue}>+R$ 0</Text>
        </View>

        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.summaryLabel}>Despesas</Text>
          <Text style={styles.expenseValue}>-R$ 0</Text>
        </View>

        <View style={[styles.summaryCard, styles.creditCard]}>
          <Text style={styles.summaryLabel}>Crédito</Text>
          <Text style={styles.creditValue}>R$ 0</Text>
        </View>
      </View>

      <View style={styles.transactions}>
        {transacoes.map((transacao) => (
          <View key={transacao.id} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <Text>💰</Text>
            </View>

            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>
                {transacao.descricao}
              </Text>

              <Text style={styles.transactionCategory}>
                {transacao.categoria}
              </Text>

              <Text style={styles.transactionMeta}>
                👤 Usuário · {transacao.data}
              </Text>
            </View>

            <Text style={styles.transactionValue}>
              +R$ {transacao.valor.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 25,
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 15
  },
  month: {
    color: colors.mutedForeground,
    fontSize: 20,
  },
  newButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newButtonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "600",
  },
  summary: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  incomeCard: {
    backgroundColor: "rgba(74, 222, 128, 0.07)",
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  expenseCard: {
    backgroundColor: "rgba(255, 107, 107, 0.07)",
    borderColor: "rgba(255, 107, 107, 0.2)",
  },
  creditCard: {
    backgroundColor: "rgba(251, 191, 36, 0.07)",
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  summaryLabel: {
    color: colors.mutedForeground,
    fontSize: 15,
    marginBottom: 3,
  },
  incomeValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "700",
  },
  expenseValue: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: "700",
  },
  creditValue: {
    color: colors.warning,
    fontSize: 20,
    fontWeight: "700",
  },
  transactions: {
    gap: 8,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  transactionCategory: {
    color: colors.mutedForeground,
    fontSize: 15,
    marginTop: 2,
  },
  transactionMeta: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 4,
  },
  transactionValue: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
});