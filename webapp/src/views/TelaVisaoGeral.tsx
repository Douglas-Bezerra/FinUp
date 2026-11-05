// webapp/src/views/TelaVisaoGeral.tsx
// Visão geral das contas e movimentações financeiras.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cadastrarParcelaFaturaCartao,
  listarContas,
  listarFaturasCartao,
  listarInstituicoesBancarias,
  listarParcelamentos,
  obterExtrato,
  obterUsuario,
  pagarFaturaCartao,
} from '../../../shared/services/finupService'
import type { Conta, FaturaCartao, InstituicaoBancaria, Transacao, Usuario } from '../../../shared/types/finup'
import BackButton from '../components/BackButton'
import Logo from '../components/Logo'
import LogoutButton from '../components/LogoutButton'
import { auth, db } from '../firebase'
import '../App.css'
import '../styles/overview.css'

type AccountCategory = Conta['tipoConta']
type InvoiceView = 'current' | 'future'
type OverviewView = 'accounts' | 'categories'

type InstitutionGroup = {
  id: string
  name: string
  corHex?: string
  accounts: Conta[]
}

const accountCategoryLabels: Record<AccountCategory, string> = {
  CORRENTE: 'Conta corrente',
  POUPANCA: 'Poupança',
  CARTAO_CREDITO: 'Cartão de crédito',
  CAIXINHA: 'Caixinha',
  INVESTIMENTO: 'Conta investimento',
  OUTROS: 'Outros',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const categoryChartColors = [
  '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6',
  '#fb7185', '#22d3ee', '#818cf8', '#facc15', '#34d399',
]

function getAccountCategory(account: Conta): AccountCategory {
  return account.tipoConta
}

function getMonthReference(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getInstallmentDueDate(monthReference: string, dueDay: number, monthOffset: number) {
  const [year, month] = monthReference.split('-').map(Number)
  const targetMonth = new Date(year, month - 1 + monthOffset, 1, 12)
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(dueDay, lastDay), 12)
}

function getInvoiceDueDate(invoice: FaturaCartao, dueDay: number) {
  const [year, month] = invoice.mesReferencia.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay), 12)
}

function getInvoiceDueWarning(invoice: FaturaCartao | null, card: Conta | null) {
  if (!invoice || !card || invoice.status === 'PAGA') return null
  const dueDate = getInvoiceDueDate(invoice, card.diaVencimento ?? 10)
  const today = new Date()
  const todayAtMidday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  const days = Math.round((dueDate.getTime() - todayAtMidday.getTime()) / 86400000)
  if (days < 0) return { tone: 'overdue', days, message: `Pagamento em atraso há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}.` }
  if (days === 0) return { tone: 'due', days, message: 'O pagamento vence hoje.' }
  if (days <= 3) return { tone: 'soon', days, message: `O pagamento vence em ${days} dia${days === 1 ? '' : 's'}.` }
  return null
}

function formatInvoiceMonth(monthReference: string) {
  const [year, month] = monthReference.split('-').map(Number)
  return monthFormatter.format(new Date(year, month - 1, 1, 12))
}

function formatFutureInvoiceMonth(monthReference: string) {
  const [year, month] = monthReference.split('-').map(Number)
  const monthName = shortMonthFormatter
    .format(new Date(year, month - 1, 1, 12))
    .replace('.', '')
  return `${monthName}/${year}`
}

function formatMonthReference(monthReference: string) {
  const [year, month] = monthReference.split('-').map(Number)
  return monthFormatter.format(new Date(year, month - 1, 1, 12))
}

function getTransactionMonth(transaction: Transacao) {
  return getMonthReference(transaction.dataTransacao)
}

function formatMovementValue(transaction: Transacao) {
  const isIncoming = transaction.tipoMovimentacao === 'RECEITA'
    || (transaction.tipoMovimentacao === 'TRANSFERENCIA' && transaction.direcaoTransferencia === 'ENTRADA')
  const prefix = isIncoming ? '+' : '-'
  return `${prefix} ${currencyFormatter.format(transaction.valor)}`
}

function getCurrentInvoice(invoices: FaturaCartao[]) {
  const currentMonth = getMonthReference(new Date())
  return invoices.find((invoice) => invoice.mesReferencia === currentMonth)
    ?? invoices.find((invoice) => invoice.status !== 'PAGA')
    ?? null
}

function getInvoiceBalance(invoice: FaturaCartao) {
  return Math.max(invoice.valorTotal - (invoice.valorPago ?? 0), 0)
}

function getAccountInvoiceBalance(account: Conta, invoices: FaturaCartao[]) {
  if (account.tipoConta !== 'CARTAO_CREDITO') return account.saldoAtual
  const currentMonth = getMonthReference(new Date())
  const currentInvoice = invoices.find((invoice) =>
    invoice.contaId === account.id && invoice.mesReferencia === currentMonth,
  )
  return currentInvoice ? getInvoiceBalance(currentInvoice) : 0
}

function getAvailableCreditLimit(account: Conta, invoices: FaturaCartao[]) {
  const totalLimit = account.limiteTotal ?? 0
  const usedLimit = invoices
    .filter((invoice) => invoice.contaId === account.id && invoice.status !== 'PAGA')
    .reduce((total, invoice) => total + getInvoiceBalance(invoice), 0)
  return Math.max(totalLimit - usedLimit, 0)
}

type InstitutionAccountsProps = {
  group: InstitutionGroup
  accounts: Conta[]
  profile: Usuario
  transactions: Transacao[]
  invoices: FaturaCartao[]
  onPaymentConfirmed: () => void
}

function CategoryOverview({ transactions }: { transactions: Transacao[] }) {
  const expenseTransactions = transactions.filter((transaction) =>
    transaction.tipoMovimentacao === 'DESPESA'
    && !transaction.estornado,
  )
  const availableMonths = Array.from(new Set([
    getMonthReference(new Date()),
    ...expenseTransactions.map(getTransactionMonth),
  ]))
    .sort((first, second) => second.localeCompare(first))
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] ?? getMonthReference(new Date()))
  const [selectedCategory, setSelectedCategory] = useState('')

  const monthTransactions = expenseTransactions.filter((transaction) =>
    getTransactionMonth(transaction) === selectedMonth,
  )
  const categoryTotals = monthTransactions.reduce((totals, transaction) => {
    const categoryName = transaction.categoriaNome || 'Sem categoria'
    totals.set(categoryName, (totals.get(categoryName) ?? 0) + transaction.valor)
    return totals
  }, new Map<string, number>())
  const categoryEntries = Array.from(categoryTotals.entries())
    .sort((first, second) => second[1] - first[1])
  const total = categoryEntries.reduce((sum, [, value]) => sum + value, 0)
  let gradientOffset = 0
  const gradientParts = categoryEntries.map(([, value], index) => {
    const start = gradientOffset
    gradientOffset += total > 0 ? (value / total) * 100 : 0
    return `${categoryChartColors[index % categoryChartColors.length]} ${start}% ${gradientOffset}%`
  })
  const activeCategory = categoryEntries.some(([name]) => name === selectedCategory)
    ? selectedCategory
    : ''

  return (
    <div className="overview-category-analysis">
      <div className="overview-month-tabs" role="tablist" aria-label="Meses dos lançamentos por categoria">
        {availableMonths.map((monthReference) => (
          <button
            key={monthReference}
            className={selectedMonth === monthReference ? 'overview-invoice-tab is-active' : 'overview-invoice-tab'}
            type="button"
            role="tab"
            aria-selected={selectedMonth === monthReference}
            onClick={() => {
              setSelectedMonth(monthReference)
              setSelectedCategory('')
            }}
          >
            {formatMonthReference(monthReference)}
          </button>
        ))}
      </div>

      <div className="overview-category-tabs overview-category-analysis-tabs" role="tablist" aria-label={`Categorias de ${formatMonthReference(selectedMonth)}`}>
        <button
          className={activeCategory === '' ? 'overview-category-tab is-active' : 'overview-category-tab'}
          type="button"
          role="tab"
          aria-selected={activeCategory === ''}
          onClick={() => setSelectedCategory('')}
        >
          Todas
        </button>
        {categoryEntries.map(([categoryName]) => (
          <button
            key={categoryName}
            className={activeCategory === categoryName ? 'overview-category-tab is-active' : 'overview-category-tab'}
            type="button"
            role="tab"
            aria-selected={activeCategory === categoryName}
            onClick={() => setSelectedCategory(categoryName)}
          >
            {categoryName}
          </button>
        ))}
      </div>

      {activeCategory === '' ? (
        categoryEntries.length > 0 ? (
          <div className="overview-category-chart-panel">
            <div
              className="overview-category-pie"
              style={{ background: gradientParts.length > 0 ? `conic-gradient(${gradientParts.join(', ')})` : 'var(--finup-border)' }}
              role="img"
              aria-label={`Gráfico de despesas por categoria em ${formatMonthReference(selectedMonth)}, total de ${currencyFormatter.format(total)}`}
            >
              <div className="overview-category-pie-center">
                <span>Total</span>
                <strong>{currencyFormatter.format(total)}</strong>
              </div>
            </div>
            <ul className="overview-category-chart-list">
              {categoryEntries.map(([categoryName, value], index) => (
                <li key={categoryName}>
                  <span
                    className="overview-category-chart-color"
                    style={{ backgroundColor: categoryChartColors[index % categoryChartColors.length] }}
                    aria-hidden="true"
                  />
                  <button type="button" onClick={() => setSelectedCategory(categoryName)}>
                    <span>{categoryName}</span>
                    <strong>{currencyFormatter.format(value)}</strong>
                    <small>{total > 0 ? ((value / total) * 100).toFixed(1).replace('.', ',') : '0'}%</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="overview-empty">Nenhuma despesa encontrada para este mês.</p>
        )
      ) : (
        <MovementList transactions={monthTransactions.filter((transaction) =>
          (transaction.categoriaNome || 'Sem categoria') === activeCategory,
        )} />
      )}
    </div>
  )
}

function InstitutionAccounts({ group, accounts, profile, transactions, invoices, onPaymentConfirmed }: InstitutionAccountsProps) {
  const accountCategories = Array.from(new Set(group.accounts.map(getAccountCategory)))
    .map((id) => ({ id, label: accountCategoryLabels[id] }))
    .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'))
  const initialCategory = accountCategories.find(({ id }) =>
    group.accounts.some((account) => getAccountCategory(account) === id),
  )?.id ?? 'CORRENTE'
  const [selectedCategory, setSelectedCategory] = useState<AccountCategory>(initialCategory)
  const activeCategory = accountCategories.some(({ id }) => id === selectedCategory)
    ? selectedCategory
    : accountCategories[0]?.id ?? initialCategory
  const [selectedAccountId, setSelectedAccountId] = useState(
    group.accounts.find((account) => getAccountCategory(account) === initialCategory)?.id ?? '',
  )
  const [invoiceView, setInvoiceView] = useState<InvoiceView>('current')
  const [selectedFutureInvoiceId, setSelectedFutureInvoiceId] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState<FaturaCartao | null>(null)
  const [paymentSourceId, setPaymentSourceId] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [isPaying, setIsPaying] = useState(false)

  const categoryAccounts = group.accounts.filter((account) => getAccountCategory(account) === activeCategory)
  const selectedAccount = categoryAccounts.find((account) => account.id === selectedAccountId) ?? categoryAccounts[0]
  const accountTransactions = selectedAccount
    ? transactions
      .filter((transaction) => transaction.contaId === selectedAccount.id)
      .sort((first, second) => second.dataTransacao.getTime() - first.dataTransacao.getTime())
    : []
  const accountInvoices = selectedAccount?.tipoConta === 'CARTAO_CREDITO'
    ? invoices
      .filter((invoice) => invoice.contaId === selectedAccount.id)
      .sort((first, second) => first.mesReferencia.localeCompare(second.mesReferencia))
    : []
  const currentInvoice = getCurrentInvoice(accountInvoices)
  const futureInvoices = accountInvoices.filter((invoice) =>
    invoice.mesReferencia > getMonthReference(new Date()),
  )
  const selectedFutureInvoice = futureInvoices.find((invoice) => invoice.id === selectedFutureInvoiceId)
    ?? futureInvoices[0]
    ?? null
  const fundingAccounts = accounts.filter((account) =>
    account.ativo && ['CORRENTE', 'POUPANCA', 'CAIXINHA', 'OUTROS'].includes(account.tipoConta),
  )
  const invoiceDueWarning = getInvoiceDueWarning(currentInvoice, selectedAccount ?? null)

  function selectCategory(category: AccountCategory) {
    setSelectedCategory(category)
    setSelectedAccountId(group.accounts.find((account) => getAccountCategory(account) === category)?.id ?? '')
    setInvoiceView('current')
    setSelectedFutureInvoiceId('')
  }

  function openPaymentConfirmation(invoice: FaturaCartao) {
    const linkedSource = fundingAccounts.find((account) => account.id === selectedAccount?.contaCorrenteId)
      ?? fundingAccounts.find((account) => account.tipoConta === 'CORRENTE')
      ?? fundingAccounts[0]
    setPaymentInvoice(invoice)
    setPaymentSourceId(linkedSource?.id ?? '')
    setPaymentError('')
  }

  async function confirmInvoicePayment() {
    if (!paymentInvoice || !paymentSourceId) {
      setPaymentError('Selecione de qual conta sairá o pagamento.')
      return
    }
    setIsPaying(true)
    setPaymentError('')
    try {
      await pagarFaturaCartao(
        db,
        profile.familiaId,
        profile.id,
        profile.nome,
        paymentInvoice.id,
        paymentSourceId,
        `Pagamento da fatura ${paymentInvoice.mesReferencia}`,
      )
      setPaymentInvoice(null)
      onPaymentConfirmed()
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Não foi possível efetivar o pagamento da fatura.')
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="overview-institution">
      <div className="overview-category-tabs" role="tablist" aria-label={`Tipos de conta em ${group.name}`}>
        {accountCategories.map(({ id, label }) => (
          <button
            key={id}
            id={`overview-category-${group.id}-${id}`}
            className={activeCategory === id ? 'overview-category-tab is-active' : 'overview-category-tab'}
            type="button"
            role="tab"
            aria-selected={activeCategory === id}
            aria-controls={`overview-category-panel-${group.id}`}
            onClick={() => selectCategory(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="overview-category-panel"
        id={`overview-category-panel-${group.id}`}
        role="tabpanel"
        aria-labelledby={`overview-category-${group.id}-${activeCategory}`}
      >
        {categoryAccounts.length === 0 ? (
          <p className="overview-empty">Nenhuma conta deste tipo nesta instituição.</p>
        ) : (
          <>
            <div className="overview-account-tabs" role="tablist" aria-label={`Contas ${group.name}`}>
              {categoryAccounts.map((account) => (
                <button
                  key={account.id}
                  id={`overview-account-${account.id}`}
                  className={selectedAccount?.id === account.id ? 'overview-account-tab is-active' : 'overview-account-tab'}
                  type="button"
                  role="tab"
                  aria-selected={selectedAccount?.id === account.id}
                  aria-controls={`overview-account-panel-${group.id}`}
                  onClick={() => {
                    setSelectedAccountId(account.id)
                    setInvoiceView('current')
                setSelectedFutureInvoiceId('')
              }}
                >
                  <span>{account.nome}</span>
                  <strong>
                    {account.tipoConta === 'CARTAO_CREDITO' && <small>Fatura atual</small>}
                    {currencyFormatter.format(account.tipoConta === 'CARTAO_CREDITO'
                      ? getAccountInvoiceBalance(account, invoices)
                      : account.saldoAtual)}
                  </strong>
                </button>
              ))}
            </div>

            {selectedAccount && (
              <section
                className="overview-account-panel"
                id={`overview-account-panel-${group.id}`}
                role="tabpanel"
                aria-labelledby={`overview-account-${selectedAccount.id}`}
              >
                <div className="overview-account-heading">
                  <div>
                    <h3>{selectedAccount.nome}</h3>
                    {selectedAccount.tipoConta === 'CARTAO_CREDITO' ? (
                      <div className="overview-credit-summary">
                        <div>
                          <span>Saldo da fatura atual</span>
                          <strong>{currencyFormatter.format(getAccountInvoiceBalance(selectedAccount, invoices))}</strong>
                        </div>
                        <div>
                          <span>Limite total</span>
                          <strong>{currencyFormatter.format(selectedAccount.limiteTotal ?? 0)}</strong>
                        </div>
                        <div>
                          <span>Limite disponível</span>
                          <strong>{currencyFormatter.format(getAvailableCreditLimit(selectedAccount, invoices))}</strong>
                        </div>
                      </div>
                    ) : (
                      <p>Saldo atual: <strong>{currencyFormatter.format(selectedAccount.saldoAtual)}</strong></p>
                    )}
                  </div>
                  {selectedAccount.tipoConta !== 'CARTAO_CREDITO' && (
                    <Link className="overview-record-link" to="/registros" state={{ backTo: '/visao-geral' }}>
                      Novo lançamento
                    </Link>
                  )}
                </div>

                {selectedAccount.tipoConta === 'CARTAO_CREDITO' ? (
                  <>
                    <div className="overview-invoice-tabs" role="tablist" aria-label={`Faturas de ${selectedAccount.nome}`}>
                      <button
                        id={`overview-invoice-current-${selectedAccount.id}`}
                        className={invoiceView === 'current' ? 'overview-invoice-tab is-active' : 'overview-invoice-tab'}
                        type="button"
                        role="tab"
                        aria-selected={invoiceView === 'current'}
                        aria-controls={`overview-invoice-panel-${selectedAccount.id}`}
                        onClick={() => setInvoiceView('current')}
                      >
                        Fatura atual
                      </button>
                      <button
                        id={`overview-invoice-future-${selectedAccount.id}`}
                        className={invoiceView === 'future' ? 'overview-invoice-tab is-active' : 'overview-invoice-tab'}
                        type="button"
                        role="tab"
                        aria-selected={invoiceView === 'future'}
                        aria-controls={`overview-invoice-panel-${selectedAccount.id}`}
                        onClick={() => setInvoiceView('future')}
                      >
                        Faturas futuras
                      </button>
                    </div>
                    <div
                      className="overview-invoice-panel"
                      id={`overview-invoice-panel-${selectedAccount.id}`}
                      role="tabpanel"
                      aria-labelledby={invoiceView === 'current'
                        ? `overview-invoice-current-${selectedAccount.id}`
                        : `overview-invoice-future-${selectedAccount.id}`}
                    >
                      {invoiceView === 'current' ? (
                        currentInvoice ? (
                          <>
                            {invoiceDueWarning && (
                              <div className={`overview-payment-warning is-${invoiceDueWarning.tone}`} role="alert">
                                <div>
                                  <strong>Pagamento do cartão</strong>
                                  <span>{invoiceDueWarning.message} Vencimento em {dateFormatter.format(getInvoiceDueDate(currentInvoice, selectedAccount.diaVencimento ?? 10))}.</span>
                                </div>
                                <button
                                  type="button"
                                  className="overview-pay-button"
                                  onClick={() => openPaymentConfirmation(currentInvoice)}
                                >
                                  Efetivar pagamento
                                </button>
                              </div>
                            )}
                            <div className="overview-invoice-summary">
                              <div>
                                <span>Saldo · {formatInvoiceMonth(currentInvoice.mesReferencia)}</span>
                                <strong>{currencyFormatter.format(getInvoiceBalance(currentInvoice))}</strong>
                              </div>
                              <div>
                                <span>Vencimento</span>
                                <strong>{dateFormatter.format(getInvoiceDueDate(currentInvoice, selectedAccount.diaVencimento ?? 10))}</strong>
                              </div>
                              <span className={`overview-invoice-status is-${currentInvoice.status.toLowerCase()}`}>
                                {currentInvoice.status === 'PAGA' ? 'Paga' : currentInvoice.status === 'FECHADA' ? 'Fechada' : 'Aberta'}
                              </span>
                            </div>
                            <MovementList transactions={accountTransactions.filter((item) => item.faturaId === currentInvoice.id)} />
                          </>
                        ) : (
                          <p className="overview-empty">Nenhuma fatura atual cadastrada para este cartão.</p>
                        )
                      ) : futureInvoices.length > 0 ? (
                        <>
                          <div
                            className="overview-future-invoice-tabs"
                            role="tablist"
                            aria-label={`Meses das faturas futuras de ${selectedAccount.nome}`}
                          >
                            {futureInvoices.map((invoice) => (
                              <button
                                key={invoice.id}
                                id={`overview-future-invoice-${invoice.id}`}
                                className={selectedFutureInvoice?.id === invoice.id
                                  ? 'overview-invoice-tab is-active'
                                  : 'overview-invoice-tab'}
                                type="button"
                                role="tab"
                                aria-selected={selectedFutureInvoice?.id === invoice.id}
                                aria-controls={`overview-future-invoice-panel-${selectedAccount.id}`}
                                onClick={() => setSelectedFutureInvoiceId(invoice.id)}
                              >
                                {formatFutureInvoiceMonth(invoice.mesReferencia)}
                              </button>
                            ))}
                          </div>
                          {selectedFutureInvoice && (
                            <section
                              className="overview-future-invoice"
                              id={`overview-future-invoice-panel-${selectedAccount.id}`}
                              role="tabpanel"
                              aria-labelledby={`overview-future-invoice-${selectedFutureInvoice.id}`}
                            >
                              <div className="overview-invoice-summary">
                                <div>
                                  <span>Saldo · {formatInvoiceMonth(selectedFutureInvoice.mesReferencia)}</span>
                                  <strong>{currencyFormatter.format(getInvoiceBalance(selectedFutureInvoice))}</strong>
                                </div>
                                <div>
                                  <span>Vencimento</span>
                                  <strong>{dateFormatter.format(getInvoiceDueDate(selectedFutureInvoice, selectedAccount.diaVencimento ?? 10))}</strong>
                                </div>
                                <span className={`overview-invoice-status is-${selectedFutureInvoice.status.toLowerCase()}`}>
                                  {selectedFutureInvoice.status === 'PAGA' ? 'Paga' : selectedFutureInvoice.status === 'FECHADA' ? 'Fechada' : 'Aberta'}
                                </span>
                              </div>
                              <MovementList transactions={accountTransactions.filter((item) => item.faturaId === selectedFutureInvoice.id)} />
                            </section>
                          )}
                        </>
                      ) : (
                        <p className="overview-empty">Nenhuma fatura futura cadastrada para este cartão.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="overview-statement-title">Extrato de movimentações</h4>
                    <MovementList transactions={accountTransactions} />
                  </>
                )}
                {paymentInvoice && (
                  <div className="overview-payment-overlay" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget && !isPaying) setPaymentInvoice(null)
                  }}>
                    <section className="overview-payment-modal" role="dialog" aria-modal="true" aria-labelledby="overview-payment-title">
                      <h3 id="overview-payment-title">Efetivar pagamento da fatura</h3>
                      <p>
                        Fatura de {formatInvoiceMonth(paymentInvoice.mesReferencia)} do cartão {selectedAccount.nome}.
                      </p>
                      <div className="overview-payment-total">
                        <span>Valor a pagar</span>
                        <strong>{currencyFormatter.format(paymentInvoice.valorTotal - paymentInvoice.valorPago)}</strong>
                      </div>
                      <label htmlFor="overview-payment-source">Conta ou dinheiro de origem</label>
                      <select
                        id="overview-payment-source"
                        value={paymentSourceId}
                        onChange={(event) => setPaymentSourceId(event.target.value)}
                        disabled={isPaying}
                      >
                        <option value="">Selecione a origem dos recursos</option>
                        {fundingAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.tipoConta === 'OUTROS' ? `Dinheiro - ${account.nome}` : `${accountCategoryLabels[account.tipoConta]} - ${account.nome}`}
                            {' · '}
                            {currencyFormatter.format(account.saldoAtual)}
                          </option>
                        ))}
                      </select>
                      {paymentError && <p className="overview-payment-error" role="alert">{paymentError}</p>}
                      <div className="overview-payment-actions">
                        <button
                          type="button"
                          className="overview-payment-cancel"
                          onClick={() => setPaymentInvoice(null)}
                          disabled={isPaying}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="overview-pay-button"
                          onClick={confirmInvoicePayment}
                          disabled={isPaying}
                        >
                          {isPaying ? 'Efetivando...' : 'Confirmar pagamento'}
                        </button>
                      </div>
                    </section>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MovementList({ transactions }: { transactions: Transacao[] }) {
  if (transactions.length === 0) {
    return <p className="overview-empty">Nenhuma movimentação cadastrada.</p>
  }

  return (
    <ul className="overview-movements">
      {transactions.map((transaction) => (
        <li className={transaction.estornado ? 'overview-movement is-reversed' : 'overview-movement'} key={transaction.id}>
          <div>
            <strong>{transaction.descricao}</strong>
            <span>{transaction.categoriaNome} · {shortDateFormatter.format(transaction.dataTransacao)}</span>
          </div>
          <div className="overview-movement-value">
            <strong>{formatMovementValue(transaction)}</strong>
            <span>{transaction.estornado ? 'Estornado' : transaction.status === 'PENDENTE' ? 'Pendente' : 'Efetivado'}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function TelaVisaoGeral() {
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [accounts, setAccounts] = useState<Conta[]>([])
  const [institutions, setInstitutions] = useState<InstituicaoBancaria[]>([])
  const [transactions, setTransactions] = useState<Transacao[]>([])
  const [invoices, setInvoices] = useState<FaturaCartao[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('')
  const [overviewView, setOverviewView] = useState<OverviewView>('accounts')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setIsLoading(true)
      setLoadError('')
      try {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.')
        const user = await obterUsuario(db, currentUser.uid)
        if (!user) throw new Error('Não encontramos seu perfil financeiro.')

        const [userAccounts, bankInstitutions, initialTransactions, initialInvoices, installmentPlans] = await Promise.all([
          listarContas(db, user.familiaId),
          listarInstituicoesBancarias(db),
          obterExtrato(db, user.familiaId),
          listarFaturasCartao(db, user.familiaId),
          listarParcelamentos(db, user.familiaId),
        ])
        if (cancelled) return

        const accountById = new Map(userAccounts.map((account) => [account.id, account]))
        let backfilledInstallments = false
        for (const plan of installmentPlans) {
          const card = accountById.get(plan.contaId)
          const planTransactions = initialTransactions.filter((transaction) => transaction.parcelamentoId === plan.id)
          const firstInstallment = planTransactions.find((transaction) => transaction.parcelaAtual === 1)
          if (!plan.ativo || plan.tipoMovimentacao !== 'DESPESA' || card?.tipoConta !== 'CARTAO_CREDITO'
            || !firstInstallment || firstInstallment.estornado) {
            continue
          }

          const firstInvoice = initialInvoices.find((invoice) => invoice.id === firstInstallment.faturaId)
          const firstMonth = firstInvoice?.mesReferencia ?? getMonthReference(firstInstallment.dataTransacao)
          const dueDay = firstInstallment.diaVencimento ?? card.diaVencimento ?? 10
          const totalCents = Math.round(plan.valorTotal * 100)
          const regularInstallmentCents = Math.round(totalCents / plan.totalParcelas)

          for (let installment = 2; installment <= plan.totalParcelas; installment += 1) {
            if (planTransactions.some((transaction) => transaction.parcelaAtual === installment)) continue

            const installmentCents = installment === plan.totalParcelas
              ? totalCents - regularInstallmentCents * (plan.totalParcelas - 1)
              : regularInstallmentCents
            const dueDate = getInstallmentDueDate(firstMonth, dueDay, installment - 1)
            const monthReference = getMonthReference(dueDate)
            const existingInvoice = initialInvoices.find((invoice) =>
              invoice.contaId === card.id && invoice.mesReferencia === monthReference,
            )
            await cadastrarParcelaFaturaCartao(db, user.familiaId, {
              descricao: `${plan.descricao} (${installment}/${plan.totalParcelas})`,
              valor: installmentCents / 100,
              tipoMovimentacao: 'DESPESA',
              status: 'PENDENTE',
              dataTransacao: dueDate,
              contaId: card.id,
              categoriaId: firstInstallment.categoriaId,
              categoriaNome: firstInstallment.categoriaNome,
              criadoPorUsuarioId: currentUser.uid,
              criadoPorNome: user.nome,
              estornado: false,
              cartaoPlasticoId: plan.cartaoPlasticoId ?? firstInstallment.cartaoPlasticoId,
              formaPagamento: 'credit',
              parcelas: plan.totalParcelas,
              parcelaAtual: installment,
              parcelamentoId: plan.id,
              diaVencimento: dueDay,
              observacao: firstInstallment.observacao,
            }, monthReference, existingInvoice?.id)
            backfilledInstallments = true
          }
        }

        const [userTransactions, userInvoices] = backfilledInstallments
          ? await Promise.all([
            obterExtrato(db, user.familiaId),
            listarFaturasCartao(db, user.familiaId),
          ])
          : [initialTransactions, initialInvoices]
        if (cancelled) return
        setProfile(user)
        setAccounts(userAccounts)
        setInstitutions(bankInstitutions)
        setTransactions(userTransactions)
        setInvoices(userInvoices)
      } catch (error) {
        console.error('Erro ao carregar a visão geral:', error)
        if (!cancelled) setLoadError('Não foi possível carregar suas contas e movimentações. Tente novamente.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadData()
    return () => { cancelled = true }
  }, [reloadKey])

  const institutionGroups = useMemo(() => {
    const activeAccounts = accounts.filter((account) => account.ativo)
    const accountsById = new Map(activeAccounts.map((account) => [account.id, account]))
    const institutionById = new Map(institutions.map((institution) => [institution.id, institution]))
    const groupedAccounts = new Map<string, InstitutionGroup>()

    for (const account of activeAccounts) {
      const linkedAccount = account.contaCorrenteId ? accountsById.get(account.contaCorrenteId) : undefined
      const institutionId = account.instituicaoId ?? linkedAccount?.instituicaoId ?? null
      const institution = institutionId ? institutionById.get(institutionId) : undefined
      const id = institution?.id ?? 'without-institution'
      const group = groupedAccounts.get(id) ?? {
        id,
        name: institution?.nome ?? 'Instituição não informada',
        corHex: institution?.corHex,
        accounts: [],
      }
      group.accounts.push(account)
      groupedAccounts.set(id, group)
    }

    return Array.from(groupedAccounts.values())
      .map((group) => ({ ...group, accounts: group.accounts.sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR')) }))
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
  }, [accounts, institutions])
  const selectedInstitution = institutionGroups.find((group) => group.id === selectedInstitutionId)
    ?? institutionGroups[0]

  if (isLoading && !profile) {
    return <main className="home-page"><p className="welcome">Carregando visão geral...</p></main>
  }

  if (!profile) {
    return (
      <main className="home-page">
        <section className="home-empty-state">
          <BackButton />
          <Logo />
          {loadError ? (
            <div className="records-state records-state-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="records-retry" onClick={() => setReloadKey((key) => key + 1)}>
                Tentar novamente
              </button>
            </div>
          ) : <p className="feedback error" role="alert">Não foi possível carregar seu perfil financeiro.</p>}
          <LogoutButton />
        </section>
      </main>
    )
  }

  return (
    <main className="home-page overview-page">
      <div className="home-shell">
        <header className="home-header records-header">
          <div className="home-brand"><Logo /></div>
          <div className="records-heading-actions">
            <BackButton />
            <LogoutButton />
          </div>
        </header>

        <section className="records-heading manager-heading" aria-labelledby="overview-title">
          <div>
            <p className="eyebrow">Sua vida financeira, com clareza</p>
            <h1 id="overview-title">Visão Geral</h1>
            <p>Consulte os saldos das suas contas e acompanhe suas movimentações e faturas.</p>
          </div>
        </section>

        {loadError && (
          <div className="records-state records-state-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="records-retry" onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="overview-empty" role="status">Atualizando suas contas...</p>
        ) : institutionGroups.length === 0 ? (
          <div className="records-state">
            <p className="records-empty-title">Nenhuma conta ativa</p>
            <p>Cadastre uma conta para consultar seu saldo e extrato.</p>
            <Link className="records-empty-action manager-empty-link" to="/gerenciamento" state={{ backTo: '/visao-geral' }}>
              Ir para Gerenciamento
            </Link>
          </div>
        ) : (
          <>
            <div className="overview-view-tabs" role="tablist" aria-label="Visualizações da visão geral">
              <button
                id="overview-view-accounts"
                className={overviewView === 'accounts' ? 'overview-invoice-tab is-active' : 'overview-invoice-tab'}
                type="button"
                role="tab"
                aria-selected={overviewView === 'accounts'}
                aria-controls="overview-view-panel"
                onClick={() => setOverviewView('accounts')}
              >
                Contas
              </button>
              <button
                id="overview-view-categories"
                className={overviewView === 'categories' ? 'overview-invoice-tab is-active' : 'overview-invoice-tab'}
                type="button"
                role="tab"
                aria-selected={overviewView === 'categories'}
                aria-controls="overview-view-panel"
                onClick={() => setOverviewView('categories')}
              >
                Lançamentos por categoria
              </button>
            </div>
            <div
              id="overview-view-panel"
              role="tabpanel"
              aria-labelledby={overviewView === 'accounts' ? 'overview-view-accounts' : 'overview-view-categories'}
            >
              {overviewView === 'categories' ? (
                <CategoryOverview transactions={transactions} />
              ) : (
                <>
                  <div className="overview-institution-tabs" role="tablist" aria-label="Instituições financeiras">
                    {institutionGroups.map((group) => (
                      <button
                        key={group.id}
                        id={`overview-institution-tab-${group.id}`}
                        className={selectedInstitution?.id === group.id ? 'overview-institution-tab is-active' : 'overview-institution-tab'}
                        type="button"
                        role="tab"
                        aria-selected={selectedInstitution?.id === group.id}
                        aria-controls="overview-institution-panel"
                        onClick={() => setSelectedInstitutionId(group.id)}
                      >
                        {group.corHex && <span className="overview-institution-color" style={{ backgroundColor: group.corHex }} aria-hidden="true" />}
                        {group.name}
                      </button>
                    ))}
                  </div>
                  {selectedInstitution && (
                    <section
                      className="overview-institution-panel"
                      id="overview-institution-panel"
                      role="tabpanel"
                      aria-labelledby={`overview-institution-tab-${selectedInstitution.id}`}
                    >
                      <InstitutionAccounts
                        key={selectedInstitution.id}
                        group={selectedInstitution}
                        accounts={accounts}
                        profile={profile}
                        transactions={transactions}
                        invoices={invoices}
                        onPaymentConfirmed={() => setReloadKey((key) => key + 1)}
                      />
                    </section>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
