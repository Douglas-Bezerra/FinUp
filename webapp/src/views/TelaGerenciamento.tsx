// webapp/src/views/TelaGerenciarCategorias.tsx
// Arquivo para tela de gerenciamento de Contas e Categorias, Instituição Bancária
// Cartões, Orçamentos, Parcelamentos e Recorrências, no webapp.
// ===============================================================================

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  arquivarCategoria,
  atualizarCategoria,
  atualizarTransacao,
  ativarCategoria,
  criarCategoria,
  estornarTransacao,
  listarCategorias,
  listarContas,
  listarInstituicoesBancarias,
  obterExtrato,
  obterUsuario,
} from '../../../shared/services/finupService'
import type { Categoria, Conta, InstituicaoBancaria, TipoCategoria, Transacao, Usuario } from '../../../shared/types/finup'
import { auth, db } from '../firebase'
import BackButton from '../components/BackButton'
import Logo from '../components/Logo'
import LogoutButton from '../components/LogoutButton'
import ManagerContas from '../components/ManagerContas'
import ManagerInstFin from '../components/ManagerInstFin'
import ManagerResourcePanel, { type ManagerResourceTab } from '../components/ManagerResourcePanel'
import '../App.css'

type Tab = 'contas' | 'categorias' | 'lancamentos' | 'instituicoes' | ManagerResourceTab
type Editor = 'categorias' | 'lancamentos'
type MovementType = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
type Status = 'EFETIVADO' | 'PENDENTE'

const categoryTypeLabels: Record<TipoCategoria, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
  TRANSFERENCIA: 'Transferência',
  AMBAS: 'Receita e despesa',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function parseAmount(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function localDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(value)
}

export default function TelaGerenciamento() {
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [accounts, setAccounts] = useState<Conta[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [institutions, setInstitutions] = useState<InstituicaoBancaria[]>([])
  const [transactions, setTransactions] = useState<Transacao[]>([])
  const [plasticCardsCount, setPlasticCardsCount] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('contas')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const [editor, setEditor] = useState<Editor | null>(null)
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transacao | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryIcon, setCategoryIcon] = useState('ellipsis-horizontal-outline')
  const [categoryType, setCategoryType] = useState<TipoCategoria>('DESPESA')
  const [movementDescription, setMovementDescription] = useState('')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementType, setMovementType] = useState<MovementType>('DESPESA')
  const [movementStatus, setMovementStatus] = useState<Status>('EFETIVADO')
  const [movementDate, setMovementDate] = useState(localDateInput(new Date()))
  const [movementAccountId, setMovementAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [movementCategoryId, setMovementCategoryId] = useState('')

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
        const [userAccounts, userCategories, userTransactions, bankInstitutions] = await Promise.all([
          listarContas(db, user.familiaId),
          listarCategorias(db, user.familiaId),
          obterExtrato(db, user.familiaId),
          listarInstituicoesBancarias(db),
        ])
        if (cancelled) return
        setProfile(user)
        setAccounts(userAccounts)
        setCategories(userCategories)
        setTransactions(userTransactions)
        setInstitutions(bankInstitutions)
      } catch (error) {
        console.error('Erro ao carregar dados de gerenciamento:', error)
        if (!cancelled) setLoadError('Não foi possível carregar os dados. Tente novamente.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadData()
    return () => { cancelled = true }
  }, [reloadKey])

  const activeCategories = useMemo(() => categories.filter((category) => category.ativo !== false), [categories])
  const visibleTransactions = useMemo(
    () => transactions.filter((item) => item.tipoMovimentacao !== 'TRANSFERENCIA'
      || item.direcaoTransferencia === 'SAIDA'),
    [transactions],
  )
  const eligibleCategories = useMemo(
    () => activeCategories.filter((category) => category.tipo === movementType
      || category.tipo === 'AMBAS'
      || (movementType === 'TRANSFERENCIA' && category.tipo === 'TRANSFERENCIA')),
    [activeCategories, movementType],
  )

  function showEditor(nextEditor: Editor) {
    setFormError('')
    setEditor(nextEditor)
  }

  function openCategoryForm(category?: Categoria) {
    setEditingCategory(category ?? null)
    setCategoryName(category?.nome ?? '')
    setCategoryIcon(category?.icone ?? 'ellipsis-horizontal-outline')
    setCategoryType(category?.tipo ?? 'DESPESA')
    showEditor('categorias')
  }

  function openTransactionForm(item: Transacao) {
    const transaction = item.tipoMovimentacao === 'TRANSFERENCIA'
      ? transactions.find((candidate) => candidate.transferenciaId === item.transferenciaId
        && candidate.direcaoTransferencia === 'SAIDA') ?? item
      : item
    setEditingTransaction(transaction)
    setMovementDescription(transaction.descricao)
    setMovementAmount(String(transaction.valor).replace('.', ','))
    setMovementType(transaction.tipoMovimentacao)
    setMovementStatus(transaction.status)
    setMovementDate(localDateInput(transaction.dataTransacao))
    setMovementAccountId(transaction.contaId ?? '')
    setDestinationAccountId(transaction.contaDestinoId ?? '')
    setMovementCategoryId(transaction.categoriaId)
    showEditor('lancamentos')
  }

  function closeEditor() {
    if (isSaving) return
    setEditor(null)
    setFormError('')
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!profile || !categoryName.trim()) {
      setFormError('Informe o nome da categoria.')
      return
    }

    setIsSaving(true)
    try {
      const category = { nome: categoryName.trim(), icone: categoryIcon.trim(), tipo: categoryType }
      if (editingCategory) {
        await atualizarCategoria(db, profile.familiaId, editingCategory.id, category)
      } else {
        await criarCategoria(db, profile.familiaId, category)
      }
      setEditor(null)
      setFeedback(editingCategory ? 'Categoria atualizada.' : 'Categoria criada.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao salvar categoria:', error)
      setFormError('Não foi possível salvar a categoria. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const amount = parseAmount(movementAmount)
    if (!profile || !editingTransaction) return
    if (amount === null) {
      setFormError('Informe um valor maior que zero.')
      return
    }
    if (!movementAccountId) {
      setFormError('Selecione uma conta.')
      return
    }
    if (movementType === 'TRANSFERENCIA'
      && (!destinationAccountId || destinationAccountId === movementAccountId)) {
      setFormError('Selecione contas de origem e destino diferentes.')
      return
    }
    if (movementType !== 'TRANSFERENCIA' && !eligibleCategories.some((item) => item.id === movementCategoryId)) {
      setFormError('Selecione uma categoria ativa para este tipo de lançamento.')
      return
    }

    setIsSaving(true)
    try {
      const dataTransacao = new Date(`${movementDate}T12:00:00`)
      if (editingTransaction.tipoMovimentacao === 'TRANSFERENCIA') {
        if (movementType !== 'TRANSFERENCIA') {
          setFormError('O tipo de uma transferência não pode ser alterado.')
          return
        }
        await atualizarTransacao(db, profile.familiaId, editingTransaction.id, profile.id, {
          descricao: movementDescription.trim(),
          valor: amount,
          status: movementStatus,
          dataTransacao,
          contaOrigemId: movementAccountId,
          contaDestinoId: destinationAccountId,
        })
      } else {
        if (movementType === 'TRANSFERENCIA') {
          setFormError('Para registrar uma transferência, use a tela de lançamentos.')
          return
        }
        const category = eligibleCategories.find((item) => item.id === movementCategoryId)
        if (!category) {
          setFormError('Selecione uma categoria ativa para este tipo de lançamento.')
          return
        }
        await atualizarTransacao(db, profile.familiaId, editingTransaction.id, profile.id, {
          descricao: movementDescription.trim(),
          valor: amount,
          tipoMovimentacao: movementType,
          status: movementStatus,
          dataTransacao,
          contaId: movementAccountId,
          categoriaId: category.id,
          categoriaNome: category.nome,
        })
      }
      setEditor(null)
      setFeedback('Lançamento atualizado; saldo recalculado.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao atualizar lançamento:', error)
      setFormError(error instanceof Error
        ? error.message
        : 'Não foi possível atualizar o lançamento. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function archiveCategory(category: Categoria) {
    if (!profile || !window.confirm(`Arquivar a categoria “${category.nome}”? O histórico será mantido.`)) return
    setIsSaving(true)
    try {
      await arquivarCategoria(db, profile.familiaId, category.id)
      setFeedback('Categoria arquivada. O histórico foi mantido.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao arquivar categoria:', error)
      setFeedback('Não foi possível arquivar a categoria. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function restoreCategory(category: Categoria) {
    if (!profile) return
    setIsSaving(true)
    try {
      await ativarCategoria(db, profile.familiaId, category.id)
      setFeedback('Categoria reativada.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao reativar categoria:', error)
      setFeedback('Não foi possível reativar a categoria. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function reverseTransaction(item: Transacao) {
    if (!profile || item.estornado
      || !window.confirm('Estornar este lançamento? O saldo será revertido e o histórico preservado.')) return
    setIsSaving(true)
    try {
      await estornarTransacao(db, profile.familiaId, item.id, profile.id)
      setFeedback(item.tipoMovimentacao === 'TRANSFERENCIA'
        ? 'Transferência estornada nas duas contas.'
        : 'Lançamento estornado e saldo revertido.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao estornar lançamento:', error)
      setFeedback(error instanceof Error ? error.message : 'Não foi possível estornar o lançamento.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && !profile) {
    return <main className="home-page"><p className="welcome">Carregando gerenciamento...</p></main>
  }

  if (!profile) {
    return (
      <main className="home-page">
        <section className="home-empty-state">
          <BackButton />
          <Logo />
          <p className="feedback error" role="alert">{loadError || 'Não foi possível carregar seu perfil financeiro.'}</p>
          <LogoutButton />
        </section>
      </main>
    )
  }

  return (
    <main className="home-page manager-page">
      <div className="home-shell">
        <header className="home-header records-header">
          <div className="home-brand">
            <Logo />
          </div>
          <div className="records-heading-actions">
            <BackButton />
            <LogoutButton />
          </div>
        </header>

        <section className="records-heading manager-heading" aria-labelledby="manager-title">
          <div>
            <p className="eyebrow">Sua vida financeira, com clareza</p>
            <h1 id="manager-title">Visão geral e gerenciamento</h1>
            <p>Gerencie os cadastros financeiros e lançamentos da sua família.</p>
          </div>
          {tab === 'categorias' && (
            <button className="records-create-button" type="button" onClick={() => openCategoryForm()}>
              <span aria-hidden="true">+</span> Nova categoria
            </button>
          )}
          {tab === 'lancamentos' && (
            <Link className="records-create-button manager-link-button" to="/registros" state={{ backTo: '/gerenciamento' }}>
              <span aria-hidden="true">+</span> Novo lançamento
            </Link>
          )}
        </section>

        {feedback && <p className="records-feedback" role="status">{feedback}</p>}
        {loadError && (
          <div className="records-state records-state-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="records-retry" onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="manager-tabs" role="tablist" aria-label="Coleções financeiras">
          {([
            ['instituicoes', `Instituições (${institutions.length})`],
            ['contas', `Contas (${accounts.length})`],
            ['categorias', `Categorias (${categories.length})`],
            ['lancamentos', `Lançamentos (${visibleTransactions.length})`],
            ['cartoes', plasticCardsCount === null ? 'Cartões' : `Cartões (${plasticCardsCount})`],
            ['orcamentos', 'Orçamentos'],
            ['parcelamentos', 'Parcelamentos'],
            ['recorrencias', 'Recorrências'],
            ['faturas', 'Faturas'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              id={`manager-tab-${value}`}
              className={tab === value ? 'manager-tab is-active' : 'manager-tab'}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`manager-panel-${value}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <section
          className="manager-panel"
          id={`manager-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`manager-tab-${tab}`}
        >
          {isLoading ? (
            <p className="records-state" role="status">Atualizando dados...</p>
          ) : tab === 'contas' ? (
            <ManagerContas
              profile={profile}
              accounts={accounts}
              institutions={institutions}
              onAccountsChanged={setAccounts}
            />
          ) : tab === 'categorias' ? (
            categories.length === 0 ? (
              <div className="records-state">
                <p className="records-empty-title">Nenhuma categoria cadastrada</p>
                <p>Crie categorias para classificar receitas e despesas.</p>
                <button className="records-empty-action" type="button" onClick={() => openCategoryForm()}>
                  Criar categoria
                </button>
              </div>
            ) : (
              <ul className="manager-list">
                {categories.map((category) => (
                  <li className={category.ativo !== false ? 'manager-card' : 'manager-card is-archived'} key={category.id}>
                    <div className="manager-card-main">
                      <span className="manager-card-icon" aria-hidden="true">◇</span>
                      <div>
                        <strong>{category.nome}</strong>
                        <span>{categoryTypeLabels[category.tipo]}</span>
                      </div>
                      {category.ativo === false && <span className="manager-badge">Arquivada</span>}
                    </div>
                    <div className="manager-card-actions">
                      <button type="button" className="manager-action" onClick={() => openCategoryForm(category)}>Editar</button>
                      {category.ativo !== false
                        ? <button type="button" className="manager-action is-danger" disabled={isSaving} onClick={() => void archiveCategory(category)}>Arquivar</button>
                        : <button type="button" className="manager-action" disabled={isSaving} onClick={() => void restoreCategory(category)}>Reativar</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : tab === 'lancamentos' && visibleTransactions.length === 0 ? (
            <div className="records-state">
              <p className="records-empty-title">Nenhum lançamento cadastrado</p>
              <p>Os lançamentos criados aparecerão aqui para consulta, edição e estorno.</p>
              <Link className="records-empty-action manager-empty-link" to="/registros" state={{ backTo: '/gerenciamento' }}>
                Criar lançamento
              </Link>
            </div>
          ) : tab === 'lancamentos' ? (
            <ul className="manager-list manager-movements">
              {visibleTransactions.map((item) => (
                <li className={item.estornado ? 'manager-card is-archived' : 'manager-card'} key={item.id}>
                  <div className="manager-card-main manager-movement-main">
                    <span className={item.tipoMovimentacao === 'RECEITA' ? 'manager-card-icon is-income' : item.tipoMovimentacao === 'DESPESA' ? 'manager-card-icon is-expense' : 'manager-card-icon'} aria-hidden="true">
                      {item.tipoMovimentacao === 'RECEITA' ? '↑' : item.tipoMovimentacao === 'DESPESA' ? '↓' : '↔'}
                    </span>
                    <div>
                      <strong>{item.descricao}</strong>
                      <span>
                        {item.categoriaNome} · {accounts.find((account) => account.id === item.contaId)?.nome ?? 'Conta indisponível'}
                        {item.tipoMovimentacao === 'TRANSFERENCIA' && ` → ${accounts.find((account) => account.id === item.contaDestinoId)?.nome ?? 'Conta indisponível'}`}
                      </span>
                      <small>{displayDate(item.dataTransacao)} · {item.status === 'PENDENTE' ? 'Pendente' : 'Efetivado'}</small>
                    </div>
                    <strong className="manager-movement-value">{currencyFormatter.format(item.valor)}</strong>
                    {item.estornado && <span className="manager-badge">Estornado</span>}
                  </div>
                  <div className="manager-card-actions">
                    {!item.estornado && (
                      <>
                        <button type="button" className="manager-action" onClick={() => openTransactionForm(item)}>Editar</button>
                        <button type="button" className="manager-action is-danger" disabled={isSaving} onClick={() => void reverseTransaction(item)}>Estornar</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : tab === 'instituicoes' ? (
            <ManagerInstFin
              institutions={institutions}
              onInstitutionsChanged={setInstitutions}
            />
          ) : (
            <ManagerResourcePanel
              tab={tab}
              profile={profile}
              accounts={accounts}
              categories={categories}
              onCardsCountChange={setPlasticCardsCount}
            />
          )}
        </section>
      </div>

      {editor && (
        <div className="records-overlay" onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) closeEditor()
        }} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor()
        }}>
          <section className="records-dialog manager-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Gerenciamento financeiro</p>
                <h2 id="manager-dialog-title">
                  {editor === 'categorias'
                    ? editingCategory ? 'Editar categoria' : 'Nova categoria'
                    : 'Editar lançamento'}
                </h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={closeEditor} disabled={isSaving}>×</button>
            </header>

            {editor === 'categorias' && (
              <form className="records-form" onSubmit={(event) => void saveCategory(event)}>
                <label htmlFor="manager-category-name">Nome</label>
                <input id="manager-category-name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={80} required />
                <label htmlFor="manager-category-type">Tipo</label>
                <select id="manager-category-type" value={categoryType} onChange={(event) => setCategoryType(event.target.value as TipoCategoria)}>
                  {Object.entries(categoryTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <label htmlFor="manager-category-icon">Ícone (identificador)</label>
                <input id="manager-category-icon" value={categoryIcon} onChange={(event) => setCategoryIcon(event.target.value)} maxLength={60} required />
                {formError && <p className="records-form-error" role="alert">{formError}</p>}
                <button className="records-save" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar categoria'}</button>
              </form>
            )}

            {editor === 'lancamentos' && editingTransaction && (
              <form className="records-form" onSubmit={(event) => void saveTransaction(event)}>
                <label htmlFor="manager-movement-description">Descrição</label>
                <input id="manager-movement-description" value={movementDescription} onChange={(event) => setMovementDescription(event.target.value)} maxLength={120} required />
                <label htmlFor="manager-movement-type">Tipo</label>
                <select
                  id="manager-movement-type"
                  value={movementType}
                  disabled={editingTransaction.tipoMovimentacao === 'TRANSFERENCIA'}
                  onChange={(event) => {
                    setMovementType(event.target.value as MovementType)
                    setMovementCategoryId('')
                  }}
                >
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                  {editingTransaction.tipoMovimentacao === 'TRANSFERENCIA' && <option value="TRANSFERENCIA">Transferência</option>}
                </select>
                <label htmlFor="manager-movement-amount">Valor</label>
                <input id="manager-movement-amount" type="text" inputMode="decimal" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} required />
                <label htmlFor="manager-movement-date">Data</label>
                <input id="manager-movement-date" type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} required />
                <label htmlFor="manager-movement-status">Status</label>
                <select id="manager-movement-status" value={movementStatus} onChange={(event) => setMovementStatus(event.target.value as Status)}>
                  <option value="EFETIVADO">Efetivado</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
                <label htmlFor="manager-movement-account">{movementType === 'TRANSFERENCIA' ? 'Conta de origem' : 'Conta'}</label>
                <select id="manager-movement-account" value={movementAccountId} onChange={(event) => setMovementAccountId(event.target.value)} required>
                  <option value="" disabled>Selecione uma conta</option>
                  {accounts.filter((account) => account.ativo || account.id === editingTransaction.contaId).map((account) => (
                    <option key={account.id} value={account.id}>{account.nome}{account.ativo ? '' : ' (arquivada)'}</option>
                  ))}
                </select>
                {movementType === 'TRANSFERENCIA' && (
                  <>
                    <label htmlFor="manager-movement-destination">Conta de destino</label>
                    <select id="manager-movement-destination" value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required>
                      <option value="" disabled>Selecione uma conta</option>
                      {accounts.filter((account) => account.id !== movementAccountId
                        && (account.ativo || account.id === editingTransaction.contaDestinoId)).map((account) => (
                        <option key={account.id} value={account.id}>{account.nome}{account.ativo ? '' : ' (arquivada)'}</option>
                      ))}
                    </select>
                  </>
                )}
                {movementType !== 'TRANSFERENCIA' && (
                  <>
                    <label htmlFor="manager-movement-category">Categoria</label>
                    <select id="manager-movement-category" value={movementCategoryId} onChange={(event) => setMovementCategoryId(event.target.value)} required>
                      <option value="" disabled>Selecione uma categoria</option>
                      {[
                        ...eligibleCategories,
                        ...categories.filter((category) => category.id === editingTransaction.categoriaId
                          && !eligibleCategories.some((eligible) => eligible.id === category.id)),
                      ].map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nome}{category.ativo === false ? ' (arquivada)' : ''}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {formError && <p className="records-form-error" role="alert">{formError}</p>}
                <p className="manager-form-note">O saldo das contas será ajustado junto com a edição.</p>
                <button className="records-save" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar lançamento'}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
