import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  cadastrarTransacao,
  cadastrarTransferencia,
  criarConta,
  efetivarTransacaoPendente,
  listarCategorias,
  listarContas,
  obterExtrato,
  obterUsuario,
} from '../../../shared/services/finupService'
import type { Categoria, Conta, Transacao, Usuario } from '../../../shared/types/finup'
import { auth, db } from '../firebase'
import LogoutButton from '../components/LogoutButton'
import Logo from '../components/Logo'
import '../App.css'

type TransactionType = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
type TransactionFilter = 'TODOS' | TransactionType

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function getToday() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseAmount(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

function getMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function TelaCadastroRegistros() {
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get('tipo')
  const initialType: TransactionType = requestedType === 'RECEITA' ? 'RECEITA' : 'DESPESA'
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [transactions, setTransactions] = useState<Transacao[]>([])
  const [accounts, setAccounts] = useState<Conta[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [month, setMonth] = useState(getToday().slice(0, 7))
  const [filter, setFilter] = useState<TransactionFilter>('TODOS')
  const [isFormOpen, setIsFormOpen] = useState(requestedType === 'RECEITA' || requestedType === 'DESPESA')
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<Conta['tipoConta']>('CORRENTE')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [accountError, setAccountError] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType)
  const [accountId, setAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(getToday())
  const [status, setStatus] = useState<'EFETIVADO' | 'PENDENTE'>('EFETIVADO')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      setIsLoading(true)
      setLoadError('')

      try {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('Sua sessão expirou.')
        const user = await obterUsuario(db, currentUser.uid)
        if (!user) throw new Error('Não encontramos seu perfil financeiro.')
        const [items, userAccounts, userCategories] = await Promise.all([
          obterExtrato(db, user.familiaId),
          listarContas(db, user.familiaId),
          listarCategorias(db, user.familiaId),
        ])
        if (!cancelled) {
          setProfile(user)
          setTransactions(items)
          setAccounts(userAccounts)
          setCategories(userCategories)
          setAccountId((current) => current || userAccounts[0]?.id || '')
          setDestinationAccountId((current) => current || userAccounts.find((account) => account.id !== userAccounts[0]?.id)?.id || '')
        }
      } catch (error) {
        console.error('Erro ao carregar registros:', error)
        if (!cancelled) {
          setLoadError('Não foi possível carregar os registros. Tente novamente.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadTransactions()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const monthTransactions = transactions.filter((transaction) => getMonth(transaction.dataTransacao) === month)
  const visibleTransactions = monthTransactions.filter((transaction) =>
    filter === 'TODOS' || transaction.tipoMovimentacao === filter,
  )
  const totalIncome = monthTransactions
    .filter((transaction) => transaction.tipoMovimentacao === 'RECEITA'
      && transaction.status === 'EFETIVADO' && !transaction.estornado)
    .reduce((total, transaction) => total + transaction.valor, 0)
  const totalExpenses = monthTransactions
    .filter((transaction) => transaction.tipoMovimentacao === 'DESPESA'
      && transaction.status === 'EFETIVADO' && !transaction.estornado)
    .reduce((total, transaction) => total + transaction.valor, 0)
  const selectedCategories = categories.filter((category) =>
    category.tipo === transactionType || category.tipo === 'AMBAS',
  )

  function openForm(type: TransactionType = 'DESPESA') {
    setTransactionType(type)
    setCategoryId('')
    setDescription('')
    setAmount('')
    setDate(getToday())
    setStatus('EFETIVADO')
    setFormError('')
    setAccountId(accounts[0]?.id || '')
    setDestinationAccountId(accounts.find((account) => account.id !== accounts[0]?.id)?.id || '')
    setIsFormOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const parsedAmount = parseAmount(amount)
    if (parsedAmount === null) {
      setFormError('Informe um valor maior que zero.')
      return
    }
    if (!profile || !accountId) {
      setFormError('Cadastre ou selecione uma conta para continuar.')
      return
    }
    if (transactionType === 'TRANSFERENCIA' && (!destinationAccountId || destinationAccountId === accountId)) {
      setFormError('Selecione contas de origem e destino diferentes.')
      return
    }
    const selectedCategory = selectedCategories.find((category) => category.id === categoryId)
    if (!selectedCategory) {
      setFormError('Selecione uma categoria.')
      return
    }

    setIsSaving(true)
    try {
      const dataTransacao = new Date(`${date}T12:00:00`)
      if (transactionType === 'TRANSFERENCIA') {
        await cadastrarTransferencia(db, profile.familiaId, {
          contaOrigemId: accountId,
          contaDestinoId: destinationAccountId,
          descricao: description.trim(),
          valor: parsedAmount,
          dataTransacao,
          status,
          criadoPorUsuarioId: profile.id,
          criadoPorNome: profile.nome,
          categoriaId: selectedCategory.id,
        })
      } else {
        await cadastrarTransacao(db, profile.familiaId, {
          descricao: description.trim(),
          valor: parsedAmount,
          tipoMovimentacao: transactionType,
          status,
          dataTransacao,
          contaId: accountId,
          categoriaId: selectedCategory.id,
          categoriaNome: selectedCategory.nome,
          criadoPorUsuarioId: profile.id,
          criadoPorNome: profile.nome,
          estornado: false,
        })
      }
      setIsFormOpen(false)
      setFeedback('Registro salvo.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao salvar registro:', error)
      setFormError('Não foi possível salvar o registro. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function settleTransaction(transactionId: string) {
    if (!profile) return
    try {
      await efetivarTransacaoPendente(db, profile.familiaId, transactionId, profile.id)
      setFeedback('Movimentação efetivada e saldo atualizado.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao efetivar movimentação:', error)
      setFeedback('Não foi possível efetivar a movimentação. Tente novamente.')
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAccountError('')
    if (!profile || !accountName.trim()) {
      setAccountError('Informe o nome da conta.')
      return
    }
    const normalizedBalance = openingBalance.includes(',')
      ? openingBalance.replace(/\./g, '').replace(',', '.')
      : openingBalance
    const balance = Number(normalizedBalance)
    if (!Number.isFinite(balance)) {
      setAccountError('Informe um saldo inicial válido.')
      return
    }

    setIsSavingAccount(true)
    try {
      const id = await criarConta(db, profile.familiaId, profile.id, {
        nome: accountName.trim(),
        tipoConta: accountType,
        saldoAtual: balance,
        ativo: true,
      })
      setAccounts((current) => [...current, {
        id,
        nome: accountName.trim(),
        tipoConta: accountType,
        saldoAtual: balance,
        ativo: true,
      }])
      setAccountId(id)
      setIsAccountFormOpen(false)
      setAccountName('')
      setOpeningBalance('0')
      setFeedback('Conta criada.')
    } catch (error) {
      console.error('Erro ao criar conta:', error)
      setAccountError('Não foi possível criar a conta. Tente novamente.')
    } finally {
      setIsSavingAccount(false)
    }
  }

  return (
    <main className="home-page records-page">
      <div className="home-shell">
        <header className="home-header records-header">
          <Link className="home-brand" to="/inicio" aria-label="FinUp - início">
            <Logo />
          </Link>
          <div className="records-heading-actions">
            <Link className="records-back-link" to="/inicio">Visão geral</Link>
            <LogoutButton />
          </div>
        </header>

        <section className="records-heading" aria-labelledby="records-title">
          <div>
            <p className="eyebrow">Movimentações financeiras</p>
            <h1 id="records-title">Registros</h1>
            <p>Acompanhe receitas e despesas da sua conta.</p>
          </div>
          <div className="records-header-actions">
            <button className="records-secondary-button" type="button" onClick={() => setIsAccountFormOpen(true)}>
              Nova conta
            </button>
            <button className="records-create-button" type="button" onClick={() => openForm()}>
              <span aria-hidden="true">+</span> Novo registro
            </button>
          </div>
        </section>

        {feedback && <p className="records-feedback" role="status">{feedback}</p>}

        <section className="records-toolbar" aria-label="Filtros de registros">
          <label className="records-month-field" htmlFor="records-month">
            Mês
            <input
              id="records-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <div className="records-filters" role="group" aria-label="Tipo de registro">
            {([
              ['TODOS', 'Todos'],
              ['RECEITA', 'Receitas'],
              ['DESPESA', 'Despesas'],
              ['TRANSFERENCIA', 'Transferências'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                className={filter === value ? 'records-filter is-active' : 'records-filter'}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="records-summary" aria-label="Resumo do mês">
          <div className="records-metric">
            <span>Receitas</span>
            <strong className="records-income">{currencyFormatter.format(totalIncome)}</strong>
          </div>
          <div className="records-metric">
            <span>Despesas</span>
            <strong className="records-expense">{currencyFormatter.format(totalExpenses)}</strong>
          </div>
          <div className="records-metric">
            <span>Saldo do período</span>
            <strong>{currencyFormatter.format(totalIncome - totalExpenses)}</strong>
          </div>
        </section>

        <section className="records-content" aria-label="Lista de registros">
          {isLoading ? (
            <p className="records-state" role="status">Carregando registros...</p>
          ) : loadError ? (
            <div className="records-state records-state-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="records-retry" onClick={() => setReloadKey((key) => key + 1)}>
                Tentar novamente
              </button>
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="records-state">
              <p className="records-empty-title">Nenhum registro neste período</p>
              <p>Adicione uma receita ou despesa para acompanhar seu fluxo financeiro.</p>
              <button type="button" className="records-empty-action" onClick={() => openForm()}>
                Adicionar registro
              </button>
            </div>
          ) : (
            <>
              <div className="records-list-heading" aria-hidden="true">
                <span>Descrição</span>
                <span>Categoria</span>
                <span>Data</span>
                <span>Status</span>
                <span>Valor</span>
              </div>
              <ul className="records-list">
                {visibleTransactions.map((transaction) => {
                  const isIncome = transaction.tipoMovimentacao === 'RECEITA'
                  const isTransfer = transaction.tipoMovimentacao === 'TRANSFERENCIA'
                  const isTransferIncome = isTransfer && transaction.direcaoTransferencia === 'ENTRADA'
                  return (
                    <li className="records-row" key={transaction.id}>
                      <div className="records-description">
                        <span className={isTransfer ? 'records-type-icon is-transfer' : isIncome ? 'records-type-icon is-income' : 'records-type-icon is-expense'} aria-hidden="true">
                          {isTransfer ? '↔' : isIncome ? '↑' : '↓'}
                        </span>
                        <span>
                          <strong>{transaction.descricao}</strong>
                          <small>{transaction.criadoPorNome} · {accounts.find((account) => account.id === transaction.contaId)?.nome}</small>
                        </span>
                      </div>
                      <span className="records-category">{transaction.categoriaNome}</span>
                      <time className="records-date" dateTime={transaction.dataTransacao.toISOString()}>
                        {formatDate(transaction.dataTransacao)}
                      </time>
                      <span className="records-row-status">
                        <span className={transaction.status === 'PENDENTE' ? 'records-status is-pending' : 'records-status'}>
                          {transaction.status === 'PENDENTE' ? 'Pendente' : 'Efetivado'}
                        </span>
                        {transaction.status === 'PENDENTE' && (
                          <button className="records-retry" type="button" onClick={() => void settleTransaction(transaction.id)}>
                            Efetivar
                          </button>
                        )}
                      </span>
                      <strong className={isTransfer ? 'records-value' : isIncome ? 'records-value records-income' : 'records-value records-expense'}>
                        {isIncome || isTransferIncome ? '+' : '−'} {currencyFormatter.format(transaction.valor)}
                      </strong>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      {isFormOpen && (
        <div className="records-overlay" onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) setIsFormOpen(false)
        }} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setIsFormOpen(false)
        }}>
          <section className="records-dialog" role="dialog" aria-modal="true" aria-labelledby="records-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Novo lançamento</p>
                <h2 id="records-dialog-title">
                  {transactionType === 'RECEITA' ? 'Nova receita' : transactionType === 'DESPESA' ? 'Nova despesa' : 'Nova transferência'}
                </h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                ×
              </button>
            </header>

            <form className="records-form" onSubmit={handleSubmit}>
              <div className="records-type-switch" role="group" aria-label="Tipo de movimentação">
                <button
                  type="button"
                  className={transactionType === 'RECEITA' ? 'is-income is-selected' : 'is-income'}
                  aria-pressed={transactionType === 'RECEITA'}
                  onClick={() => { setTransactionType('RECEITA'); setCategoryId('') }}
                >
                  ↑ Receita
                </button>
                <button
                  type="button"
                  className={transactionType === 'DESPESA' ? 'is-expense is-selected' : 'is-expense'}
                  aria-pressed={transactionType === 'DESPESA'}
                  onClick={() => { setTransactionType('DESPESA'); setCategoryId('') }}
                >
                  ↓ Despesa
                </button>
                <button
                  type="button"
                  className={transactionType === 'TRANSFERENCIA' ? 'is-selected' : ''}
                  aria-pressed={transactionType === 'TRANSFERENCIA'}
                  onClick={() => { setTransactionType('TRANSFERENCIA'); setCategoryId('') }}
                >
                  ↔ Transferência
                </button>
              </div>

              <label htmlFor="record-account">
                {transactionType === 'TRANSFERENCIA' ? 'Conta de origem' : 'Conta'}
              </label>
              <select id="record-account" value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
                <option value="" disabled>Selecione uma conta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.nome}</option>
                ))}
              </select>

              {transactionType === 'TRANSFERENCIA' && (
                <>
                  <label htmlFor="record-destination-account">Conta de destino</label>
                  <select
                    id="record-destination-account"
                    value={destinationAccountId}
                    onChange={(event) => setDestinationAccountId(event.target.value)}
                    required
                  >
                    <option value="" disabled>Selecione uma conta</option>
                    {accounts.filter((account) => account.id !== accountId).map((account) => (
                      <option key={account.id} value={account.id}>{account.nome}</option>
                    ))}
                  </select>
                </>
              )}

              {isAccountFormOpen && (
                <div className="records-overlay" onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !isSavingAccount) setIsAccountFormOpen(false)
                }}>
                  <section className="records-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
                    <header className="records-dialog-header">
                      <div>
                        <p className="eyebrow">Contas da família</p>
                        <h2 id="account-dialog-title">Nova conta</h2>
                      </div>
                      <button className="records-close" type="button" aria-label="Fechar formulário" onClick={() => setIsAccountFormOpen(false)} disabled={isSavingAccount}>
                        ×
                      </button>
                    </header>
                    <form className="records-form" onSubmit={handleCreateAccount}>
                      <label htmlFor="account-name">Nome</label>
                      <input id="account-name" value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={80} required />
                      <label htmlFor="account-type">Tipo</label>
                      <select id="account-type" value={accountType} onChange={(event) => setAccountType(event.target.value as Conta['tipoConta'])}>
                        <option value="CORRENTE">Conta corrente</option>
                        <option value="POUPANCA">Poupança</option>
                        <option value="CARTAO_CREDITO">Cartão de crédito</option>
                        <option value="CAIXINHA">Caixinha</option>
                      </select>
                      <label htmlFor="account-opening-balance">Saldo inicial</label>
                      <input
                        id="account-opening-balance"
                        type="text"
                        inputMode="decimal"
                        value={openingBalance}
                        onChange={(event) => setOpeningBalance(event.target.value)}
                        required
                      />
                      {accountError && <p className="records-form-error" role="alert">{accountError}</p>}
                      <footer className="records-form-actions">
                        <button className="records-cancel" type="button" onClick={() => setIsAccountFormOpen(false)} disabled={isSavingAccount}>Cancelar</button>
                        <button className="records-save" type="submit" disabled={isSavingAccount}>
                          {isSavingAccount ? 'Salvando...' : 'Criar conta'}
                        </button>
                      </footer>
                    </form>
                  </section>
                </div>
              )}

              <label htmlFor="record-description">Descrição</label>
              <input
                id="record-description"
                autoFocus
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={transactionType === 'RECEITA' ? 'Ex.: Salário' : transactionType === 'DESPESA' ? 'Ex.: Mercado' : 'Ex.: Transferência entre contas'}
                maxLength={120}
                required
              />

              <div className="records-form-grid">
                <div>
                  <label htmlFor="record-amount">Valor</label>
                  <div className="records-money-input">
                    <span>R$</span>
                    <input
                      id="record-amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="record-date">Data</label>
                  <input id="record-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
                </div>
              </div>

              <label htmlFor="record-category">Categoria</label>
              <select id="record-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                <option value="" disabled>Selecione uma categoria</option>
                {selectedCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.nome}</option>
                ))}
              </select>

              <label htmlFor="record-status">Status</label>
              <select id="record-status" value={status} onChange={(event) => setStatus(event.target.value as 'EFETIVADO' | 'PENDENTE')}>
                <option value="EFETIVADO">Efetivado</option>
                <option value="PENDENTE">Pendente</option>
              </select>

              {formError && <p className="records-form-error" role="alert">{formError}</p>}

              <footer className="records-form-actions">
                <button className="records-cancel" type="button" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
                  Cancelar
                </button>
                <button className="records-save" type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar registro'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}