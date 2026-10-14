// src/components/ManagerResourcePanel.tsx
// Arquivo para gerenciar recursos financeiros
// ============================================

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import {
  arquivarOrcamentoMeta,
  arquivarParcelamento,
  arquivarRecorrencia,
  atualizarFaturaCartao,
  atualizarOrcamentoMeta,
  atualizarParcelamento,
  atualizarRecorrencia,
  criarFaturaCartao,
  criarOrcamentoMeta,
  criarParcelamento,
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

type Editor = Exclude<ManagerResourceTab, 'cartoes'>
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
  const [editingInstallment, setEditingInstallment] = useState<Parcelamento | null>(null)
  const [editingRecurrence, setEditingRecurrence] = useState<Recorrencia | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<FaturaCartao | null>(null)
  const [budgetCategoryId, setBudgetCategoryId] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetMonth, setBudgetMonth] = useState(monthInput())
  const [installmentDescription, setInstallmentDescription] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentCount, setInstallmentCount] = useState('2')
  const [installmentStart, setInstallmentStart] = useState(dateInput(new Date()))
  const [installmentAccountId, setInstallmentAccountId] = useState('')
  const [installmentCategoryId, setInstallmentCategoryId] = useState('')
  const [installmentType, setInstallmentType] = useState<MovementType>('DESPESA')
  const [installmentCardId, setInstallmentCardId] = useState('')
  const [recurrenceDescription, setRecurrenceDescription] = useState('')
  const [recurrenceAmount, setRecurrenceAmount] = useState('')
  const [recurrenceDay, setRecurrenceDay] = useState('1')
  const [recurrenceNextDate, setRecurrenceNextDate] = useState('')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [recurrenceAccountId, setRecurrenceAccountId] = useState('')
  const [recurrenceCategoryId, setRecurrenceCategoryId] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<MovementType>('DESPESA')
  const [invoiceAccountId, setInvoiceAccountId] = useState('')
  const [invoiceMonth, setInvoiceMonth] = useState(monthInput())
  const [invoiceTotal, setInvoiceTotal] = useState('0')
  const [invoicePaid, setInvoicePaid] = useState('0')
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('ABERTA')

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

  const creditAccounts = useMemo(
    () => accounts.filter((account) => account.tipoConta === 'CARTAO_CREDITO'),
    [accounts],
  )
  const activeCards = useMemo(() => cards.filter((card) => card.ativo), [cards])
  const budgetCategories = useMemo(
    () => categories.filter((category) => category.tipo === 'DESPESA' || category.tipo === 'AMBAS'),
    [categories],
  )
  const installmentCategories = useMemo(
    () => categories.filter((category) => category.tipo === installmentType || category.tipo === 'AMBAS'),
    [categories, installmentType],
  )
  const recurrenceCategories = useMemo(
    () => categories.filter((category) => category.tipo === recurrenceType || category.tipo === 'AMBAS'),
    [categories, recurrenceType],
  )
  const canCreateCardResource = creditAccounts.some((account) => account.ativo)

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

  function openInstallmentForm(item?: Parcelamento) {
    setEditingInstallment(item ?? null)
    setInstallmentDescription(item?.descricao ?? '')
    setInstallmentAmount(item ? String(item.valorTotal).replace('.', ',') : '')
    setInstallmentCount(String(item?.totalParcelas ?? 2))
    setInstallmentStart(dateInput(item?.dataInicio ?? new Date()))
    setInstallmentAccountId(item?.contaId ?? accounts.find((account) => account.ativo)?.id ?? '')
    setInstallmentCategoryId(item?.categoriaId ?? '')
    setInstallmentType(item?.tipoMovimentacao ?? 'DESPESA')
    setInstallmentCardId(item?.cartaoPlasticoId ?? '')
    openEditor('parcelamentos')
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

  function openInvoiceForm(invoice?: FaturaCartao) {
    setEditingInvoice(invoice ?? null)
    setInvoiceAccountId(invoice?.contaId ?? creditAccounts.find((account) => account.ativo)?.id ?? '')
    setInvoiceMonth(invoice?.mesReferencia ?? monthInput())
    setInvoiceTotal(String(invoice?.valorTotal ?? 0).replace('.', ','))
    setInvoicePaid(String(invoice?.valorPago ?? 0).replace('.', ','))
    setInvoiceStatus(invoice?.status ?? 'ABERTA')
    openEditor('faturas')
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
      } else if (editor === 'parcelamentos') {
        const amount = parseAmount(installmentAmount)
        const count = Number(installmentCount)
        const category = installmentCategories.find((item) => item.id === installmentCategoryId)
        const startDate = dateFromInput(installmentStart)
        if (!installmentDescription.trim()) throw new Error('Informe a descrição do parcelamento.')
        if (amount === null) throw new Error('Informe um valor total maior que zero.')
        if (!Number.isInteger(count) || count < 1) throw new Error('Informe um número inteiro de parcelas.')
        if (!startDate || !installmentAccountId || !category) throw new Error('Preencha a data, a conta e a categoria.')
        const installment = {
          descricao: installmentDescription.trim(),
          valorTotal: amount,
          totalParcelas: count,
          dataInicio: startDate,
          contaId: installmentAccountId,
          categoriaId: category.id,
          tipoMovimentacao: installmentType,
          cartaoPlasticoId: installmentCardId || undefined,
        }
        if (editingInstallment) {
          await atualizarParcelamento(db, profile.familiaId, editingInstallment.id, installment)
        } else {
          await criarParcelamento(db, profile.familiaId, {
            ...installment,
            ativo: true,
            criadoPorUsuarioId: profile.id,
          })
        }
        setFeedback(editingInstallment ? 'Parcelamento atualizado.' : 'Parcelamento criado.')
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
      } else if (editor === 'faturas') {
        if (!invoiceAccountId || !invoiceMonth) throw new Error('Selecione a conta e o mês da fatura.')
        if (editingInvoice) {
          const total = parseAmount(invoiceTotal, true)
          const paid = parseAmount(invoicePaid, true)
          if (total === null || paid === null || paid > total) {
            throw new Error('Informe valores válidos; o valor pago não pode superar o total.')
          }
          if (invoiceStatus === 'PAGA' && paid !== total) {
            throw new Error('Uma fatura paga deve ter o valor pago igual ao total.')
          }
          await atualizarFaturaCartao(db, profile.familiaId, editingInvoice.id, {
            valorTotal: total,
            valorPago: paid,
            status: invoiceStatus,
          })
          setFeedback('Fatura atualizada.')
        } else {
          if (invoices.some((invoice) => invoice.contaId === invoiceAccountId
            && invoice.mesReferencia === invoiceMonth)) {
            throw new Error('Já existe uma fatura para esta conta e este mês.')
          }
          await criarFaturaCartao(db, profile.familiaId, {
            contaId: invoiceAccountId,
            mesReferencia: invoiceMonth,
          })
          setFeedback('Fatura criada.')
        }
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

  function archiveInstallment(item: Parcelamento) {
    if (!window.confirm(`Arquivar o parcelamento “${item.descricao}”?`)) return
    void runAction(
      () => arquivarParcelamento(db, profile.familiaId, item.id),
      'Parcelamento arquivado.',
      'Não foi possível arquivar o parcelamento.',
    )
  }

  function restoreInstallment(item: Parcelamento) {
    void runAction(
      () => updateDoc(doc(db, 'familias', profile.familiaId, 'parcelamentos', item.id), { ativo: true }),
      'Parcelamento reativado.',
      'Não foi possível reativar o parcelamento.',
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
  const canEditInstallment = (item: Parcelamento) => item.criadoPorUsuarioId === profile.id
  const canEditRecurrence = (item: Recorrencia) => item.criadoPorUsuarioId === profile.id
  return (
    <div>
      {tab !== 'cartoes' && (
        <div className="manager-resource-heading">
          <div>
            <h2>{resourceTitles[tab]}</h2>
            <p>
                {tab === 'faturas'
                  ? 'Cadastre e acompanhe os valores e o pagamento das faturas.'
                  : 'Cadastre, edite e arquive os itens financeiros da sua família.'}
            </p>
          </div>
          {tab !== 'faturas' || canCreateCardResource ? (
          <button
            className="records-create-button"
            type="button"
            onClick={() => {
                if (tab === 'orcamentos') openBudgetForm()
                else if (tab === 'parcelamentos') openInstallmentForm()
                else if (tab === 'recorrencias') openRecurrenceForm()
                else openInvoiceForm()
            }}
          >
            <span aria-hidden="true">+</span> {tab === 'orcamentos' ? 'Novo orçamento'
                : tab === 'parcelamentos' ? 'Novo parcelamento'
                  : tab === 'recorrencias' ? 'Nova recorrência' : 'Nova fatura'}
          </button>
          ) : null}
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
                      {!canEditInstallment(item) && <span>Cadastro de outro membro</span>}
                    </div>
                    {!item.ativo && <span className="manager-badge">Arquivado</span>}
                  </div>
                  {canEditInstallment(item) && (
                    <div className="manager-card-actions">
                      <button className="manager-action" type="button" onClick={() => openInstallmentForm(item)}>Editar</button>
                      {item.ativo
                        ? <button className="manager-action is-danger" type="button" disabled={isSaving} onClick={() => archiveInstallment(item)}>Arquivar</button>
                        : <button className="manager-action" type="button" disabled={isSaving} onClick={() => restoreInstallment(item)}>Reativar</button>}
                    </div>
                  )}
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
          {tab === 'faturas' && !canCreateCardResource && (
            <div className="records-state">
              <p>Nenhuma conta ativa de cartão de crédito cadastrada.</p>
              <p>Cadastre ou reative uma conta do tipo cartão de crédito para gerenciar faturas.</p>
            </div>
          )}
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
                  <div className="manager-card-actions">
                    <button className="manager-action" type="button" onClick={() => openInvoiceForm(invoice)}>Editar</button>
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
                    : editor === 'parcelamentos' ? editingInstallment ? 'Editar parcelamento' : 'Novo parcelamento'
                      : editor === 'recorrencias' ? editingRecurrence ? 'Editar recorrência' : 'Nova recorrência'
                        : editingInvoice ? 'Editar fatura' : 'Nova fatura'}
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
              {editor === 'parcelamentos' && (
                <>
                  <label htmlFor="resource-installment-description">Descrição</label>
                  <input id="resource-installment-description" value={installmentDescription} onChange={(event) => setInstallmentDescription(event.target.value)} maxLength={120} required />
                  <label htmlFor="resource-installment-amount">Valor total</label>
                  <input id="resource-installment-amount" type="text" inputMode="decimal" value={installmentAmount} onChange={(event) => setInstallmentAmount(event.target.value)} required />
                  <label htmlFor="resource-installment-count">Número de parcelas</label>
                  <input id="resource-installment-count" type="number" min="1" step="1" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} required />
                  <label htmlFor="resource-installment-date">Data inicial</label>
                  <input id="resource-installment-date" type="date" value={installmentStart} onChange={(event) => setInstallmentStart(event.target.value)} required />
                  <label htmlFor="resource-installment-type">Tipo</label>
                  <select id="resource-installment-type" value={installmentType} onChange={(event) => {
                    setInstallmentType(event.target.value as MovementType)
                    setInstallmentCategoryId('')
                  }}>
                    {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <label htmlFor="resource-installment-account">Conta</label>
                  <select id="resource-installment-account" value={installmentAccountId} onChange={(event) => setInstallmentAccountId(event.target.value)} required>
                    <option value="" disabled>Selecione uma conta</option>
                    {accounts.filter((account) => account.ativo || account.id === editingInstallment?.contaId).map((account) => (
                      <option key={account.id} value={account.id}>{account.nome}{account.ativo ? '' : ' (arquivada)'}</option>
                    ))}
                  </select>
                  <label htmlFor="resource-installment-category">Categoria</label>
                  <select id="resource-installment-category" value={installmentCategoryId} onChange={(event) => setInstallmentCategoryId(event.target.value)} required>
                    <option value="" disabled>Selecione uma categoria</option>
                    {[...installmentCategories, ...categories.filter((item) => item.id === editingInstallment?.categoriaId
                      && !installmentCategories.some((allowed) => allowed.id === item.id))].map((category) => (
                      <option key={category.id} value={category.id}>{category.nome}{category.ativo === false ? ' (arquivada)' : ''}</option>
                    ))}
                  </select>
                  <label htmlFor="resource-installment-card">Cartão plástico (opcional)</label>
                  <select id="resource-installment-card" value={installmentCardId} onChange={(event) => setInstallmentCardId(event.target.value)}>
                    <option value="">Nenhum</option>
                    {[...activeCards, ...cards.filter((card) => card.id === editingInstallment?.cartaoPlasticoId
                      && !activeCards.some((active) => active.id === card.id))].map((card) => (
                      <option key={card.id} value={card.id}>{card.nomeExibicao}{card.ativo ? '' : ' (arquivado)'}</option>
                    ))}
                  </select>
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
              {editor === 'faturas' && (
                <>
                  <label htmlFor="resource-invoice-account">Conta de crédito</label>
                  <select id="resource-invoice-account" value={invoiceAccountId} onChange={(event) => setInvoiceAccountId(event.target.value)} disabled={Boolean(editingInvoice)} required>
                    <option value="" disabled>Selecione uma conta</option>
                    {accounts.filter((account) => account.tipoConta === 'CARTAO_CREDITO'
                      && (account.ativo || account.id === editingInvoice?.contaId)).map((account) => (
                      <option key={account.id} value={account.id}>{account.nome}{account.ativo ? '' : ' (arquivada)'}</option>
                    ))}
                  </select>
                  <label htmlFor="resource-invoice-month">Mês de referência</label>
                  <input id="resource-invoice-month" type="month" value={invoiceMonth} onChange={(event) => setInvoiceMonth(event.target.value)} disabled={Boolean(editingInvoice)} required />
                  {editingInvoice && (
                    <>
                      <label htmlFor="resource-invoice-total">Valor total</label>
                      <input id="resource-invoice-total" type="text" inputMode="decimal" value={invoiceTotal} onChange={(event) => setInvoiceTotal(event.target.value)} required />
                      <label htmlFor="resource-invoice-paid">Valor pago</label>
                      <input id="resource-invoice-paid" type="text" inputMode="decimal" value={invoicePaid} onChange={(event) => setInvoicePaid(event.target.value)} required />
                      <label htmlFor="resource-invoice-status">Situação</label>
                      <select id="resource-invoice-status" value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value as InvoiceStatus)}>
                        {Object.entries(invoiceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </>
                  )}
                  {!editingInvoice && <p className="manager-form-note">A fatura será criada como aberta, com os valores zerados. As regras atuais não permitem excluir faturas.</p>}
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
