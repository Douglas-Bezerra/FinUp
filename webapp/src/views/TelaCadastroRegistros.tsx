import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  criarTransacao,
  listarTransacoesPorConta,
  type CriarTransacaoVariables,
  type ListarTransacoesPorContaData,
} from '../dataconnect-generated'
import { dataConnect } from '../firebase'
import LogoutButton from '../components/LogoutButton'
import Logo from '../components/Logo'
import '../App.css'

type TransactionType = 'RECEITA' | 'DESPESA'
type TransactionFilter = 'TODOS' | TransactionType
type Transaction = ListarTransacoesPorContaData['transacaos'][number]

const categories: Record<TransactionType, { id: string; name: string }[]> = {
  RECEITA: [
    { id: '10000000-0000-4000-8000-000000000001', name: 'Salário' },
    { id: '10000000-0000-4000-8000-000000000002', name: 'Freelance' },
    { id: '10000000-0000-4000-8000-000000000003', name: 'Aluguel' },
    { id: '10000000-0000-4000-8000-000000000004', name: 'Dividendos' },
    { id: '10000000-0000-4000-8000-000000000005', name: 'Presente' },
    { id: '10000000-0000-4000-8000-000000000006', name: 'Outros' },
  ],
  DESPESA: [
    { id: '20000000-0000-4000-8000-000000000001', name: 'Alimentação' },
    { id: '20000000-0000-4000-8000-000000000002', name: 'Transporte' },
    { id: '20000000-0000-4000-8000-000000000003', name: 'Moradia' },
    { id: '20000000-0000-4000-8000-000000000004', name: 'Saúde' },
    { id: '20000000-0000-4000-8000-000000000005', name: 'Lazer' },
    { id: '20000000-0000-4000-8000-000000000006', name: 'Educação' },
    { id: '20000000-0000-4000-8000-000000000007', name: 'Assinatura' },
    { id: '20000000-0000-4000-8000-000000000008', name: 'Tecnologia' },
    { id: '20000000-0000-4000-8000-000000000009', name: 'Outros' },
  ],
}

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getMonth(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function TelaCadastroRegistros() {
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get('tipo')
  const initialType: TransactionType = requestedType === 'RECEITA' ? 'RECEITA' : 'DESPESA'
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [month, setMonth] = useState(getToday().slice(0, 7))
  const [filter, setFilter] = useState<TransactionFilter>('TODOS')
  const [isFormOpen, setIsFormOpen] = useState(requestedType === 'RECEITA' || requestedType === 'DESPESA')
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType)
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
        const response = await listarTransacoesPorConta(dataConnect)
        if (!cancelled) {
          setTransactions(response.data.transacaos)
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
    .filter((transaction) => transaction.tipoMovimentacao === 'RECEITA')
    .reduce((total, transaction) => total + transaction.valor, 0)
  const totalExpenses = monthTransactions
    .filter((transaction) => transaction.tipoMovimentacao === 'DESPESA')
    .reduce((total, transaction) => total + transaction.valor, 0)
  const selectedCategories = categories[transactionType]

  function openForm(type: TransactionType = 'DESPESA') {
    setTransactionType(type)
    setCategoryId('')
    setDescription('')
    setAmount('')
    setDate(getToday())
    setStatus('EFETIVADO')
    setFormError('')
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

    setIsSaving(true)
    try {
      const variables = {
        contaId: null,
        categoriaId: categoryId,
        descricao: description.trim(),
        valor: parsedAmount,
        dataTransacao: new Date(`${date}T12:00:00`).toISOString(),
        tipoMovimentacao: transactionType,
        status,
      } as unknown as CriarTransacaoVariables

      await criarTransacao(dataConnect, variables)
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

  return (
    <main className="home-page records-page">
      <div className="home-shell">
        <header className="home-header records-header">
          <Link className="home-brand" to="/inicio" aria-label="FinUp - início">
            <Logo />
          </Link>
          <div className="records-header-actions">
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
          <button className="records-create-button" type="button" onClick={() => openForm()}>
            <span aria-hidden="true">+</span> Novo registro
          </button>
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
                  return (
                    <li className="records-row" key={transaction.id}>
                      <div className="records-description">
                        <span className={isIncome ? 'records-type-icon is-income' : 'records-type-icon is-expense'} aria-hidden="true">
                          {isIncome ? '↑' : '↓'}
                        </span>
                        <span>
                          <strong>{transaction.descricao}</strong>
                          <small>{transaction.criadoPorUsuario.nome}</small>
                        </span>
                      </div>
                      <span className="records-category">{transaction.categoria.nome}</span>
                      <time className="records-date" dateTime={transaction.dataTransacao}>
                        {formatDate(transaction.dataTransacao)}
                      </time>
                      <span className={transaction.status === 'PENDENTE' ? 'records-status is-pending' : 'records-status'}>
                        {transaction.status === 'PENDENTE' ? 'Pendente' : 'Efetivado'}
                      </span>
                      <strong className={isIncome ? 'records-value records-income' : 'records-value records-expense'}>
                        {isIncome ? '+' : '−'} {currencyFormatter.format(transaction.valor)}
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
                <h2 id="records-dialog-title">{transactionType === 'RECEITA' ? 'Nova receita' : 'Nova despesa'}</h2>
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
              </div>

              <label htmlFor="record-description">Descrição</label>
              <input
                id="record-description"
                autoFocus
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={transactionType === 'RECEITA' ? 'Ex.: Salário' : 'Ex.: Mercado'}
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
                  <option key={category.id} value={category.id}>{category.name}</option>
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