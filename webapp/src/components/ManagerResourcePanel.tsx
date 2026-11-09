// webapp/src/views/ManagerResourcePanel.tsx
// Arquivo para gerenciar recursos financeiros
// ============================================

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import {
  arquivarOrcamentoMeta,
  arquivarRecorrencia,
  atualizarOrcamentoMeta,
  atualizarRecorrencia,
  criarOrcamentoMeta,
  criarRecorrencia,
  listarCartoesPlasticos,
  listarFaturasCartao,
  listarOrcamentosMetas,
  listarParcelamentos,
  listarRecorrencias,
} from '../../../shared/services/finupService'
import type {
  CartaoPlastico,
  Categoria,
  Conta,
  FaturaCartao,
  OrcamentoMeta,
  Parcelamento,
  Recorrencia,
  TipoMovimentacao,
  Usuario,
} from '../../../shared/types/finup'
import { db } from '../firebase'
import ManagerPlasticCard from './ManagerPlasticCard'

export type ManagerResourceTab = 'cartoes' | 'orcamentos' | 'parcelamentos' | 'recorrencias' | 'faturas'

type Props = {
  tab: ManagerResourceTab
  profile: Usuario
  accounts: Conta[]
  categories: Categoria[]
  onCardsCountChange: (count: number) => void
}

type Editor = Extract<ManagerResourceTab, 'orcamentos' | 'recorrencias'>
type MovementType = Extract<TipoMovimentacao, 'RECEITA' | 'DESPESA'>
type InvoiceStatus = FaturaCartao['status']

const resourceTitles: Record<ManagerResourceTab, string> = {
  cartoes: 'Cartões',
  orcamentos: 'Orçamentos e metas',
  parcelamentos: 'Parcelamentos',
  recorrencias: 'Recorrências',
  faturas: 'Faturas de cartão',
}

const movementLabels: Record<MovementType, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
}

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  ABERTA: 'Aberta',
  FECHADA: 'Fechada',
  PAGA: 'Paga',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

function parseAmount(value: string, allowZero = false): number | null {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value
  const amount = Number(normalized)
  return Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null
}

function dateInput(value: Date | null) {
  if (!value) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromInput(value: string) {
  return value ? new Date(`${value}T12:00:00`) : null
}

function monthInput() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ManagerResourcePanel({
  tab,
  profile,
  accounts,
  categories,
  onCardsCountChange,
}: Props) {
  const [cards, setCards] = useState<CartaoPlastico[]>([])
  const [budgets, setBudgets] = useState<OrcamentoMeta[]>([])
  const [installments, setInstallments] = useState<Parcelamento[]>([])
  const [recurrences, setRecurrences] = useState<Recorrencia[]>([])
  const [invoices, setInvoices] = useState<FaturaCartao[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editingBudget, setEditingBudget] = useState<OrcamentoMeta | null>(null)
  const [editingRecurrence, setEditingRecurrence] = useState<Recorrencia | null>(null)
  const [budgetCategoryId, setBudgetCategoryId] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetMonth, setBudgetMonth] = useState(monthInput())
  const [recurrenceDescription, setRecurrenceDescription] = useState('')
  const [recurrenceAmount, setRecurrenceAmount] = useState('')
  const [recurrenceDay, setRecurrenceDay] = useState('1')
  const [recurrenceNextDate, setRecurrenceNextDate] = useState('')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [recurrenceAccountId, setRecurrenceAccountId] = useState('')
  const [recurrenceCategoryId, setRecurrenceCategoryId] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<MovementType>('DESPESA')

  useEffect(() => {
    let cancelled = false

    async function loadResources() {
      setIsLoading(true)
      setLoadError('')
      try {
        const [userCards, userBudgets, userInstallments, userRecurrences, userInvoices] = await Promise.all([
          listarCartoesPlasticos(db, profile.familiaId),
          listarOrcamentosMetas(db, profile.familiaId),
          listarParcelamentos(db, profile.familiaId),
          listarRecorrencias(db, profile.familiaId),
          listarFaturasCartao(db, profile.familiaId),
        ])
        if (cancelled) return
        setCards(userCards)
        onCardsCountChange(userCards.length)
        setBudgets(userBudgets)
        setInstallments(userInstallments)
        setRecurrences(userRecurrences)
        setInvoices(userInvoices)
      } catch (error) {
        console.error('Erro ao carregar cadastros financeiros:', error)
        if (!cancelled) setLoadError('Não foi possível carregar os cadastros. Tente novamente.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadResources()
    return () => { cancelled = true }
  }, [onCardsCountChange, profile.familiaId, reloadKey])

  const budgetCategories = useMemo(
    () => categories.filter((category) => category.tipo === 'DESPESA' || category.tipo === 'AMBAS'),
    [categories],
  )
  const recurrenceCategories = useMemo(
    () => categories.filter((category) => category.tipo === recurrenceType || category.tipo === 'AMBAS'),
    [categories, recurrenceType],
  )
  function handleCardsChanged(nextCards: CartaoPlastico[]) {
    setCards(nextCards)
    onCardsCountChange(nextCards.length)
  }

  function openEditor(nextEditor: Editor) {
    setFormError('')
    setEditor(nextEditor)
  }

  function openBudgetForm(budget?: OrcamentoMeta) {
    setEditingBudget(budget ?? null)
    setBudgetCategoryId(budget?.categoriaId ?? budgetCategories[0]?.id ?? '')
    setBudgetAmount(budget ? String(budget.valorTeto).replace('.', ',') : '')
    setBudgetMonth(budget?.mesAno ?? monthInput())
    openEditor('orcamentos')
  }

  function openRecurrenceForm(item?: Recorrencia) {
    setEditingRecurrence(item ?? null)
    setRecurrenceDescription(item?.descricao ?? '')
    setRecurrenceAmount(item ? String(item.valorEstimado).replace('.', ',') : '')
    setRecurrenceDay(String(item?.diaVencimento ?? 1))
    setRecurrenceNextDate(dateInput(item?.dataProximaExecucao ?? null))
    setRecurrenceEndDate(dateInput(item?.dataFim ?? null))
    setRecurrenceAccountId(item?.contaId ?? accounts.find((account) => account.ativo)?.id ?? '')
    setRecurrenceCategoryId(item?.categoriaId ?? '')
    setRecurrenceType(item?.tipoMovimentacao ?? 'DESPESA')
    openEditor('recorrencias')
  }

  function closeEditor() {
    if (isSaving) return
    setEditor(null)
    setFormError('')
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)
    try {
      if (editor === 'orcamentos') {
        const amount = parseAmount(budgetAmount)
        if (amount === null) throw new Error('Informe um teto maior que zero.')
        if (!budgetCategoryId || !budgetMonth) throw new Error('Selecione uma categoria e um mês.')
        const budget = {
          usuarioId: profile.id,
          categoriaId: budgetCategoryId,
          valorTeto: amount,
          mesAno: budgetMonth,
        }
        if (editingBudget) {
          await atualizarOrcamentoMeta(db, profile.familiaId, editingBudget.id, budget)
        } else {
          await criarOrcamentoMeta(db, profile.familiaId, { ...budget, ativo: true })
        }
        setFeedback(editingBudget ? 'Orçamento atualizado.' : 'Orçamento criado.')
      } else if (editor === 'recorrencias') {
        const amount = parseAmount(recurrenceAmount)
        const dueDay = Number(recurrenceDay)
        const category = recurrenceCategories.find((item) => item.id === recurrenceCategoryId)
        if (!recurrenceDescription.trim()) throw new Error('Informe a descrição da recorrência.')
        if (amount === null) throw new Error('Informe um valor estimado maior que zero.')
        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error('O vencimento deve estar entre 1 e 31.')
        if (!recurrenceAccountId || !category) throw new Error('Selecione uma conta e uma categoria.')
        const nextDate = dateFromInput(recurrenceNextDate)
        const endDate = dateFromInput(recurrenceEndDate)
        if (nextDate && endDate && endDate < nextDate) throw new Error('A data final não pode anteceder a próxima execução.')
        const recurrence = {
          descricao: recurrenceDescription.trim(),
          valorEstimado: amount,
          diaVencimento: dueDay,
          dataProximaExecucao: nextDate,
          dataFim: endDate,
          contaId: recurrenceAccountId,
          categoriaId: category.id,
          tipoMovimentacao: recurrenceType,
        }
        if (editingRecurrence) {
          await atualizarRecorrencia(db, profile.familiaId, editingRecurrence.id, recurrence)
        } else {
          await criarRecorrencia(db, profile.familiaId, {
            ...recurrence,
            ativo: true,
            criadoPorUsuarioId: profile.id,
          })
        }
        setFeedback(editingRecurrence ? 'Recorrência atualizada.' : 'Recorrência criada.')
      }
      setEditor(null)
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao salvar cadastro financeiro:', error)
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function runAction(action: () => Promise<void>, success: string, fallback: string) {
    setIsSaving(true)
    try {
      await action()
      setFeedback(success)
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao atualizar cadastro financeiro:', error)
      setFeedback(error instanceof Error ? error.message : fallback)
    } finally {
      setIsSaving(false)
    }
  }

  function archiveBudget(budget: OrcamentoMeta) {
    if (!window.confirm('Arquivar este orçamento?')) return
    void runAction(
      () => arquivarOrcamentoMeta(db, profile.familiaId, budget.id),
      'Orçamento arquivado.',
      'Não foi possível arquivar o orçamento.',
    )
  }

  function restoreBudget(budget: OrcamentoMeta) {
    void runAction(
      () => updateDoc(doc(db, 'familias', profile.familiaId, 'orcamentos_metas', budget.id), { ativo: true }),
      'Orçamento reativado.',
      'Não foi possível reativar o orçamento.',
    )
  }

  function archiveRecurrence(item: Recorrencia) {
    if (!window.confirm(`Arquivar a recorrência “${item.descricao}”?`)) return
    void runAction(
      () => arquivarRecorrencia(db, profile.familiaId, item.id),
      'Recorrência arquivada.',
      'Não foi possível arquivar a recorrência.',
    )
  }

  function restoreRecurrence(item: Recorrencia) {
    void runAction(
      () => updateDoc(doc(db, 'familias', profile.familiaId, 'recorrencias', item.id), { ativo: true }),
      'Recorrência reativada.',
      'Não foi possível reativar a recorrência.',
    )
  }

  const canEditBudget = (budget: OrcamentoMeta) => budget.usuarioId === profile.id
  const canEditRecurrence = (item: Recorrencia) => item.criadoPorUsuarioId === profile.id
  return (
    <div>
      {tab !== 'cartoes' && (
        <div className="manager-resource-heading">
          <div>
            <h2>{resourceTitles[tab]}</h2>
            <p>
                {tab === 'parcelamentos' || tab === 'faturas'
                  ? `Visualize ${tab === 'parcelamentos' ? 'os parcelamentos' : 'as faturas'} cadastrados.`
                  : 'Cadastre, edite e arquive os itens financeiros da sua família. (Etapa em desenvolvimento)'}
            </p>
          </div>
          {(tab === 'orcamentos' || tab === 'recorrencias') && (
          <button
            className="records-create-button"
            type="button"
            onClick={() => tab === 'orcamentos' ? openBudgetForm() : openRecurrenceForm()}
          >
            <span aria-hidden="true">+</span> {tab === 'orcamentos' ? 'Novo orçamento' : 'Nova recorrência'}
          </button>
          )}
        </div>
      )}
      {feedback && <p className="records-feedback" role="status">{feedback}</p>}
      {loadError ? (
        <div className="records-state records-state-error" role="alert">
          <p>{loadError}</p>
          <button className="records-retry" type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : isLoading ? (
        <p className="records-state" role="status">Carregando cadastros...</p>
      ) : (
        <>
          {tab === 'cartoes' && (
            <ManagerPlasticCard
              profile={profile}
              accounts={accounts}
              cards={cards}
              onCardsChanged={handleCardsChanged}
            />
          )}
          {tab === 'orcamentos' && (budgets.length === 0 ? (
            <p className="records-state">Nenhum orçamento ou meta cadastrado.</p>
          ) : (
            <ul className="manager-list">
              {budgets.map((budget) => (
                <li className={budget.ativo ? 'manager-card' : 'manager-card is-archived'} key={budget.id}>
                  <div className="manager-card-main">
                    <span className="manager-card-icon is-expense" aria-hidden="true">◎</span>
                    <div>
                      <strong>{categories.find((category) => category.id === budget.categoriaId)?.nome ?? 'Categoria indisponível'} · {budget.mesAno}</strong>
                      <span>Teto {currencyFormatter.format(budget.valorTeto)}{canEditBudget(budget) ? '' : ' · pertence a outro membro'}</span>
                    </div>
                    {!budget.ativo && <span className="manager-badge">Arquivado</span>}
                  </div>
                  {canEditBudget(budget) && (
                    <div className="manager-card-actions">
                      <button className="manager-action" type="button" onClick={() => openBudgetForm(budget)}>Editar</button>
                      {budget.ativo
                        ? <button className="manager-action is-danger" type="button" disabled={isSaving} onClick={() => archiveBudget(budget)}>Arquivar</button>
                        : <button className="manager-action" type="button" disabled={isSaving} onClick={() => restoreBudget(budget)}>Reativar</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}
          {tab === 'parcelamentos' && (installments.length === 0 ? (
            <p className="records-state">Nenhum parcelamento cadastrado.</p>
          ) : (
            <ul className="manager-list">
              {installments.map((item) => (
                <li className={item.ativo ? 'manager-card' : 'manager-card is-archived'} key={item.id}>
                  <div className="manager-card-main">
                    <span className="manager-card-icon" aria-hidden="true">≡</span>
                    <div>
                      <strong>{item.descricao}</strong>
                      <span>{item.totalParcelas} parcelas · {currencyFormatter.format(item.valorTotal)} · {dateFormatter.format(item.dataInicio)}</span>
                    </div>
                    {!item.ativo && <span className="manager-badge">Arquivado</span>}
                  </div>
                </li>
              ))}
            </ul>
          ))}
          {tab === 'recorrencias' && (recurrences.length === 0 ? (
            <p className="records-state">Nenhuma recorrência cadastrada.</p>
          ) : (
            <ul className="manager-list">
              {recurrences.map((item) => (
                <li className={item.ativo ? 'manager-card' : 'manager-card is-archived'} key={item.id}>
                  <div className="manager-card-main">
                    <span className="manager-card-icon" aria-hidden="true">↻</span>
                    <div>
                      <strong>{item.descricao}</strong>
                      <span>{currencyFormatter.format(item.valorEstimado)} · vence dia {item.diaVencimento}</span>
                      {!canEditRecurrence(item) && <span>Cadastro de outro membro</span>}
                    </div>
                    {!item.ativo && <span className="manager-badge">Arquivada</span>}
                  </div>
                  {canEditRecurrence(item) && (
                    <div className="manager-card-actions">
                      <button className="manager-action" type="button" onClick={() => openRecurrenceForm(item)}>Editar</button>
                      {item.ativo
                        ? <button className="manager-action is-danger" type="button" disabled={isSaving} onClick={() => archiveRecurrence(item)}>Arquivar</button>
                        : <button className="manager-action" type="button" disabled={isSaving} onClick={() => restoreRecurrence(item)}>Reativar</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}
          {tab === 'faturas' && (invoices.length === 0 ? (
            <p className="records-state">Nenhuma fatura cadastrada.</p>
          ) : (
            <ul className="manager-list">
              {invoices.map((invoice) => (
                <li className="manager-card" key={invoice.id}>
                  <div className="manager-card-main">
                    <span className="manager-card-icon" aria-hidden="true">▤</span>
                    <div>
                      <strong>{accounts.find((account) => account.id === invoice.contaId)?.nome ?? 'Conta indisponível'} · {invoice.mesReferencia}</strong>
                      <span>Total {currencyFormatter.format(invoice.valorTotal)} · pago {currencyFormatter.format(invoice.valorPago)}</span>
                    </div>
                    <span className="manager-badge">{invoiceStatusLabels[invoice.status]}</span>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </>
      )}

      {editor && (
        <div className="records-overlay" onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) closeEditor()
        }} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor()
        }}>
          <section className="records-dialog manager-dialog" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">{resourceTitles[editor]}</p>
                <h2 id="resource-dialog-title">
                  {editor === 'orcamentos' ? editingBudget ? 'Editar orçamento' : 'Novo orçamento'
                    : editingRecurrence ? 'Editar recorrência' : 'Nova recorrência'}
                </h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={closeEditor} disabled={isSaving}>×</button>
            </header>
            <form className="records-form" onSubmit={(event) => void saveResource(event)}>
              {editor === 'orcamentos' && (
                <>
                  <label htmlFor="resource-budget-category">Categoria de despesa</label>
                  <select id="resource-budget-category" value={budgetCategoryId} onChange={(event) => setBudgetCategoryId(event.target.value)} required>
                    <option value="" disabled>Selecione uma categoria</option>
                    {[...budgetCategories, ...categories.filter((item) => item.id === editingBudget?.categoriaId
                      && !budgetCategories.some((allowed) => allowed.id === item.id))].map((category) => (
                      <option key={category.id} value={category.id}>{category.nome}{category.ativo === false ? ' (arquivada)' : ''}</option>
                    ))}
                  </select>
                  <label htmlFor="resource-budget-amount">Teto do orçamento</label>
                  <input id="resource-budget-amount" type="text" inputMode="decimal" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} required />
                  <label htmlFor="resource-budget-month">Mês</label>
                  <input id="resource-budget-month" type="month" value={budgetMonth} onChange={(event) => setBudgetMonth(event.target.value)} required />
                </>
              )}
              {editor === 'recorrencias' && (
                <>
                  <label htmlFor="resource-recurrence-description">Descrição</label>
                  <input id="resource-recurrence-description" value={recurrenceDescription} onChange={(event) => setRecurrenceDescription(event.target.value)} maxLength={120} required />
                  <label htmlFor="resource-recurrence-amount">Valor estimado</label>
                  <input id="resource-recurrence-amount" type="text" inputMode="decimal" value={recurrenceAmount} onChange={(event) => setRecurrenceAmount(event.target.value)} required />
                  <label htmlFor="resource-recurrence-day">Dia de vencimento</label>
                  <input id="resource-recurrence-day" type="number" min="1" max="31" step="1" value={recurrenceDay} onChange={(event) => setRecurrenceDay(event.target.value)} required />
                  <label htmlFor="resource-recurrence-type">Tipo</label>
                  <select id="resource-recurrence-type" value={recurrenceType} onChange={(event) => {
                    setRecurrenceType(event.target.value as MovementType)
                    setRecurrenceCategoryId('')
                  }}>
                    {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <label htmlFor="resource-recurrence-account">Conta</label>
                  <select id="resource-recurrence-account" value={recurrenceAccountId} onChange={(event) => setRecurrenceAccountId(event.target.value)} required>
                    <option value="" disabled>Selecione uma conta</option>
                    {accounts.filter((account) => account.ativo || account.id === editingRecurrence?.contaId).map((account) => (
                      <option key={account.id} value={account.id}>{account.nome}{account.ativo ? '' : ' (arquivada)'}</option>
                    ))}
                  </select>
                  <label htmlFor="resource-recurrence-category">Categoria</label>
                  <select id="resource-recurrence-category" value={recurrenceCategoryId} onChange={(event) => setRecurrenceCategoryId(event.target.value)} required>
                    <option value="" disabled>Selecione uma categoria</option>
                    {[...recurrenceCategories, ...categories.filter((item) => item.id === editingRecurrence?.categoriaId
                      && !recurrenceCategories.some((allowed) => allowed.id === item.id))].map((category) => (
                      <option key={category.id} value={category.id}>{category.nome}{category.ativo === false ? ' (arquivada)' : ''}</option>
                    ))}
                  </select>
                  <label htmlFor="resource-recurrence-next">Próxima execução (opcional)</label>
                  <input id="resource-recurrence-next" type="date" value={recurrenceNextDate} onChange={(event) => setRecurrenceNextDate(event.target.value)} />
                  <label htmlFor="resource-recurrence-end">Data final (opcional)</label>
                  <input id="resource-recurrence-end" type="date" value={recurrenceEndDate} onChange={(event) => setRecurrenceEndDate(event.target.value)} />
                </>
              )}
              {formError && <p className="records-form-error" role="alert">{formError}</p>}
              <button className="records-save" type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
