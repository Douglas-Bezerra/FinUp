import { Alert, StyleSheet, Text, View, Pressable, Modal } from "react-native";
import { useState, useEffect } from "react";

import { colors } from "../styles/colors";

import Input from "../components/Input"
import GradientButton from "../components/GradientButton";

import { auth, db } from "../firebase";
import {
  cadastrarTransacao,
  cadastrarTransferencia,
  criarConta,
  efetivarTransacaoPendente,
  listarCategorias,
  listarContas,
  obterExtrato,
  obterUsuario,
} from "../../../shared/services/finupService";
import type { Categoria, Conta, Transacao, Usuario } from "../../../shared/types/finup";

export default function TelaCadastroRegistros() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [contaId, setContaId] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [novoAberto, setNovoAberto] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState<
    "income" | "expense" | "transfer" | null
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
  const [contaAberta, setContaAberta] = useState(false);
  const [nomeConta, setNomeConta] = useState("");
  const [tipoConta, setTipoConta] = useState<Conta["tipoConta"]>("CORRENTE");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function carregarDados() {
      setIsLoading(true);
      setErroCarregamento("");
      try {
        const authUser = auth.currentUser;
        if (!authUser) throw new Error("Sua sessão expirou. Entre novamente.");
        const profile = await obterUsuario(db, authUser.uid);
        if (!profile) throw new Error("Não encontramos seu perfil financeiro.");
        const [accounts, categories, records] = await Promise.all([
          listarContas(db, profile.familiaId),
          listarCategorias(db, profile.familiaId),
          obterExtrato(db, profile.familiaId),
        ]);
        if (cancelled) return;
        setUsuario(profile);
        setContas(accounts);
        setCategorias(categories);
        setTransacoes(records);
        setContaId((current) => current || accounts[0]?.id || "");
        setContaDestinoId((current) => current || accounts.find((item) => item.id !== accounts[0]?.id)?.id || "");
      } catch (error) {
        console.error("Erro ao carregar registros do Firestore:", error);
        if (!cancelled) setErroCarregamento("Não foi possível carregar seus dados financeiros.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void carregarDados();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const categoriaTipo = tipoRegistro === "income"
    ? "RECEITA"
    : tipoRegistro === "expense"
      ? "DESPESA"
      : "TRANSFERENCIA";
  const categoriasVisiveis = categorias.filter((item) =>
    item.tipo === categoriaTipo || item.tipo === "AMBAS",
  );
  const currentDate = new Date();
  const receitaMes = transacoes
    .filter((item) => item.tipoMovimentacao === "RECEITA" && item.status === "EFETIVADO" && !item.estornado
      && item.dataTransacao.getFullYear() === currentDate.getFullYear()
      && item.dataTransacao.getMonth() === currentDate.getMonth())
    .reduce((total, item) => total + item.valor, 0);
  const despesaMes = transacoes
    .filter((item) => item.tipoMovimentacao === "DESPESA" && item.status === "EFETIVADO" && !item.estornado
      && item.dataTransacao.getFullYear() === currentDate.getFullYear()
      && item.dataTransacao.getMonth() === currentDate.getMonth())
    .reduce((total, item) => total + item.valor, 0);
  const creditPending = transacoes
    .filter((item) => item.formaPagamento === "credit" && item.status === "PENDENTE" && !item.estornado
      && item.dataTransacao.getFullYear() === currentDate.getFullYear()
      && item.dataTransacao.getMonth() === currentDate.getMonth())
    .reduce((total, item) => total + item.valor, 0);

  const salvarTransacao = async () => {
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
    const valorNumerico = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErroValor("Informe um valor maior que zero.");
      valido = false;
    }
    if (!valido) return;

    const selectedCategory = categoriasVisiveis.find((item) => item.nome === categoria);
    if (!usuario || !contaId || !selectedCategory) {
      Alert.alert("Dados incompletos", "Selecione uma conta e uma categoria cadastradas.");
      return;
    }

    try {
      const common = {
        descricao: descricao.trim(),
        valor: valorNumerico,
        dataTransacao: new Date(),
        status: tipoRegistro === "expense" && formaPagamento === "credit" ? "PENDENTE" as const : "EFETIVADO" as const,
        criadoPorUsuarioId: usuario.id,
        criadoPorNome: usuario.nome,
      };
      if (tipoRegistro === "transfer") {
        if (!contaDestinoId || contaDestinoId === contaId) {
          Alert.alert("Contas inválidas", "Selecione contas de origem e destino diferentes.");
          return;
        }
        await cadastrarTransferencia(db, usuario.familiaId, {
          ...common,
          contaOrigemId: contaId,
          contaDestinoId,
          categoriaId: selectedCategory.id,
        });
      } else {
        if (tipoRegistro !== "income" && tipoRegistro !== "expense") {
          Alert.alert("Tipo inválido", "Selecione receita, despesa ou transferência.");
          return;
        }
        await cadastrarTransacao(db, usuario.familiaId, {
          ...common,
          contaId,
          categoriaId: selectedCategory.id,
          categoriaNome: selectedCategory.nome,
          tipoMovimentacao: tipoRegistro === "income" ? "RECEITA" : "DESPESA",
          estornado: false,
          formaPagamento: tipoRegistro === "expense" ? formaPagamento : "normal",
          parcelas: tipoRegistro === "expense" && formaPagamento === "credit" ? Number(parcelas) : undefined,
          diaVencimento: tipoRegistro === "expense" && formaPagamento === "credit" && diaVencimento
            ? Number(diaVencimento)
            : undefined,
        });
      }
      setFormAberto(false);
      limparFormulario();
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.error("Erro ao salvar movimentação:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível salvar a movimentação.");
    }
  };

  const salvarConta = async () => {
    if (!usuario || !nomeConta.trim()) {
      Alert.alert("Dados incompletos", "Informe o nome da conta.");
      return;
    }
    const normalized = saldoInicial.includes(",")
      ? saldoInicial.replace(/\./g, "").replace(",", ".")
      : saldoInicial;
    const balance = Number(normalized);
    if (!Number.isFinite(balance)) {
      Alert.alert("Saldo inválido", "Informe um saldo inicial válido.");
      return;
    }
    setIsSavingAccount(true);
    try {
      const id = await criarConta(db, usuario.familiaId, usuario.id, {
        nome: nomeConta.trim(),
        tipoConta,
        saldoAtual: balance,
        ativo: true,
      });
      setContas((current) => [...current, {
        id,
        nome: nomeConta.trim(),
        tipoConta,
        saldoAtual: balance,
        ativo: true,
      }]);
      setContaId(id);
      setContaAberta(false);
      setNomeConta("");
      setSaldoInicial("0");
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível criar a conta.");
    } finally {
      setIsSavingAccount(false);
    }
  };

  const efetivarTransacao = async (transacaoId: string) => {
    if (!usuario) return;
    try {
      await efetivarTransacaoPendente(db, usuario.familiaId, transacaoId, usuario.id);
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.error("Erro ao efetivar movimentação:", error);
      Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível efetivar a movimentação.");
    }
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
          <Text style={styles.month}>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date())}</Text>
          <Text style={styles.title}>Registros</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <GradientButton
            title="+ Conta"
            onPress={() => setContaAberta(true)}
            style={{ minWidth: 76 }}
          />
          <GradientButton
            title="+ Novo"
            onPress={() => setNovoAberto(true)}
            style={{ minWidth: 70 }}
          />
        </View>
      </View>

      <View style={styles.summary}>
        <View style={[styles.summaryCard, styles.incomeCard]}>
          <Text style={styles.summaryLabel}>Receitas</Text>
          <Text style={styles.incomeValue}>+{receitaMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
        </View>

        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.summaryLabel}>Despesas</Text>
          <Text style={styles.expenseValue}>-{despesaMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
        </View>

        <View style={[styles.summaryCard, styles.creditCard]}>
          <Text style={styles.summaryLabel}>Crédito pendente</Text>
          <Text style={styles.creditValue}>{creditPending.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
        </View>
      </View>

      <View style={styles.transactions}>
        {isLoading ? (
          <Text style={styles.transactionMeta}>Carregando registros...</Text>
        ) : erroCarregamento ? (
          <Text style={styles.errorText}>{erroCarregamento}</Text>
        ) : transacoes.length === 0 ? (
          <Text style={styles.transactionMeta}>Nenhuma movimentação registrada.</Text>
        ) : transacoes.map((transacao) => (
          <View key={transacao.id} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <Text>💰</Text>
            </View>

            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>
                {transacao.descricao}
              </Text>

              <Text style={styles.transactionCategory}>
                {transacao.categoriaNome}
              </Text>

              <Text style={styles.transactionMeta}>
                {transacao.criadoPorNome} · {transacao.dataTransacao.toLocaleDateString("pt-BR")}
              </Text>
              {transacao.status === "PENDENTE" ? (
                <Pressable onPress={() => void efetivarTransacao(transacao.id)}>
                  <Text style={styles.transactionCategory}>Pendente · tocar para efetivar</Text>
                </Pressable>
              ) : null}
            </View>
            <Text
              style={[
                styles.transactionValue,
                transacao.tipoMovimentacao === "RECEITA" || (transacao.tipoMovimentacao === "TRANSFERENCIA" && transacao.direcaoTransferencia === "ENTRADA")
                  ? styles.incomeTransaction
                  : styles.expenseTransaction,
              ]}
            >
              {transacao.tipoMovimentacao === "RECEITA" || (transacao.tipoMovimentacao === "TRANSFERENCIA" && transacao.direcaoTransferencia === "ENTRADA") ? "+" : "-"}R$ {transacao.valor.toLocaleString("pt-BR", {
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
                setTipoRegistro("transfer");
                setNovoAberto(false);
                setFormAberto(true);
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: "rgba(96, 165, 250, 0.12)" }]}>
                <Text style={[styles.actionIconText, { color: colors.info }]}>↔</Text>
              </View>
              <View>
                <Text style={styles.modalOptionTitle}>Transferência</Text>
                <Text style={styles.modalOptionDescription}>Mover entre duas contas</Text>
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
                : tipoRegistro === "expense"
                  ? "Nova Despesa"
                  : "Nova Transferência"}
            </Text>

            {/* formulário entra aqui */}
            <View style={styles.formFields}>
              <Text style={styles.categoryLabel}>
                {tipoRegistro === "transfer" ? "Conta de origem" : "Conta"}
              </Text>
              <View style={styles.categoryList}>
                {contas.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.categoryButton, contaId === item.id && styles.categoryButtonSelected]}
                    onPress={() => setContaId(item.id)}
                  >
                    <Text style={[styles.categoryText, contaId === item.id && styles.categoryTextSelected]}>
                      {item.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {tipoRegistro === "transfer" && (
                <>
                  <Text style={styles.categoryLabel}>Conta de destino</Text>
                  <View style={styles.categoryList}>
                    {contas.filter((item) => item.id !== contaId).map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.categoryButton, contaDestinoId === item.id && styles.categoryButtonSelected]}
                        onPress={() => setContaDestinoId(item.id)}
                      >
                        <Text style={[styles.categoryText, contaDestinoId === item.id && styles.categoryTextSelected]}>
                          {item.nome}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
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
                {categoriasVisiveis.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.categoryButton,
                      categoria === item.nome && styles.categoryButtonSelected,
                    ]}
                    onPress={() => setCategoria(item.nome)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        categoria === item.nome && styles.categoryTextSelected,
                      ]}
                    >
                      {item.nome}
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

      <Modal
        visible={contaAberta}
        transparent
        animationType="slide"
        onRequestClose={() => setContaAberta(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova conta</Text>
            <View style={styles.formFields}>
              <Input label="Nome da conta" value={nomeConta} onChangeText={setNomeConta} placeholder="Ex.: Poupança" />
              <Text style={styles.categoryLabel}>Tipo da conta</Text>
              <View style={styles.categoryList}>
                {([
                  ["CORRENTE", "Corrente"],
                  ["POUPANCA", "Poupança"],
                  ["CARTAO_CREDITO", "Cartão"],
                  ["CAIXINHA", "Caixinha"],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.categoryButton, tipoConta === value && styles.categoryButtonSelected]}
                    onPress={() => setTipoConta(value)}
                  >
                    <Text style={[styles.categoryText, tipoConta === value && styles.categoryTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Input
                label="Saldo inicial"
                value={saldoInicial}
                onChangeText={setSaldoInicial}
                placeholder="0,00"
                keyboardType="numeric"
              />
              <GradientButton
                title={isSavingAccount ? "Salvando..." : "Criar conta"}
                onPress={() => void salvarConta()}
                disabled={isSavingAccount}
                style={{ marginTop: 12 }}
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
    fontSize: 16,
    fontWeight: "700",
  },
  expenseValue: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  creditValue: {
    color: colors.warning,
    fontSize: 16,
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
  incomeTransaction: {
    color: colors.primary,
  },
  expenseTransaction: {
    color: colors.danger,
  },
});