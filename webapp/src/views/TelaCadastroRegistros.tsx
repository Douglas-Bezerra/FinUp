// webapp/src/views/TelaCadastroRegistros.tsx
// Tela de cadastro de lançamentos, o coração do aplicativo, no webapp.
// ====================================================================

import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  atualizarFaturaCartao,
  cadastrarTransacao,
  cadastrarTransferencia,
  criarConta,
  criarFaturaCartao,
  criarParcelamento,
  efetivarTransacaoPendente,
  listarCategorias,
  listarContas,
  listarFaturasCartao,
  listarInstituicoesBancarias,
  obterExtrato,
  obterUsuario,
} from '../../../shared/services/finupService'
import type { Categoria, Conta, FaturaCartao, InstituicaoBancaria, Transacao, Usuario } from '../../../shared/types/finup'
import { auth, db } from '../firebase'
import BackButton from '../components/BackButton'
import LogoutButton from '../components/LogoutButton'
import Logo from '../components/Logo'
import '../App.css'

type TransactionType = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
type TransactionFilter = 'TODOS' | TransactionType

type FormaPagamentoDespesa = 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO'
type FormaRecebimentoReceita = 'DINHEIRO' | 'PIX' | 'CREDITO_CONTA' | 'DEPOSITO'

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

function parseLimit(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value
  const limit = Number(normalized)
  return Number.isFinite(limit) ? limit : null
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

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(12, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

interface InfoFaturaCalculada {
  mesReferencia: string
  dataFechamento: Date
  dataVencimento: Date
  isFaturaAtual: boolean
  descricaoFatura: string
}

function calcularFaturaCartao(dataTransacaoStr: string, diaVencimento: number): InfoFaturaCalculada | null {
  const dCompra = parseDateInput(dataTransacaoStr)
  if (!dCompra || !Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) return null
  const ano = dCompra.getFullYear()
  const mes = dCompra.getMonth()

  // O fechamento sempre é 10 dias antes do vencimento
  const vencimentoMesAtual = new Date(ano, mes, diaVencimento, 23, 59, 59, 999)
  const fechamentoMesAtual = new Date(vencimentoMesAtual)
  fechamentoMesAtual.setDate(fechamentoMesAtual.getDate() - 10)
  fechamentoMesAtual.setHours(23, 59, 59, 999)

  let vencimentoEscolhido: Date
  let fechamentoEscolhido: Date
  let isFaturaAtual: boolean

  if (dCompra.getTime() <= fechamentoMesAtual.getTime()) {
    vencimentoEscolhido = vencimentoMesAtual
    fechamentoEscolhido = fechamentoMesAtual
    isFaturaAtual = true
  } else {
    const vencimentoProximoMes = new Date(ano, mes + 1, diaVencimento, 23, 59, 59, 999)
    const fechamentoProximoMes = new Date(vencimentoProximoMes)
    fechamentoProximoMes.setDate(fechamentoProximoMes.getDate() - 10)
    fechamentoProximoMes.setHours(23, 59, 59, 999)
    vencimentoEscolhido = vencimentoProximoMes
    fechamentoEscolhido = fechamentoProximoMes
    isFaturaAtual = false
  }

  const anoRef = vencimentoEscolhido.getFullYear()
  const mesRef = String(vencimentoEscolhido.getMonth() + 1).padStart(2, '0')
  const mesReferencia = `${anoRef}-${mesRef}`
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(vencimentoEscolhido)
  const descricaoFatura = isFaturaAtual
    ? `Fatura Atual (${nomeMes}/${anoRef})`
    : `Próxima Fatura (${nomeMes}/${anoRef})`

  return {
    mesReferencia,
    dataFechamento: fechamentoEscolhido,
    dataVencimento: vencimentoEscolhido,
    isFaturaAtual,
    descricaoFatura,
  }
}

export default function TelaCadastroRegistros() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedType = searchParams.get('tipo')
  const initialType: TransactionType = requestedType === 'RECEITA' ? 'RECEITA' : 'DESPESA'

  const [profile, setProfile] = useState<Usuario | null>(null)
  const [transactions, setTransactions] = useState<Transacao[]>([])
  const [accounts, setAccounts] = useState<Conta[]>([])
  const [institutions, setInstitutions] = useState<InstituicaoBancaria[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [invoices, setInvoices] = useState<FaturaCartao[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [month, setMonth] = useState(getToday().slice(0, 7))
  const [filter, setFilter] = useState<TransactionFilter>('TODOS')

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(requestedType === 'RECEITA' || requestedType === 'DESPESA')
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType)
  const [date, setDate] = useState(getToday())
  const [categoryId, setCategoryId] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoDespesa>('DINHEIRO')
  const [formaRecebimento, setFormaRecebimento] = useState<FormaRecebimentoReceita>('PIX')
  const [accountId, setAccountId] = useState('')
  const [creditCardAccountId, setCreditCardAccountId] = useState('')
  const [installments, setInstallments] = useState('1')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [observation, setObservation] = useState('')
  const [status, setStatus] = useState<'EFETIVADO' | 'PENDENTE'>('EFETIVADO')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Account creation sub-modal
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<Conta['tipoConta']>('CORRENTE')
  const [accountInstitutionId, setAccountInstitutionId] = useState('')
  const [agency, setAgency] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [linkedCheckingAccountId, setLinkedCheckingAccountId] = useState('')
  const [creditLimit, setCreditLimit] = useState('0')
  const [accountDueDay, setAccountDueDay] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [accountError, setAccountError] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  function closeForm() {
    setIsFormOpen(false)
    if (searchParams.has('tipo')) {
      setSearchParams({}, { replace: true })
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setIsLoading(true)
      setLoadError('')

      try {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('Sua sessão expirou.')
        const user = await obterUsuario(db, currentUser.uid)
        if (!user) throw new Error('Não encontramos seu perfil financeiro.')

        const [items, userAccounts, userCategories, bankInstitutions, userInvoices] = await Promise.all([
          obterExtrato(db, user.familiaId),
          listarContas(db, user.familiaId),
          listarCategorias(db, user.familiaId),
          listarInstituicoesBancarias(db),
          listarFaturasCartao(db, user.familiaId),
        ])

        if (!cancelled) {
          setProfile(user)
          setTransactions(items)
          setAccounts(userAccounts)
          setCategories(userCategories)
          setInstitutions(bankInstitutions)
          setInvoices(userInvoices)

          const firstActiveBank = userAccounts.find((account) => account.ativo && account.tipoConta !== 'CARTAO_CREDITO')?.id || ''
          const firstCreditCard = userAccounts.find((account) => account.ativo && account.tipoConta === 'CARTAO_CREDITO')?.id || ''

          setAccountId((current) => userAccounts.some((account) => account.id === current && account.ativo)
            ? current
            : firstActiveBank)

          setCreditCardAccountId((current) => userAccounts.some((account) => account.id === current && account.ativo && account.tipoConta === 'CARTAO_CREDITO')
            ? current
            : firstCreditCard)

          setDestinationAccountId((current) => userAccounts.some((account) => account.id === current
            && account.ativo && account.id !== firstActiveBank)
            ? current
            : userAccounts.find((account) => account.ativo && account.id !== firstActiveBank)?.id || '')
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        if (!cancelled) {
          setLoadError('Não foi possível carregar os registros. Tente novamente.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
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

  const totalPendingCredit = monthTransactions
    .filter((transaction) => transaction.tipoMovimentacao === 'DESPESA'
      && transaction.formaPagamento === 'credit'
      && transaction.status === 'PENDENTE' && !transaction.estornado)
    .reduce((total, transaction) => total + transaction.valor, 0)

  const activeAccounts = accounts.filter((account) => account.ativo)
  const bankAccounts = activeAccounts.filter((account) => account.tipoConta !== 'CARTAO_CREDITO')
  const creditCardAccounts = activeAccounts.filter((account) => account.tipoConta === 'CARTAO_CREDITO')

  const contaCaixa = activeAccounts.find((acc) =>
    acc.tipoConta === 'CAIXINHA' ||
    acc.nome.trim().toLowerCase() === 'caixa' ||
    acc.nome.trim().toLowerCase().startsWith('caixa') ||
    acc.nome.trim().toLowerCase().includes('carteira'),
  )

  const selectedCreditCard = creditCardAccounts.find((acc) => acc.id === creditCardAccountId) || creditCardAccounts[0]
  const cardDueDay = selectedCreditCard?.diaVencimento || 10
  const invoiceInfo = calcularFaturaCartao(date, cardDueDay)
  const numInstallments = Math.max(1, parseInt(installments, 10) || 1)
  const parsedCurrentAmount = parseAmount(amount)
  const installmentAmount = parsedCurrentAmount ? parsedCurrentAmount / numInstallments : 0

  function openForm(type: TransactionType = 'DESPESA') {
    setTransactionType(type)
    setCategoryId('')
    setDescription('')
    setAmount('')
    setObservation('')
    setDate(getToday())
    setFormaPagamento('DINHEIRO')
    setFormaRecebimento('PIX')
    setInstallments('1')
    setStatus(type === 'DESPESA' ? 'EFETIVADO' : 'EFETIVADO')
    setFormError('')

    const firstBank = bankAccounts[0]?.id || ''
    setAccountId(firstBank)
    setCreditCardAccountId(creditCardAccounts[0]?.id || '')
    setDestinationAccountId(bankAccounts.find((acc) => acc.id !== firstBank)?.id || '')
    setIsFormOpen(true)
  }

  function handleCategoryChange(selectedId: string) {
    setCategoryId(selectedId)
    const selected = categories.find((c) => c.id === selectedId)
    if (!selected) return

    // Auto-identifica como Despesa ou Receita
    if (selected.tipo === 'DESPESA' && transactionType !== 'DESPESA') {
      setTransactionType('DESPESA')
      setStatus('EFETIVADO')
    } else if (selected.tipo === 'RECEITA' && transactionType !== 'RECEITA') {
      setTransactionType('RECEITA')
      setStatus('EFETIVADO')
    }
  }

  async function handlePaymentMethodChange(method: FormaPagamentoDespesa) {
    setFormaPagamento(method)
    if (method === 'CARTAO_CREDITO') {
      setStatus('PENDENTE')
    } else {
      setStatus('EFETIVADO')
    }
  }

  async function ensureContaCaixa(): Promise<Conta> {
    if (contaCaixa) return contaCaixa
    if (!profile) throw new Error('Perfil não encontrado.')

    const id = await criarConta(db, profile.familiaId, profile.id, {
      nome: 'Caixa',
      tipoConta: 'CAIXINHA',
      saldoAtual: 0,
      ativo: true,
    })

    const novaConta: Conta = {
      id,
      nome: 'Caixa',
      tipoConta: 'CAIXINHA',
      saldoAtual: 0,
      ativo: true,
    }
    setAccounts((prev) => [...prev, novaConta])
    return novaConta
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const parsed = parseAmount(amount)
    if (parsed === null) {
      setFormError('Informe um valor maior que zero.')
      return
    }

    if (!profile) {
      setFormError('Sessão expirada. Recarregue a página.')
      return
    }

    const parsedTransactionDate = parseDateInput(date)
    if (!parsedTransactionDate) {
      setFormError('Informe uma data válida para o lançamento.')
      return
    }

    const selectedCategory = categories.find((category) => category.id === categoryId)
    if (!selectedCategory) {
      setFormError('Selecione uma categoria.')
      return
    }

    const finalDescription = description.trim() || selectedCategory.nome

    setIsSaving(true)
    try {
      const dataTransacao = parsedTransactionDate

      if (transactionType === 'TRANSFERENCIA') {
        if (!accountId || !destinationAccountId || destinationAccountId === accountId) {
          setFormError('Selecione contas de origem e destino diferentes.')
          setIsSaving(false)
          return
        }
        await cadastrarTransferencia(db, profile.familiaId, {
          contaOrigemId: accountId,
          contaDestinoId: destinationAccountId,
          descricao: finalDescription,
          valor: parsed,
          dataTransacao,
          status,
          criadoPorUsuarioId: profile.id,
          criadoPorNome: profile.nome,
          categoriaId: selectedCategory.id,
        })
      } else if (transactionType === 'DESPESA') {
        if (formaPagamento === 'DINHEIRO') {
          // Dinheiro -> tirar saldo da conta Caixa
          const caixa = await ensureContaCaixa()
          await cadastrarTransacao(db, profile.familiaId, {
            descricao: finalDescription,
            valor: parsed,
            tipoMovimentacao: 'DESPESA',
            status: 'EFETIVADO',
            dataTransacao,
            contaId: caixa.id,
            categoriaId: selectedCategory.id,
            categoriaNome: selectedCategory.nome,
            criadoPorUsuarioId: profile.id,
            criadoPorNome: profile.nome,
            estornado: false,
            formaPagamento: 'normal',
            observacao: observation.trim() || undefined,
          })
        } else if (formaPagamento === 'PIX' || formaPagamento === 'CARTAO_DEBITO') {
          // Pix ou Cartão Débito -> Informar conta para Débito
          if (!accountId) {
            setFormError('Informe a conta para débito.')
            setIsSaving(false)
            return
          }
          await cadastrarTransacao(db, profile.familiaId, {
            descricao: finalDescription,
            valor: parsed,
            tipoMovimentacao: 'DESPESA',
            status,
            dataTransacao,
            contaId: accountId,
            categoriaId: selectedCategory.id,
            categoriaNome: selectedCategory.nome,
            criadoPorUsuarioId: profile.id,
            criadoPorNome: profile.nome,
            estornado: false,
            formaPagamento: 'normal',
            observacao: observation.trim() || undefined,
          })
        } else if (formaPagamento === 'CARTAO_CREDITO') {
          // Cartão de Crédito
          if (!selectedCreditCard) {
            setFormError('Nenhum cartão de crédito ativo cadastrado. Cadastre um cartão de crédito primeiro.')
            setIsSaving(false)
            return
          }

          const cardId = selectedCreditCard.id
          const calculatedInvoice = calcularFaturaCartao(date, selectedCreditCard.diaVencimento || 10)
          if (!calculatedInvoice) {
            throw new Error('Informe uma data válida para calcular a fatura do cartão.')
          }
          const valorParcela = numInstallments > 1
            ? Number((parsed / numInstallments).toFixed(2))
            : parsed

          // Localiza ou cria a fatura de cartão correspondente
          let targetInvoice = invoices.find((inv) =>
            inv.contaId === cardId && inv.mesReferencia === calculatedInvoice.mesReferencia,
          )

          let faturaId = targetInvoice?.id

          if (!targetInvoice) {
            faturaId = await criarFaturaCartao(db, profile.familiaId, {
              contaId: cardId,
              mesReferencia: calculatedInvoice.mesReferencia,
            })
            await atualizarFaturaCartao(db, profile.familiaId, faturaId, {
              valorTotal: valorParcela,
              valorPago: 0,
              status: 'ABERTA',
            })
          } else {
            const novoTotal = (targetInvoice.valorTotal || 0) + valorParcela
            await atualizarFaturaCartao(db, profile.familiaId, targetInvoice.id, {
              valorTotal: novoTotal,
              valorPago: targetInvoice.valorPago || 0,
              status: targetInvoice.status === 'PAGA' && novoTotal > (targetInvoice.valorPago || 0)
                ? 'ABERTA'
                : targetInvoice.status,
            })
          }

          if (numInstallments > 1) {
            // Mais de 1 parcela: Atualiza a coleção Parcelamentos
            const parcelamentoId = await criarParcelamento(db, profile.familiaId, {
              descricao: finalDescription,
              valorTotal: parsed,
              totalParcelas: numInstallments,
              dataInicio: dataTransacao,
              contaId: cardId,
              categoriaId: selectedCategory.id,
              tipoMovimentacao: 'DESPESA',
              ativo: true,
              criadoPorUsuarioId: profile.id,
            })

            // Inclui a primeira parcela na fatura atual ou próxima fatura
            await cadastrarTransacao(db, profile.familiaId, {
              descricao: `${finalDescription} (1/${numInstallments})`,
              valor: valorParcela,
              tipoMovimentacao: 'DESPESA',
              status: 'PENDENTE',
              dataTransacao,
              contaId: cardId,
              categoriaId: selectedCategory.id,
              categoriaNome: selectedCategory.nome,
              criadoPorUsuarioId: profile.id,
              criadoPorNome: profile.nome,
              estornado: false,
              formaPagamento: 'credit',
              parcelas: numInstallments,
              parcelaAtual: 1,
              parcelamentoId,
              faturaId,
              diaVencimento: selectedCreditCard.diaVencimento || 10,
              observacao: observation.trim() || undefined,
            })
          } else {
            // Apenas 1 parcela
            await cadastrarTransacao(db, profile.familiaId, {
              descricao: finalDescription,
              valor: parsed,
              tipoMovimentacao: 'DESPESA',
              status: 'PENDENTE',
              dataTransacao,
              contaId: cardId,
              categoriaId: selectedCategory.id,
              categoriaNome: selectedCategory.nome,
              criadoPorUsuarioId: profile.id,
              criadoPorNome: profile.nome,
              estornado: false,
              formaPagamento: 'credit',
              parcelas: 1,
              faturaId,
              diaVencimento: selectedCreditCard.diaVencimento || 10,
              observacao: observation.trim() || undefined,
            })
          }
        }
      } else if (transactionType === 'RECEITA') {
        if (formaRecebimento === 'DINHEIRO') {
          // Dinheiro -> Colocar saldo na Conta Caixa
          const caixa = await ensureContaCaixa()
          await cadastrarTransacao(db, profile.familiaId, {
            descricao: finalDescription,
            valor: parsed,
            tipoMovimentacao: 'RECEITA',
            status: 'EFETIVADO',
            dataTransacao,
            contaId: caixa.id,
            categoriaId: selectedCategory.id,
            categoriaNome: selectedCategory.nome,
            criadoPorUsuarioId: profile.id,
            criadoPorNome: profile.nome,
            estornado: false,
            formaPagamento: 'normal',
            observacao: observation.trim() || undefined,
          })
        } else {
          // Pix, Crédito em conta, Depósito -> Informar conta para Crédito
          if (!accountId) {
            setFormError('Informe a conta para crédito.')
            setIsSaving(false)
            return
          }
          await cadastrarTransacao(db, profile.familiaId, {
            descricao: finalDescription,
            valor: parsed,
            tipoMovimentacao: 'RECEITA',
            status,
            dataTransacao,
            contaId: accountId,
            categoriaId: selectedCategory.id,
            categoriaNome: selectedCategory.nome,
            criadoPorUsuarioId: profile.id,
            criadoPorNome: profile.nome,
            estornado: false,
            formaPagamento: 'normal',
            observacao: observation.trim() || undefined,
          })
        }
      }

      closeForm()
      setFeedback('Lançamento salvo com sucesso.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error)
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o registro.')
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

    const linkedCheckingAccount = accounts.find((account) => account.id === linkedCheckingAccountId)
    const institutionId = accountType === 'CARTAO_CREDITO'
      ? linkedCheckingAccount?.instituicaoId ?? ''
      : accountInstitutionId

    if (accountType !== 'CARTAO_CREDITO' && institutionId && !agency.trim()) {
      setAccountError('Informe a agência da conta vinculada à instituição.')
      return
    }
    if (accountType !== 'CARTAO_CREDITO' && institutionId && !accountNumber.trim()) {
      setAccountError('Informe o número da conta vinculada à instituição.')
      return
    }

    const normalizedDueDay = Number(accountDueDay)
    if (accountType === 'CARTAO_CREDITO'
      && (!Number.isInteger(normalizedDueDay) || normalizedDueDay < 1 || normalizedDueDay > 31)) {
      setAccountError('Informe um dia de vencimento entre 1 e 31.')
      return
    }

    const normalizedLimit = parseLimit(creditLimit)
    if ((accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO')
      && (normalizedLimit === null || normalizedLimit < 0)) {
      setAccountError('Informe um limite válido, igual ou maior que zero.')
      return
    }

    if (accountType === 'CARTAO_CREDITO') {
      if (!linkedCheckingAccount || !linkedCheckingAccount.ativo || linkedCheckingAccount.tipoConta !== 'CORRENTE'
        || !linkedCheckingAccount.instituicaoId) {
        setAccountError('Selecione uma conta corrente ativa vinculada a uma instituição.')
        return
      }
      if (normalizedLimit === null || normalizedLimit <= 0) {
        setAccountError('O limite da conta cartão deve ser maior que zero.')
        return
      }
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
        instituicaoId: institutionId || null,
        agencia: accountType === 'CARTAO_CREDITO' ? null : agency.trim() || null,
        numeroConta: accountType === 'CARTAO_CREDITO' ? null : accountNumber.trim() || null,
        limiteTotal: accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO'
          ? normalizedLimit
          : null,
        contaCorrenteId: accountType === 'CARTAO_CREDITO' ? linkedCheckingAccountId : null,
        diaVencimento: accountType === 'CARTAO_CREDITO' ? normalizedDueDay : null,
      })

      const newAccount: Conta = {
        id,
        nome: accountName.trim(),
        tipoConta: accountType,
        saldoAtual: balance,
        ativo: true,
        instituicaoId: institutionId || null,
        agencia: accountType === 'CARTAO_CREDITO' ? null : agency.trim() || null,
        numeroConta: accountType === 'CARTAO_CREDITO' ? null : accountNumber.trim() || null,
        limiteTotal: accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO'
          ? normalizedLimit
          : null,
        contaCorrenteId: accountType === 'CARTAO_CREDITO' ? linkedCheckingAccountId : null,
        diaVencimento: accountType === 'CARTAO_CREDITO' ? normalizedDueDay : null,
      }

      setAccounts((current) => [...current, newAccount])
      if (accountType === 'CARTAO_CREDITO') {
        setCreditCardAccountId(id)
      } else {
        setAccountId(id)
      }
      setIsAccountFormOpen(false)
      setAccountName('')
      setAccountInstitutionId('')
      setAgency('')
      setAccountNumber('')
      setLinkedCheckingAccountId('')
      setCreditLimit('0')
      setAccountDueDay('')
      setOpeningBalance('0')
      setFeedback('Conta criada com sucesso.')
    } catch (error) {
      console.error('Erro ao criar conta:', error)
      setAccountError('Não foi possível criar a conta. Tente novamente.')
    } finally {
      setIsSavingAccount(false)
    }
  }

  // Filtragem e organização das categorias
  const despesaCategories = categories.filter((c) => c.ativo !== false && (c.tipo === 'DESPESA' || c.tipo === 'AMBAS'))
  const receitaCategories = categories.filter((c) => c.ativo !== false && (c.tipo === 'RECEITA' || c.tipo === 'AMBAS'))
  const transferCategories = categories.filter((c) => c.ativo !== false && (c.tipo === 'TRANSFERENCIA' || c.tipo === 'AMBAS'))

  return (
    <main className="home-page records-page">
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

        <section className="records-heading" aria-labelledby="records-title">
          <div>
            <p className="eyebrow">Movimentações financeiras</p>
            <h1 id="records-title">Lançamentos</h1>
            <p>Gerencie receitas, despesas e compras com cartão de crédito.</p>
          </div>
          <div className="records-header-actions">
            <button className="records-secondary-button" type="button" onClick={() => setIsAccountFormOpen(true)}>
              Nova conta
            </button>
            <button className="records-create-button" type="button" onClick={() => openForm('DESPESA')}>
              <span aria-hidden="true">+</span> Novo lançamento
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
            <span>Despesas efetivadas</span>
            <strong className="records-expense">{currencyFormatter.format(totalExpenses)}</strong>
          </div>
          <div className="records-metric">
            <span>Fatura / Cartão pendente</span>
            <strong style={{ color: 'var(--finup-warning, #f59e0b)' }}>
              {currencyFormatter.format(totalPendingCredit)}
            </strong>
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
              <p>Adicione um lançamento para acompanhar seu fluxo financeiro.</p>
              <button type="button" className="records-empty-action" onClick={() => openForm('DESPESA')}>
                Adicionar lançamento
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
                  const account = accounts.find((a) => a.id === transaction.contaId)

                  return (
                    <li className="records-row" key={transaction.id}>
                      <div className="records-description">
                        <span
                          className={isTransfer ? 'records-type-icon is-transfer' : isIncome ? 'records-type-icon is-income' : 'records-type-icon is-expense'}
                          aria-hidden="true"
                        >
                          {isTransfer ? '↔' : isIncome ? '↑' : '↓'}
                        </span>
                        <span>
                          <strong>{transaction.descricao}</strong>
                          <small>
                            {transaction.criadoPorNome} · {account?.nome || 'Conta'}
                            {transaction.formaPagamento === 'credit' && ' · 💳 Cartão de Crédito'}
                            {transaction.observacao && ` · Obs: ${transaction.observacao}`}
                          </small>
                        </span>
                      </div>
                      <span className="records-category">{transaction.categoriaNome}</span>
                      <time className="records-date" dateTime={transaction.dataTransacao.toISOString()}>
                        {formatDate(transaction.dataTransacao)}
                      </time>
                      <span className="records-row-status">
                        <span className={transaction.estornado
                          ? 'records-status is-cancelled'
                          : transaction.status === 'PENDENTE' ? 'records-status is-pending' : 'records-status'}>
                          {transaction.estornado
                            ? 'Estornado'
                            : transaction.status === 'PENDENTE' ? 'Pendente' : 'Efetivado'}
                        </span>
                        {transaction.status === 'PENDENTE' && !transaction.estornado && (
                          <button
                            className="records-retry"
                            type="button"
                            onClick={() => void settleTransaction(transaction.id)}
                            title="Efetivar movimentação e debitar da conta vinculada"
                          >
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

      {/* MODAL: NOVO LANÇAMENTO */}
      {isFormOpen && (
        <div
          className="records-overlay"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !isSaving) closeForm()
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) closeForm()
          }}
        >
          <section className="records-dialog" role="dialog" aria-modal="true" aria-labelledby="records-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Lançamentos</p>
                <h2 id="records-dialog-title">
                  {transactionType === 'RECEITA' ? 'Novo recebimento' : transactionType === 'DESPESA' ? 'Nova despesa' : 'Nova transferência'}
                </h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={closeForm} disabled={isSaving}>
                ×
              </button>
            </header>

            <form className="records-form" onSubmit={handleSubmit}>
              {/* SELETOR RÁPIDO DE TIPO */}
              <div className="records-type-switch" role="group" aria-label="Tipo de lançamento">
                <button
                  type="button"
                  className={transactionType === 'DESPESA' ? 'is-expense is-selected' : 'is-expense'}
                  aria-pressed={transactionType === 'DESPESA'}
                  onClick={() => {
                    setTransactionType('DESPESA')
                    setCategoryId('')
                    setStatus(formaPagamento === 'CARTAO_CREDITO' ? 'PENDENTE' : 'EFETIVADO')
                  }}
                >
                  ↓ Despesa
                </button>
                <button
                  type="button"
                  className={transactionType === 'RECEITA' ? 'is-income is-selected' : 'is-income'}
                  aria-pressed={transactionType === 'RECEITA'}
                  onClick={() => {
                    setTransactionType('RECEITA')
                    setCategoryId('')
                    setStatus('EFETIVADO')
                  }}
                >
                  ↑ Recebimento
                </button>
                <button
                  type="button"
                  className={transactionType === 'TRANSFERENCIA' ? 'is-selected' : ''}
                  aria-pressed={transactionType === 'TRANSFERENCIA'}
                  onClick={() => {
                    setTransactionType('TRANSFERENCIA')
                    setCategoryId(transferCategories[0]?.id || '')
                    setStatus('EFETIVADO')
                  }}
                >
                  ↔ Transferência
                </button>
              </div>

              {/* 1. DATA DA TRANSAÇÃO */}
              <label htmlFor="record-date">Data da transação *</label>
              <input
                id="record-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />

              {/* 2. CATEGORIA (com autoidentificação de Despesa / Receita) */}
              <label htmlFor="record-category">
                Categoria * <small style={{ color: 'var(--finup-subtle)' }}>(define Despesa / Receita automaticamente)</small>
              </label>
              <select
                id="record-category"
                value={categoryId}
                onChange={(event) => handleCategoryChange(event.target.value)}
                required
              >
                <option value="" disabled>Selecione uma categoria</option>
                {transactionType === 'DESPESA' ? (
                  despesaCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.nome}</option>
                  ))
                ) : transactionType === 'RECEITA' ? (
                  receitaCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.nome}</option>
                  ))
                ) : (
                  transferCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.nome}</option>
                  ))
                )}
              </select>

              {/* 3. SE DESPESA: FORMAS DE PAGAMENTO */}
              {transactionType === 'DESPESA' && (
                <>
                  <label>Forma de Pagamento *</label>
                  <div className="records-methods-grid" role="radiogroup" aria-label="Forma de Pagamento">
                    <button
                      type="button"
                      className={`records-method-pill ${formaPagamento === 'DINHEIRO' ? 'is-active-expense' : ''}`}
                      onClick={() => handlePaymentMethodChange('DINHEIRO')}
                    >
                      💵 Dinheiro
                    </button>
                    <button
                      type="button"
                      className={`records-method-pill ${formaPagamento === 'PIX' ? 'is-active-expense' : ''}`}
                      onClick={() => handlePaymentMethodChange('PIX')}
                    >
                      ⚡ Pix
                    </button>
                    <button
                      type="button"
                      className={`records-method-pill ${formaPagamento === 'CARTAO_DEBITO' ? 'is-active-expense' : ''}`}
                      onClick={() => handlePaymentMethodChange('CARTAO_DEBITO')}
                    >
                      💳 Cartão Débito
                    </button>
                    <button
                      type="button"
                      className={`records-method-pill ${formaPagamento === 'CARTAO_CREDITO' ? 'is-active-expense' : ''}`}
                      onClick={() => handlePaymentMethodChange('CARTAO_CREDITO')}
                    >
                      💳 Cartão Crédito
                    </button>
                  </div>

                  {/* DINHEIRO -> CONTA CAIXA */}
                  {formaPagamento === 'DINHEIRO' && (
                    <div className="records-info-banner is-caixa">
                      <span className="records-info-badge">💵 Dinheiro selecionado</span>
                      <p>
                        O saldo será debitado automaticamente da <strong>Conta Caixa</strong>{' '}
                        {contaCaixa ? `(${contaCaixa.nome} - Saldo: ${currencyFormatter.format(contaCaixa.saldoAtual)})` : '(uma conta Caixa será criada automaticamente)'}.
                      </p>
                    </div>
                  )}

                  {/* PIX / CARTÃO DÉBITO -> INFORMAR CONTA PARA DÉBITO */}
                  {(formaPagamento === 'PIX' || formaPagamento === 'CARTAO_DEBITO') && (
                    <>
                      <label htmlFor="record-debit-account">Informar conta para Débito *</label>
                      <select
                        id="record-debit-account"
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        required
                      >
                        <option value="" disabled>Selecione a conta para débito</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.nome} ({account.tipoConta}) — Saldo: {currencyFormatter.format(account.saldoAtual)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {/* CARTÃO DE CRÉDITO: SELEÇÃO, PARCELAS E REGRAS DE FATURA */}
                  {formaPagamento === 'CARTAO_CREDITO' && (
                    <>
                      <label htmlFor="record-credit-card">Cartão de Crédito *</label>
                      {creditCardAccounts.length === 0 ? (
                        <div className="records-info-banner" style={{ borderColor: 'var(--finup-danger)' }}>
                          <p>
                            Você não possui nenhuma conta de <strong>Cartão de Crédito</strong> cadastrada.{' '}
                            <button
                              type="button"
                              className="records-empty-action"
                              style={{ margin: '6px 0 0', display: 'inline-block' }}
                              onClick={() => {
                                setAccountType('CARTAO_CREDITO')
                                setIsAccountFormOpen(true)
                              }}
                            >
                              + Criar conta Cartão de Crédito
                            </button>
                          </p>
                        </div>
                      ) : (
                        <select
                          id="record-credit-card"
                          value={creditCardAccountId}
                          onChange={(event) => setCreditCardAccountId(event.target.value)}
                          required
                        >
                          <option value="" disabled>Selecione o cartão de crédito</option>
                          {creditCardAccounts.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.nome} (Vencimento: dia {card.diaVencimento || 10})
                            </option>
                          ))}
                        </select>
                      )}

                      <label htmlFor="record-installments">Informar quantidade de parcelas *</label>
                      <input
                        id="record-installments"
                        type="number"
                        min="1"
                        max="48"
                        step="1"
                        value={installments}
                        onChange={(event) => setInstallments(event.target.value)}
                        required
                      />

                      {/* INFORMAÇÕES DA FATURA E REGRA DE 10 DIAS ANTES DO VENCIMENTO */}
                      {selectedCreditCard && invoiceInfo && (
                        <div className="records-info-banner is-credit">
                          <span className="records-info-badge">💳 Regra de Fechamento da Fatura</span>
                          <p>
                            O fechamento da fatura ocorre sempre <strong>10 dias antes</strong> do dia de vencimento (dia {cardDueDay}).
                          </p>
                          <div className="records-invoice-breakdown">
                            <div>
                              <span>Data de Fechamento</span>
                              <strong>{formatDate(invoiceInfo.dataFechamento)}</strong>
                            </div>
                            <div>
                              <span>Data de Vencimento</span>
                              <strong>{formatDate(invoiceInfo.dataVencimento)}</strong>
                            </div>
                            <div>
                              <span>Fatura de Destino</span>
                              <strong style={{ color: invoiceInfo.isFaturaAtual ? 'var(--finup-primary)' : 'var(--finup-warning, #f59e0b)' }}>
                                {invoiceInfo.descricaoFatura}
                              </strong>
                            </div>
                          </div>
                          {numInstallments > 1 && (
                            <p style={{ marginTop: '8px', fontSize: '12px' }}>
                              🔄 <strong>Parcelamento:</strong> O valor total será dividido em{' '}
                              <strong>{numInstallments}x de {currencyFormatter.format(installmentAmount)}</strong>. A 1ª parcela será incluída na{' '}
                              <strong>{invoiceInfo.descricaoFatura}</strong> e o parcelamento registrado na coleção <strong>Parcelamentos</strong>.
                            </p>
                          )}
                          {numInstallments === 1 && (
                            <p style={{ marginTop: '8px', fontSize: '12px' }}>
                              ✅ Compra à vista no cartão incluída diretamente na <strong>{invoiceInfo.descricaoFatura}</strong>.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* 4. SE RECEBIMENTO: FORMAS DE RECEBIMENTO */}
              {transactionType === 'RECEITA' && (
                <>
                  <label>Forma de Recebimento *</label>
                  <div className="records-methods-grid" role="radiogroup" aria-label="Forma de Recebimento">
                    <button
                      type="button"
                      className={`records-method-pill ${formaRecebimento === 'DINHEIRO' ? 'is-active-income' : ''}`}
                      onClick={() => setFormaRecebimento('DINHEIRO')}
                    >
                      💵 Dinheiro
                    </button>
                    <button
                      type="button"
                      className={`records-method-pill ${formaRecebimento === 'PIX' ? 'is-active-income' : ''}`}
                      onClick={() => setFormaRecebimento('PIX')}
                    >
                      ⚡ Pix
                    </button>
                    <button
                      type="button"
                      className={`records-method-pill ${formaRecebimento === 'CREDITO_CONTA' ? 'is-active-income' : ''}`}
                      onClick={() => setFormaRecebimento('CREDITO_CONTA')}
                    >
                      🏦 Crédito em conta
                    </button>
                    <button
                      type="button"
                      className={`records-method-pill ${formaRecebimento === 'DEPOSITO' ? 'is-active-income' : ''}`}
                      onClick={() => setFormaRecebimento('DEPOSITO')}
                    >
                      📥 Depósito
                    </button>
                  </div>

                  {/* DINHEIRO -> COLOCAR SALDO NA CONTA CAIXA */}
                  {formaRecebimento === 'DINHEIRO' && (
                    <div className="records-info-banner is-caixa">
                      <span className="records-info-badge">💵 Dinheiro selecionado</span>
                      <p>
                        O saldo será creditado automaticamente na <strong>Conta Caixa</strong>{' '}
                        {contaCaixa ? `(${contaCaixa.nome} - Saldo: ${currencyFormatter.format(contaCaixa.saldoAtual)})` : '(uma conta Caixa será criada automaticamente)'}.
                      </p>
                    </div>
                  )}

                  {/* PIX / CRÉDITO EM CONTA / DEPÓSITO -> INFORMAR CONTA PARA CRÉDITO */}
                  {formaRecebimento !== 'DINHEIRO' && (
                    <>
                      <label htmlFor="record-credit-account">Informar conta para Crédito *</label>
                      <select
                        id="record-credit-account"
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        required
                      >
                        <option value="" disabled>Selecione a conta para crédito</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.nome} ({account.tipoConta}) — Saldo: {currencyFormatter.format(account.saldoAtual)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </>
              )}

              {/* SE TRANSFERÊNCIA: ORIGEM E DESTINO */}
              {transactionType === 'TRANSFERENCIA' && (
                <>
                  <label htmlFor="record-account-origin">Conta de origem *</label>
                  <select
                    id="record-account-origin"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    required
                  >
                    <option value="" disabled>Selecione a conta de origem</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.nome} — Saldo: {currencyFormatter.format(account.saldoAtual)}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="record-account-dest">Conta de destino *</label>
                  <select
                    id="record-account-dest"
                    value={destinationAccountId}
                    onChange={(event) => setDestinationAccountId(event.target.value)}
                    required
                  >
                    <option value="" disabled>Selecione a conta de destino</option>
                    {bankAccounts.filter((account) => account.id !== accountId).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.nome} — Saldo: {currencyFormatter.format(account.saldoAtual)}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* DESCRIÇÃO E VALOR */}
              <div className="records-form-grid">
                <div>
                  <label htmlFor="record-amount">Valor *</label>
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
                  <label htmlFor="record-status">Status</label>
                  <select
                    id="record-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as 'EFETIVADO' | 'PENDENTE')}
                    disabled={transactionType === 'DESPESA' && formaPagamento === 'CARTAO_CREDITO'}
                  >
                    <option value="EFETIVADO">Efetivado</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </div>
              </div>

              <label htmlFor="record-description">Descrição *</label>
              <input
                id="record-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={transactionType === 'RECEITA' ? 'Ex.: Salário, Venda' : transactionType === 'DESPESA' ? 'Ex.: Supermercado, Almoço' : 'Ex.: Transferência'}
                maxLength={120}
                required
              />

              {/* OBSERVAÇÃO */}
              <label htmlFor="record-observation">Observação</label>
              <textarea
                id="record-observation"
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                placeholder="Observações adicionais (opcional)"
                rows={2}
                maxLength={500}
              />

              {formError && <p className="records-form-error" role="alert">{formError}</p>}

              <footer className="records-form-actions">
                <button className="records-cancel" type="button" onClick={closeForm} disabled={isSaving}>
                  Cancelar
                </button>
                <button className="records-save" type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar lançamento'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* MODAL: NOVA CONTA (Sub-modal) */}
      {isAccountFormOpen && (
        <div
          className="records-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingAccount) setIsAccountFormOpen(false)
          }}
        >
          <section className="records-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Contas da família</p>
                <h2 id="account-dialog-title">Nova conta</h2>
              </div>
              <button
                className="records-close"
                type="button"
                aria-label="Fechar formulário"
                onClick={() => setIsAccountFormOpen(false)}
                disabled={isSavingAccount}
              >
                ×
              </button>
            </header>
            <form className="records-form" onSubmit={handleCreateAccount}>
              <label htmlFor="account-name">Nome da conta *</label>
              <input
                id="account-name"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                maxLength={80}
                placeholder="Ex.: Nubank, Carteira, Caixa..."
                required
              />

              <label htmlFor="account-type">Tipo de conta *</label>
              <select
                id="account-type"
                value={accountType}
                onChange={(event) => {
                  const nextType = event.target.value as Conta['tipoConta']
                  setAccountType(nextType)
                  setLinkedCheckingAccountId('')
                  if (nextType === 'CARTAO_CREDITO') {
                    setAccountInstitutionId('')
                    setAgency('')
                    setAccountNumber('')
                  }
                }}
              >
                <option value="CORRENTE">Conta corrente</option>
                <option value="POUPANCA">Poupança</option>
                <option value="CARTAO_CREDITO">Cartão de crédito</option>
                <option value="CAIXINHA">Caixinha / Caixa</option>
                <option value="INVESTIMENTO">Conta investimento</option>
                <option value="OUTROS">Outros</option>
              </select>

              {accountType === 'CARTAO_CREDITO' ? (
                <>
                  <label htmlFor="account-checking">Conta corrente vinculada *</label>
                  <select
                    id="account-checking"
                    value={linkedCheckingAccountId}
                    onChange={(event) => {
                      const checkingAccount = accounts.find((account) => account.id === event.target.value)
                      setLinkedCheckingAccountId(event.target.value)
                      setAccountInstitutionId(checkingAccount?.instituicaoId ?? '')
                    }}
                    required
                  >
                    <option value="">Selecione uma conta corrente</option>
                    {accounts.filter((account) => account.ativo
                      && account.tipoConta === 'CORRENTE'
                      && Boolean(account.instituicaoId)).map((account) => (
                      <option key={account.id} value={account.id}>{account.nome}</option>
                    ))}
                  </select>
                  <p className="manager-form-note">
                    Instituição: {institutions.find((item) => item.id === accountInstitutionId)?.nome ?? 'definida pela conta corrente'}
                  </p>

                  <label htmlFor="account-due-day">Dia de vencimento da fatura *</label>
                  <input
                    id="account-due-day"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={accountDueDay}
                    onChange={(event) => setAccountDueDay(event.target.value)}
                    placeholder="Ex.: 10, 15, 20..."
                    required
                  />
                  <p className="manager-form-note">
                    O fechamento ocorrerá sempre 10 dias antes deste dia de vencimento.
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="account-institution">Instituição bancária</label>
                  <select
                    id="account-institution"
                    value={accountInstitutionId}
                    onChange={(event) => setAccountInstitutionId(event.target.value)}
                  >
                    <option value="">Sem instituição</option>
                    {institutions.filter((institution) => institution.ativo).map((institution) => (
                      <option key={institution.id} value={institution.id}>{institution.nome}</option>
                    ))}
                  </select>
                  <label htmlFor="account-agency">Agência{accountInstitutionId ? ' *' : ''}</label>
                  <input
                    id="account-agency"
                    value={agency}
                    onChange={(event) => setAgency(event.target.value)}
                    maxLength={20}
                    required={Boolean(accountInstitutionId)}
                  />
                  <label htmlFor="account-number">Número da conta{accountInstitutionId ? ' *' : ''}</label>
                  <input
                    id="account-number"
                    value={accountNumber}
                    onChange={(event) => setAccountNumber(event.target.value)}
                    maxLength={30}
                    required={Boolean(accountInstitutionId)}
                  />
                </>
              )}

              {(accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO') && (
                <>
                  <label htmlFor="account-limit">
                    {accountType === 'CARTAO_CREDITO' ? 'Limite total de crédito do cartão *' : 'Limite de crédito / cheque especial'}
                  </label>
                  <input
                    id="account-limit"
                    type="text"
                    inputMode="decimal"
                    value={creditLimit}
                    onChange={(event) => setCreditLimit(event.target.value)}
                    required
                  />
                </>
              )}

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
                <button
                  className="records-cancel"
                  type="button"
                  onClick={() => setIsAccountFormOpen(false)}
                  disabled={isSavingAccount}
                >
                  Cancelar
                </button>
                <button className="records-save" type="submit" disabled={isSavingAccount}>
                  {isSavingAccount ? 'Salvando...' : 'Criar conta'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}