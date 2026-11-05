import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { auth, db } from "../firebase";
import {
  cadastrarTransferencia,
  listarCategorias,
  listarContas,
  obterExtrato,
  obterUsuario,
} from "../../../shared/services/finupService";
import type { Categoria, Conta, Transacao, Usuario } from "../../../shared/types/finup";
import { colors } from "../styles/colors";

type Tab = "box" | "add";
type MovementMode = "deposit" | "withdraw";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  const decimalValue = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const parsed = Number(decimalValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function TelaCaixinha() {
  const [tab, setTab] = useState<Tab>("box");
  const [mode, setMode] = useState<MovementMode>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categoriaTransferencia, setCategoriaTransferencia] = useState<Categoria | null>(null);
  const [caixinhaId, setCaixinhaId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const carregarDados = useCallback(async (estaAtivo: () => boolean = () => true) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sua sessão expirou. Entre novamente.");
      const profile = await obterUsuario(db, currentUser.uid);
      if (!profile) throw new Error("Não encontramos seu perfil financeiro.");
      const [accounts, categories, transactions] = await Promise.all([
        listarContas(db, profile.familiaId),
        listarCategorias(db, profile.familiaId),
        obterExtrato(db, profile.familiaId),
      ]);
      if (!estaAtivo()) return;

      const savingsAccounts = accounts.filter((account) =>
        account.tipoConta === "CAIXINHA" && account.ativo,
      );
      setUsuario(profile);
      setContas(accounts);
      setTransacoes(transactions);
      setCategoriaTransferencia(
        categories.find((category) => category.tipo === "TRANSFERENCIA" && category.ativo) ?? null,
      );
      setCaixinhaId((current) => {
        if (savingsAccounts.length === 1) return savingsAccounts[0].id;
        return savingsAccounts.some((account) => account.id === current) ? current : "";
      });
    } catch (error) {
      console.error("Erro ao carregar dados da Caixinha:", error);
      if (estaAtivo()) {
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados da Caixinha.");
      }
    } finally {
      if (estaAtivo()) setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let estaAtivo = true;
      void carregarDados(() => estaAtivo);
      return () => {
        estaAtivo = false;
      };
    }, [carregarDados, reloadKey]),
  );

  const contasCaixinha = contas.filter((account) =>
    account.tipoConta === "CAIXINHA" && account.ativo,
  );
  const contaPrincipal = contas.find((account) =>
    account.id === "principal" && account.tipoConta === "CORRENTE" && account.ativo,
  );
  const contaCaixinha = contasCaixinha.find((account) => account.id === caixinhaId);
  const saldoCaixinha = contaCaixinha?.saldoAtual ?? 0;
  const saldoPrincipal = contaPrincipal?.saldoAtual ?? 0;
  const movimentacoes = transacoes
    .filter((transaction) =>
      transaction.contaId === contaCaixinha?.id
      && transaction.tipoMovimentacao === "TRANSFERENCIA"
      && (transaction.direcaoTransferencia === "ENTRADA" || transaction.direcaoTransferencia === "SAIDA"),
    )
    .sort((first, second) => second.dataTransacao.getTime() - first.dataTransacao.getTime());
  const totalDeposited = movimentacoes
    .filter((transaction) => transaction.direcaoTransferencia === "ENTRADA"
      && transaction.status === "EFETIVADO" && !transaction.estornado)
    .reduce((total, transaction) => total + transaction.valor, 0);
  const totalWithdrawn = movimentacoes
    .filter((transaction) => transaction.direcaoTransferencia === "SAIDA"
      && transaction.status === "EFETIVADO" && !transaction.estornado)
    .reduce((total, transaction) => total + transaction.valor, 0);
  const progress = totalDeposited > 0
    ? Math.min((saldoCaixinha / totalDeposited) * 100, 100)
    : 0;
  const canSave = Boolean(
    !isLoading && !loadError && usuario && contaPrincipal && contaCaixinha && categoriaTransferencia,
  );

  const accountSetupMessage = loadError
    || (!contaPrincipal
      ? "Não encontramos a conta principal ativa desta família."
      : contasCaixinha.length === 0
        ? "Cadastre uma conta ativa do tipo Caixinha em Registros antes de movimentar."
        : !contaCaixinha
          ? "Selecione a conta Caixinha que deseja movimentar."
          : !categoriaTransferencia
            ? "Não encontramos uma categoria de transferência ativa para registrar a movimentação."
            : "");

  const openMovement = (movementMode: MovementMode) => {
    setMode(movementMode);
    setAmount("");
    setNote("");
    setAmountError("");
    setTab("add");
  };

  const handleSave = async () => {
    if (!amount.trim()) {
      setAmountError("Informe o valor da movimentação.");
      return;
    }
    const value = parseAmount(amount);
    if (value <= 0) {
      setAmountError("Informe um valor válido maior que zero.");
      return;
    }
    const sourceBalance = mode === "deposit" ? saldoPrincipal : saldoCaixinha;
    if (value > sourceBalance) {
      setAmountError(`O valor excede o saldo disponível de ${formatCurrency(sourceBalance)}.`);
      return;
    }
    if (!usuario || !contaPrincipal || !contaCaixinha || !categoriaTransferencia) {
      setAmountError(accountSetupMessage || "Não foi possível preparar a movimentação.");
      return;
    }

    setAmountError("");
    setIsSaving(true);
    try {
      await cadastrarTransferencia(db, usuario.familiaId, {
        contaOrigemId: mode === "deposit" ? contaPrincipal.id : contaCaixinha.id,
        contaDestinoId: mode === "deposit" ? contaCaixinha.id : contaPrincipal.id,
        descricao: note.trim() || (mode === "deposit" ? "Depósito na Caixinha" : "Retirada da Caixinha"),
        valor: value,
        dataTransacao: new Date(),
        status: "EFETIVADO",
        criadoPorUsuarioId: usuario.id,
        criadoPorNome: usuario.nome,
        categoriaId: categoriaTransferencia.id,
      });
      setAmount("");
      setNote("");
      setTab("box");
      setReloadKey((key) => key + 1);
      Alert.alert(
        "Movimentação registrada",
        mode === "deposit" ? "O valor foi transferido para a Caixinha." : "O valor voltou para a conta principal.",
      );
    } catch (error) {
      console.error("Erro ao registrar movimentação na Caixinha:", error);
      Alert.alert(
        "Erro ao registrar movimentação",
        error instanceof Error ? error.message : "Não foi possível registrar a movimentação.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Caixinha</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab(tab === "add" ? "box" : "add")}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>
            {tab === "add" ? "← Voltar" : "+ Movimentar"}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.info} />
          <Text style={styles.loadingText}>Carregando dados da Caixinha...</Text>
        </View>
      ) : null}
      {!isLoading && accountSetupMessage ? (
        <View style={styles.setupNotice}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.setupNoticeText}>{accountSetupMessage}</Text>
        </View>
      ) : null}

      {tab === "box" ? (
        <>
          <View style={styles.infoCard}>
            <Ionicons name="bulb-outline" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              Sua caixinha é uma <Text style={styles.infoStrong}>reserva separada</Text>
              {" "}das suas receitas e despesas. Depósitos saem da conta principal
              e retiradas retornam para ela.
            </Text>
          </View>

          {contasCaixinha.length > 1 ? (
            <View style={styles.accountPicker}>
              <Text style={styles.fieldLabel}>Conta Caixinha</Text>
              <View style={styles.amountOptions}>
                {contasCaixinha.map((account) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: account.id === caixinhaId }}
                    key={account.id}
                    onPress={() => setCaixinhaId(account.id)}
                    style={[styles.amountOption, account.id === caixinhaId && styles.selectedAccount]}
                  >
                    <Text style={[styles.amountOptionText, account.id === caixinhaId && styles.selectedAccountText]}>
                      {account.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.balanceCard}>
            <View style={styles.balanceTop}>
              <View>
                <Text style={styles.balanceLabel}>SALDO RESERVADO</Text>
                <Text style={styles.balanceValue}>{formatCurrency(saldoCaixinha)}</Text>
              </View>
            </View>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progresso de reserva</Text>
              <Text style={styles.progressPercent}>{progress.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>

            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statLabel}>Total depositado</Text>
                <Text style={styles.statDeposit}>+{formatCurrency(totalDeposited)}</Text>
              </View>
              <View style={styles.statsDivider} />
              <View>
                <Text style={styles.statLabel}>Retiradas</Text>
                <Text style={styles.statWithdraw}>-{formatCurrency(totalWithdrawn)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openMovement("deposit")}
              style={[styles.quickAction, styles.depositAction]}
            >
              <View style={[styles.actionIcon, styles.depositIcon]}>
                <Ionicons name="arrow-down" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Depositar</Text>
                <Text style={styles.actionSubtitle}>Guardar dinheiro</Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => openMovement("withdraw")}
              style={[styles.quickAction, styles.withdrawAction]}
            >
              <View style={[styles.actionIcon, styles.withdrawIcon]}>
                <Ionicons name="arrow-up" size={20} color={colors.danger} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Retirar</Text>
                <Text style={styles.actionSubtitle}>Usar reserva</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Histórico</Text>
            {movimentacoes.length === 0 ? (
              <View style={styles.emptyHistory}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="file-tray-outline" size={24} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyTitle}>Nenhuma movimentação ainda</Text>
                <Text style={styles.emptyDescription}>
                  Seus depósitos e retiradas aparecerão aqui.
                </Text>
              </View>
            ) : movimentacoes.map((transaction) => {
              const isDeposit = transaction.direcaoTransferencia === "ENTRADA";
              return (
                <View key={transaction.id} style={styles.historyItem}>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>{transaction.descricao}</Text>
                    <Text style={styles.historyDate}>
                      {transaction.dataTransacao.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {transaction.status === "PENDENTE" ? " · Pendente" : ""}
                    </Text>
                  </View>
                  <Text style={[styles.historyValue, isDeposit ? styles.statDeposit : styles.statWithdraw]}>
                    {isDeposit ? "+" : "-"}{formatCurrency(transaction.valor)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View>
          <View style={styles.modeToggle}>
            {(["deposit", "withdraw"] as const).map((movementMode) => {
              const isSelected = mode === movementMode;
              const isDeposit = movementMode === "deposit";
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={movementMode}
                  onPress={() => setMode(movementMode)}
                  style={[
                    styles.modeButton,
                    isSelected && (isDeposit ? styles.selectedDeposit : styles.selectedWithdraw),
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      isSelected && (isDeposit ? styles.selectedDepositText : styles.selectedWithdrawText),
                    ]}
                  >
                    {isDeposit ? "Depositar" : "Retirar"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.availableBalance}>
            <Text style={styles.availableLabel}>Saldo disponível na caixinha</Text>
            <Text style={styles.availableValue}>{formatCurrency(saldoCaixinha)}</Text>
          </View>

          {contasCaixinha.length > 1 ? (
            <View style={styles.accountPicker}>
              <Text style={styles.fieldLabel}>Conta Caixinha</Text>
              <View style={styles.amountOptions}>
                {contasCaixinha.map((account) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: account.id === caixinhaId }}
                    key={account.id}
                    onPress={() => setCaixinhaId(account.id)}
                    style={[styles.amountOption, account.id === caixinhaId && styles.selectedAccount]}
                  >
                    <Text style={[styles.amountOptionText, account.id === caixinhaId && styles.selectedAccountText]}>
                      {account.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {contaPrincipal && contaCaixinha ? (
            <View style={styles.transferRoute}>
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.info} />
              <Text style={styles.transferRouteText}>
                {mode === "deposit"
                  ? `${contaPrincipal.nome} → ${contaCaixinha.nome}`
                  : `${contaCaixinha.nome} → ${contaPrincipal.nome}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View>
              <Text style={styles.fieldLabel}>Valor (R$)</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setAmount(value);
                  setAmountError("");
                }}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                style={styles.amountInput}
                value={amount}
              />
              {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}
            </View>

            <View>
              <Text style={styles.fieldLabel}>Observação (opcional)</Text>
              <TextInput
                onChangeText={setNote}
                placeholder={mode === "deposit" ? "Ex.: Reserva do mês, bônus..." : "Ex.: Emergência, compra..."}
                placeholderTextColor={colors.mutedForeground}
                style={styles.noteInput}
                value={note}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Valores rápidos</Text>
              <View style={styles.amountOptions}>
                {QUICK_AMOUNTS.map((value) => {
                  const selected = amount === String(value);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      onPress={() => setAmount(String(value))}
                      style={[
                        styles.amountOption,
                        selected && (mode === "deposit" ? styles.selectedDeposit : styles.selectedWithdraw),
                      ]}
                    >
                      <Text
                        style={[
                          styles.amountOptionText,
                          selected && (mode === "deposit" ? styles.selectedDepositText : styles.selectedWithdrawText),
                        ]}
                      >
                        R$ {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.integrationNotice}>
              <Ionicons name="information-circle-outline" size={19} color={colors.info} />
              <Text style={styles.integrationText}>
                O depósito desconta o valor da conta principal. A retirada devolve o valor para essa conta.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!canSave || isSaving}
              onPress={() => void handleSave()}
              style={[
                styles.saveButton,
                mode === "withdraw" && styles.withdrawSaveButton,
                (!canSave || isSaving) && styles.saveButtonDisabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={mode === "deposit" ? colors.primaryForeground : colors.danger} />
              ) : (
                <Text style={[styles.saveButtonText, mode === "withdraw" && styles.withdrawSaveButtonText]}>
                  {mode === "deposit" ? "Depositar na Caixinha" : "Retirar da Caixinha"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 36,
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  loadingText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  setupNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderColor: "rgba(251, 191, 36, 0.25)",
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  setupNoticeText: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "700",
  },
  headerButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 12,
  },
  headerButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  balanceCard: {
    borderColor: "rgba(96, 165, 250, 0.25)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
  },
  balanceTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  balanceLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
  balanceValue: {
    color: colors.info,
    fontSize: 36,
    fontWeight: "700",
    marginTop: 5,
    fontVariant: ["tabular-nums"],
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  progressLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
  progressPercent: {
    color: colors.info,
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    overflow: "hidden",
    backgroundColor: "rgba(96, 165, 250, 0.14)",
    borderRadius: 4,
  },
  progressFill: {
    width: "0%",
    height: "100%",
    backgroundColor: colors.info,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 16,
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
    marginBottom: 4,
  },
  statDeposit: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  statsDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  statWithdraw: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(96, 165, 250, 0.06)",
    borderColor: "rgba(96, 165, 250, 0.16)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 18,
  },
  infoText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  infoStrong: {
    color: colors.foreground,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 23,
  },
  quickAction: {
    flex: 1,
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  depositAction: {
    backgroundColor: "rgba(74, 222, 128, 0.06)",
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  withdrawAction: {
    backgroundColor: "rgba(255, 107, 107, 0.06)",
    borderColor: "rgba(255, 107, 107, 0.2)",
  },
  actionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginRight: 10,
  },
  depositIcon: {
    backgroundColor: "rgba(74, 222, 128, 0.12)",
  },
  withdrawIcon: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  actionSubtitle: {
    color: colors.mutedForeground,
    fontSize: 10,
    marginTop: 3,
  },
  historySection: {
    marginTop: 2,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  historyIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginRight: 11,
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  historyTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  historyDate: {
    color: colors.mutedForeground,
    fontSize: 10,
    marginTop: 4,
  },
  historyValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptyHistory: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary,
    borderRadius: 15,
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyDescription: {
    color: colors.mutedForeground,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    padding: 4,
    marginBottom: 17,
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 10,
  },
  modeText: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  selectedDeposit: {
    backgroundColor: "rgba(74, 222, 128, 0.14)",
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  selectedWithdraw: {
    backgroundColor: "rgba(255, 107, 107, 0.14)",
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  selectedDepositText: {
    color: colors.primary,
  },
  selectedWithdrawText: {
    color: colors.danger,
  },
  availableBalance: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(96, 165, 250, 0.06)",
    borderColor: "rgba(96, 165, 250, 0.2)",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginBottom: 20,
  },
  availableLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  availableValue: {
    color: colors.info,
    fontSize: 15,
    fontWeight: "700",
  },
  form: {
    gap: 17,
  },
  fieldLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 7,
  },
  amountInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "700",
  },
  noteInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: colors.foreground,
    fontSize: 14,
  },
  amountOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amountOption: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amountOptionText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "500",
  },
  selectedAccount: {
    backgroundColor: "rgba(96, 165, 250, 0.14)",
    borderColor: colors.info,
  },
  selectedAccountText: {
    color: colors.info,
    fontWeight: "700",
  },
  accountPicker: {
    marginBottom: 16,
  },
  transferRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(96, 165, 250, 0.06)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 17,
  },
  transferRouteText: {
    flex: 1,
    color: colors.secondaryForeground,
    fontSize: 12,
  },
  integrationNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(96, 165, 250, 0.06)",
    borderRadius: 12,
    padding: 12,
  },
  integrationText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 11,
    lineHeight: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 6,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 13,
    paddingVertical: 15,
    marginTop: 1,
  },
  withdrawSaveButton: {
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.35)",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },
  withdrawSaveButtonText: {
    color: colors.danger,
  },
});