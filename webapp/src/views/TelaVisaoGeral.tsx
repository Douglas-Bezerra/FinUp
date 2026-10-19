// Visão geral das contas e movimentações financeiras.

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
} from '../../../shared/services/finupService'
import type { Conta, FaturaCartao, InstituicaoBancaria, Transacao, Usuario } from '../../../shared/types/finup'
import BackButton from '../components/BackButton'
import Logo from '../components/Logo'
import LogoutButton from '../components/LogoutButton'
import { auth, db } from '../firebase'
import '../App.css'
import '../styles/overview.css'

type AccountCategory = 'CORRENTE' | 'POUPANCA' | 'CARTAO_CREDITO' | 'OUTRAS'
type InvoiceView = 'current' | 'future'

type InstitutionGroup = {
  id: string
  name: string
  corHex?: string
  accounts: Conta[]
}

const accountCategories: { id: AccountCategory; label: string }[] = [
  { id: 'CORRENTE', label: 'Conta corrente' },
  { id: 'POUPANCA', label: 'Conta poupança' },
  { id: 'CARTAO_CREDITO', label: 'Cartão' },
  { id: 'OUTRAS', label: 'Outras contas' },
]

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

function getAccountCategory(account: Conta): AccountCategory {
  return account.tipoConta === 'CORRENTE' || account.tipoConta === 'POUPANCA' || account.tipoConta === 'CARTAO_CREDITO'
    ? account.tipoConta
    : 'OUTRAS'
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

function formatInvoiceMonth(monthReference: string) {
  const [year, month] = monthReference.split('-').map(Number)
  return monthFormatter.format(new Date(year, month - 1, 1, 12))
}

function formatMovementValue(transaction: Transacao) {
  const isIncoming = transaction.tipoMovimentacao === 'RECEITA'
    || (transaction.tipoMovimentacao === 'TRANSFERENCIA' && transaction.direcaoTransferencia === 'ENTRADA')
  const prefix = isIncoming ? '+' : '-'
  return `${prefix} ${currencyFormatter.format(transaction.valor)}`
}

function getCurrentInvoice(invoices: FaturaCartao[]) {
  const currentMonth = getMonthReference(new Date())
  return invoices.find((invoice) => invoice.status !== 'PAGA')
    ?? invoices.find((invoice) => invoice.mesReferencia === currentMonth)
    ?? null
}

type InstitutionAccountsProps = {
  group: InstitutionGroup
  transactions: Transacao[]
  invoices: FaturaCartao[]
}

function InstitutionAccounts({ group, transactions, invoices }: InstitutionAccountsProps) {
  const initialCategory = accountCategories.find(({ id }) =>
    group.accounts.some((account) => getAccountCategory(account) === id),
  )?.id ?? 'CORRENTE'
  const [activeCategory, setActiveCategory] = useState<AccountCategory>(initialCategory)
  const [selectedAccountId, setSelectedAccountId] = useState(
    group.accounts.find((account) => getAccountCategory(account) === initialCategory)?.id ?? '',
  )
  const [invoiceView, setInvoiceView] = useState<InvoiceView>('current')

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
    invoice.mesReferencia > (currentInvoice?.mesReferencia ?? getMonthReference(new Date())),
  )

  function selectCategory(category: AccountCategory) {
    setActiveCategory(category)
    setSelectedAccountId(group.accounts.find((account) => getAccountCategory(account) === category)?.id ?? '')
    setInvoiceView('current')
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
                  }}
                >
                  <span>{account.nome}</span>
                  <strong>{currencyFormatter.format(account.saldoAtual)}</strong>
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
                    <p>Saldo atual: <strong>{currencyFormatter.format(selectedAccount.saldoAtual)}</strong></p>
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
                            <div className="overview-invoice-summary">
                              <div>
                                <span>{formatInvoiceMonth(currentInvoice.mesReferencia)}</span>
                                <strong>{currencyFormatter.format(currentInvoice.valorTotal)}</strong>
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
                        <div className="overview-future-invoices">
                          {futureInvoices.map((invoice) => (
                            <section className="overview-future-invoice" key={invoice.id}>
                              <div className="overview-invoice-summary">
                                <div>
                                  <span>{formatInvoiceMonth(invoice.mesReferencia)}</span>
                                  <strong>{currencyFormatter.format(invoice.valorTotal)}</strong>
                                </div>
                                <div>
                                  <span>Vencimento</span>
                                  <strong>{dateFormatter.format(getInvoiceDueDate(invoice, selectedAccount.diaVencimento ?? 10))}</strong>
                                </div>
                                <span className={`overview-invoice-status is-${invoice.status.toLowerCase()}`}>
                                  {invoice.status === 'PAGA' ? 'Paga' : invoice.status === 'FECHADA' ? 'Fechada' : 'Aberta'}
                                </span>
                              </div>
                              <MovementList transactions={accountTransactions.filter((item) => item.faturaId === invoice.id)} />
                            </section>
                          ))}
                        </div>
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
                  transactions={transactions}
                  invoices={invoices}
                />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
