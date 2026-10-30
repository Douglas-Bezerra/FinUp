import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../styles/colors";

type Tab = "box" | "add";
type MovementMode = "deposit" | "withdraw";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

export default function TelaCaixinha() {
  const [tab, setTab] = useState<Tab>("box");
  const [mode, setMode] = useState<MovementMode>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const openMovement = (movementMode: MovementMode) => {
    setMode(movementMode);
    setTab("add");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>RESERVA PESSOAL</Text>
          <Text style={styles.title}>Minha Caixinha</Text>
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



      {tab === "box" ? (
        <>

          <View style={styles.infoCard}>
            <Ionicons name="bulb-outline" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              Sua caixinha é uma <Text style={styles.infoStrong}>reserva separada</Text>
              {" "}das suas receitas e despesas. Os valores serão exibidos aqui
              quando a integração financeira for implementada.
            </Text>
          </View>

          <View style={styles.balanceCard}>
            <View style={styles.balanceTop}>
              <View>
                <Text style={styles.balanceLabel}>SALDO RESERVADO</Text>
                <Text style={styles.balanceValue}>R$ 0,00</Text>
              </View>
            </View>

            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progresso de reserva</Text>
              <Text style={styles.progressPercent}>0%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>

            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statLabel}>Total depositado</Text>
                <Text style={styles.statDeposit}>+R$ 0,00</Text>
              </View>
              <View style={styles.statsDivider} />
              <View>
                <Text style={styles.statLabel}>Retiradas</Text>
                <Text style={styles.statWithdraw}>-R$ 0,00</Text>
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
            <View style={styles.emptyHistory}>
              <View style={styles.emptyIcon}>
                <Ionicons name="file-tray-outline" size={24} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma movimentação ainda</Text>
              <Text style={styles.emptyDescription}>
                Os depósitos e retiradas aparecerão aqui quando estiverem disponíveis.
              </Text>
            </View>
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
            <Text style={styles.availableValue}>R$ 0,00</Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.fieldLabel}>Valor (R$)</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                style={styles.amountInput}
                value={amount}
              />
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
                O registro de movimentações será habilitado em uma próxima etapa.
              </Text>
            </View>

            <Pressable accessibilityRole="button" disabled style={styles.disabledSaveButton}>
              <Text style={styles.disabledSaveText}>Movimentações em breve</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 4,
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
  disabledSaveButton: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderRadius: 13,
    paddingVertical: 15,
    marginTop: 1,
    opacity: 0.6,
  },
  disabledSaveText: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "700",
  },
});