import { StyleSheet, Text, View, Pressable, Modal } from "react-native";
import { useState } from "react";

import { colors } from "../styles/colors";

import Input from "../components/Input"
import GradientButton from "../components/GradientButton";

export default function TelaCadastroRegistros() {

  const [novoAberto, setNovoAberto] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState<
    "income" | "expense" | null
  >(null);
  const [formAberto, setFormAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<
    "normal" | "credit"
  >("normal");
  const [parcelas, setParcelas] = useState("1");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [erroDescricao, setErroDescricao] = useState("");
  const [erroValor, setErroValor] = useState("");

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

  const categoriasReceita = [
    "Salário",
    "Freelance",
    "Aluguel",
    "Dividendos",
    "Presente",
    "Outros",
  ];

  const categoriasDespesa = [
    "Alimentação",
    "Transporte",
    "Moradia",
    "Saúde",
    "Lazer",
    "Educação",
    "Assinatura",
    "Tecnologia",
    "Outros",
  ];

  const salvarTransacao = () => {
    let valido = true;

    if (!descricao.trim()) {
      setErroDescricao("Informe uma descrição.");
      valido = false;
    } else {
      setErroDescricao("");
    }

    if (!valor.trim()) {
      setErroValor("Informe um valor.");
      valido = false;
    } else {
      setErroValor("");
    }

    if (!valido) {
      return;
    }

    const novaTransacao = {
      id: Date.now().toString(),
      tipo: tipoRegistro,
      descricao: descricao.trim(),
      valor: Number(valor.replace(",", ".")),
      categoria,
      formaPagamento:
        tipoRegistro === "expense" ? formaPagamento : null,
      parcelas:
        tipoRegistro === "expense" && formaPagamento === "credit"
          ? Number(parcelas)
          : null,
      diaVencimento:
        tipoRegistro === "expense" && formaPagamento === "credit"
          ? Number(diaVencimento)
          : null,
      data: new Date().toISOString(),
    };

    console.log("Nova transação:", novaTransacao);

    setFormAberto(false);
  };

  const limparFormulario = () => {
    setDescricao("");
    setValor("");
    setCategoria("");
    setFormaPagamento("normal");
    setParcelas("1");
    setDiaVencimento("");
    setErroDescricao("");
    setErroValor("");
  };

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.month}>Agosto 2026</Text>
          <Text style={styles.title}>Registros</Text>
        </View>

        <GradientButton
          title="+ Novo"
          onPress={() => setNovoAberto(true)}
          style={{ minWidth: 70 }}
        />
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

      <Modal
        visible={novoAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setNovoAberto(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo registro</Text>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                limparFormulario();
                setTipoRegistro("income");
                setNovoAberto(false);
                setFormAberto(true);
              }}
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

              <View>
                <Text style={styles.modalOptionTitle}>Receita</Text>
                <Text style={styles.modalOptionDescription}>
                  Adicionar uma entrada
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                limparFormulario();
                setTipoRegistro("expense");
                setNovoAberto(false);
                setFormAberto(true);
              }}
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

              <View>
                <Text style={styles.modalOptionTitle}>Despesa</Text>
                <Text style={styles.modalOptionDescription}>
                  Adicionar uma saída
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.modalCancel}
              onPress={() => setNovoAberto(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={formAberto}
        transparent
        animationType="slide"
        onRequestClose={() => {
          limparFormulario();
          setFormAberto(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {tipoRegistro === "income"
                ? "Nova Receita"
                : "Nova Despesa"}
            </Text>

            {/* formulário entra aqui */}
            <View style={styles.formFields}>
              <Input
                label="Descrição"
                placeholder="Ex: Salário"
                value={descricao}
                onChangeText={(texto) => {
                  setDescricao(texto);

                  if (texto.trim()) {
                    setErroDescricao("");
                  }
                }}
              />
              {erroDescricao ? (
                <Text style={styles.errorText}>{erroDescricao}</Text>
              ) : null}

              <Input
                label="Valor"
                placeholder="R$ 0,00"
                value={valor}
                onChangeText={(texto) => {
                  setValor(texto);

                  if (texto.trim()) {
                    setErroValor("");
                  }
                }}
                keyboardType="numeric"
              />

              {erroValor ? (
                <Text style={styles.errorText}>{erroValor}</Text>
              ) : null}

              {tipoRegistro === "expense" && (
                <View style={styles.paymentSection}>
                  <Text style={styles.categoryLabel}>Forma de pagamento</Text>

                  <View style={styles.paymentList}>
                    <Pressable
                      style={[
                        styles.paymentButton,
                        formaPagamento === "normal" && styles.paymentButtonSelected,
                      ]}
                      onPress={() => setFormaPagamento("normal")}
                    >
                      <Text
                        style={[
                          styles.paymentText,
                          formaPagamento === "normal" && styles.paymentTextSelected,
                        ]}
                      >
                        À vista
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.paymentButton,
                        formaPagamento === "credit" && styles.paymentButtonSelected,
                      ]}
                      onPress={() => setFormaPagamento("credit")}
                    >
                      <Text
                        style={[
                          styles.paymentText,
                          formaPagamento === "credit" && styles.paymentTextSelected,
                        ]}
                      >
                        Cartão de crédito
                      </Text>
                    </Pressable>
                  </View>

                  {tipoRegistro === "expense" && formaPagamento === "credit" && (
                    <View style={styles.creditSection}>
                      <Text style={styles.categoryLabel}>Parcelamento</Text>

                      <View style={styles.installmentList}>
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((item) => (
                          <Pressable
                            key={item}
                            style={[
                              styles.installmentButton,
                              parcelas === item && styles.installmentButtonSelected,
                            ]}
                            onPress={() => setParcelas(item)}
                          >
                            <Text
                              style={[
                                styles.installmentText,
                                parcelas === item && styles.installmentTextSelected,
                              ]}
                            >
                              {item}x
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Input
                        label="Dia de vencimento"
                        placeholder="Ex: 10"
                        value={diaVencimento}
                        onChangeText={setDiaVencimento}
                        keyboardType="numeric"
                      />
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.categoryLabel}>Categoria</Text>

              <View style={styles.categoryList}>
                {(tipoRegistro === "income"
                  ? categoriasReceita
                  : categoriasDespesa
                ).map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.categoryButton,
                      categoria === item && styles.categoryButtonSelected,
                    ]}
                    onPress={() => setCategoria(item)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        categoria === item && styles.categoryTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <GradientButton
                title="Salvar"
                onPress={salvarTransacao}
                style={{ marginTop: 20 }}
              />
            </View>
          </View>
        </View>
      </Modal>


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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  modalOptionTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "600",
  },
  modalOptionDescription: {
    color: colors.mutedForeground,
    fontSize: 15,
    marginTop: 3,
  },
  modalCancel: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  modalCancelText: {
    color: colors.mutedForeground,
    fontSize: 15,
    fontWeight: "600",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 20,
    fontWeight: "700",
  },
  formFields: {
    gap: 5,
    marginTop: 8,
  },
  categoryLabel: {
    color: colors.secondaryForeground,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryButtonSelected: {
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    borderColor: colors.primary,
  },
  categoryText: {
    color: colors.secondaryForeground,
    fontSize: 12,
  },
  categoryTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  paymentSection: {
    marginTop: 4,
  },
  paymentList: {
    flexDirection: "row",
    gap: 8,
  },
  paymentButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  paymentButtonSelected: {
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    borderColor: colors.primary,
  },
  paymentText: {
    color: colors.secondaryForeground,
    fontSize: 12,
  },
  paymentTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  creditSection: {
    marginTop: 14,
  },
  installmentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  installmentButton: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  installmentButtonSelected: {
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    borderColor: colors.primary,
  },
  installmentText: {
    color: colors.secondaryForeground,
    fontSize: 12,
  },
  installmentTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: -15,
  },
});