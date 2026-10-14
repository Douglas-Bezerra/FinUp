// shared/services/finupService.ts
// Serviço que fornece acesso ao banco de dados do Firebase
// ========================================================

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  type Firestore,
  updateDoc,
} from 'firebase/firestore'
import type {
  Categoria,
  CartaoPlastico,
  Conta,
  FaturaCartao,
  InstituicaoBancaria,
  LogAtividade,
  OrcamentoMeta,
  Parcelamento,
  PapelUsuario,
  Recorrencia,
  StatusTransacao,
  TipoMovimentacao,
  Transacao,
  Usuario,
} from '../types/finup'

const defaultCategories: Categoria[] = [
  { id: '10000000-0000-4000-8000-000000000001', nome: 'Salário', icone: 'cash-outline', tipo: 'RECEITA' },
  { id: '10000000-0000-4000-8000-000000000002', nome: 'Freelance', icone: 'briefcase-outline', tipo: 'RECEITA' },
  { id: '10000000-0000-4000-8000-000000000003', nome: 'Aluguel', icone: 'home-outline', tipo: 'RECEITA' },
  { id: '10000000-0000-4000-8000-000000000004', nome: 'Dividendos', icone: 'trending-up-outline', tipo: 'RECEITA' },
  { id: '10000000-0000-4000-8000-000000000005', nome: 'Presente', icone: 'gift-outline', tipo: 'RECEITA' },
  { id: '10000000-0000-4000-8000-000000000006', nome: 'Outros', icone: 'ellipsis-horizontal-outline', tipo: 'RECEITA' },
  { id: '20000000-0000-4000-8000-000000000001', nome: 'Alimentação', icone: 'restaurant-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000002', nome: 'Transporte', icone: 'car-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000003', nome: 'Moradia', icone: 'home-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000004', nome: 'Saúde', icone: 'medkit-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000005', nome: 'Lazer', icone: 'game-controller-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000006', nome: 'Educação', icone: 'school-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000007', nome: 'Assinatura', icone: 'repeat-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000008', nome: 'Tecnologia', icone: 'phone-portrait-outline', tipo: 'DESPESA' },
  { id: '20000000-0000-4000-8000-000000000009', nome: 'Outros', icone: 'ellipsis-horizontal-outline', tipo: 'DESPESA' },
  { id: '30000000-0000-4000-8000-000000000001', nome: 'Transferência', icone: 'swap-horizontal-outline', tipo: 'TRANSFERENCIA' },
]

function familyCollection(db: Firestore, familyId: string, name: string) {
  return collection(db, 'familias', familyId, name)
}

function familyDocument(db: Firestore, familyId: string, name: string, id: string) {
  return doc(db, 'familias', familyId, name, id)
}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} não pode ficar vazio.`)
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} deve ser maior que zero.`)
}

function assertMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Mês de referência inválido; use AAAA-MM.')
}

function optionalTimestamp(value: Date | null | undefined) {
  return value ? Timestamp.fromDate(value) : null
}

function omitUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>
}

function mapDatedDocument<T>(id: string, data: Record<string, unknown>, dateFields: string[]): T {
  const mapped: Record<string, unknown> = { ...data, id }
  for (const field of dateFields) {
    if (mapped[field] !== null && mapped[field] !== undefined) {
      mapped[field] = toDate(mapped[field])
    }
  }
  return mapped as T
}

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const result = new Date(value)
    if (Number.isNaN(result.getTime())) throw new Error('Data inválida recebida do Firestore.')
    return result
  }
  throw new Error('Data inválida recebida do Firestore.')
}

function mapTransaction(id: string, data: Record<string, unknown>): Transacao {
  return {
    ...data,
    id,
    dataTransacao: toDate(data.dataTransacao),
    dataAtualizacao: data.dataAtualizacao ? toDate(data.dataAtualizacao) : undefined,
  } as Transacao
}

function balanceDelta(tipo: TipoMovimentacao, valor: number) {
  if (tipo === 'RECEITA') return valor
  if (tipo === 'DESPESA') return -valor
  throw new Error('Transferências precisam ser registradas pela operação de transferência.')
}

function assertPositiveAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('O valor da movimentação deve ser maior que zero.')
  }
}

export async function obterUsuario(db: Firestore, usuarioId: string): Promise<Usuario | null> {
  const snapshot = await getDoc(doc(db, 'usuarios', usuarioId))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    id: snapshot.id,
    nome: data.nome,
    email: data.email,
    papel: data.papel as PapelUsuario,
    usuarioPaiId: data.usuarioPaiId ?? null,
    familiaId: data.familiaId,
    dataCriacao: toDate(data.dataCriacao),
  }
}

export async function criarUsuarioPrincipal(
  db: Firestore,
  usuarioId: string,
  email: string,
  nome: string,
): Promise<void> {
  const userRef = doc(db, 'usuarios', usuarioId)
  const familyRef = doc(db, 'familias', usuarioId)

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, familySnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(familyRef),
    ])
    if (userSnapshot.exists()) {
      if (userSnapshot.data().familiaId !== usuarioId) {
        throw new Error('O perfil existente está associado a outra família.')
      }
      return
    }
    if (familySnapshot.exists()) {
      throw new Error('Já existe uma família sem o perfil principal correspondente.')
    }

    const now = Timestamp.now()
    transaction.set(familyRef, { principalUsuarioId: usuarioId, dataCriacao: now })
    transaction.set(userRef, {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      papel: 'PRINCIPAL',
      usuarioPaiId: null,
      familiaId: usuarioId,
      dataCriacao: now,
    })
    transaction.set(doc(db, 'familias', usuarioId, 'contas', 'principal'), {
      nome: 'Conta principal',
      tipoConta: 'CORRENTE',
      saldoAtual: 0,
      ativo: true,
      criadaPorUsuarioId: usuarioId,
      dataCriacao: now,
    })
    for (const category of defaultCategories) {
      transaction.set(doc(db, 'familias', usuarioId, 'categorias', category.id), {
        nome: category.nome,
        icone: category.icone,
        tipo: category.tipo,
      })
    }
  })
}

export async function criarUsuarioSecundario(
  db: Firestore,
  usuarioId: string,
  email: string,
  nome: string,
  token: string,
): Promise<void> {
  const inviteRef = doc(db, 'convites', token)
  const userRef = doc(db, 'usuarios', usuarioId)

  await runTransaction(db, async (transaction) => {
    const [inviteSnapshot, userSnapshot] = await Promise.all([
      transaction.get(inviteRef),
      transaction.get(userRef),
    ])
    if (userSnapshot.exists()) {
      if (userSnapshot.data().email === email.trim().toLowerCase()) return
      throw new Error('Já existe um perfil para esta conta.')
    }
    if (!inviteSnapshot.exists()) throw new Error('O convite não existe ou já foi removido.')

    const invite = inviteSnapshot.data()
    const normalizedEmail = email.trim().toLowerCase()
    if (invite.emailConvidado !== normalizedEmail) {
      throw new Error('Este convite pertence a outro endereço de e-mail.')
    }
    if (invite.statusConvite !== 'PENDENTE') throw new Error('Este convite já foi utilizado.')
    if (!(invite.dataExpiracao instanceof Timestamp) || invite.dataExpiracao.toMillis() <= Date.now()) {
      throw new Error('Este convite expirou.')
    }

    const now = Timestamp.now()
    transaction.update(inviteRef, {
      statusConvite: 'ACEITO',
      dataAceite: now,
      usuarioAceitoId: usuarioId,
    })
    transaction.set(userRef, {
      nome: nome.trim(),
      email: normalizedEmail,
      papel: 'SECUNDARIO',
      usuarioPaiId: invite.usuarioPrincipalId,
      familiaId: invite.familiaId,
      conviteToken: token,
      dataCriacao: now,
    })
  })
}

export async function criarConvite(
  db: Firestore,
  usuario: Usuario,
  emailConvidado: string,
  token: string,
  dataExpiracao: Date,
): Promise<void> {
  if (usuario.papel !== 'PRINCIPAL') throw new Error('Apenas usuários principais podem convidar.')
  const normalizedEmail = emailConvidado.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Informe o e-mail do convidado.')

  await runTransaction(db, async (transaction) => {
    const profileSnapshot = await transaction.get(doc(db, 'usuarios', usuario.id))
    if (!profileSnapshot.exists() || profileSnapshot.data().papel !== 'PRINCIPAL') {
      throw new Error('Apenas usuários principais podem convidar.')
    }
    transaction.set(doc(db, 'convites', token), {
      token,
      usuarioPrincipalId: usuario.id,
      familiaId: usuario.familiaId,
      emailConvidado: normalizedEmail,
      statusConvite: 'PENDENTE',
      dataCriacao: Timestamp.now(),
      dataExpiracao: Timestamp.fromDate(dataExpiracao),
    })
  })
}

export async function listarContas(db: Firestore, familiaId: string): Promise<Conta[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'contas'), orderBy('nome')))
  return snapshot.docs.map((account) => ({ id: account.id, ...account.data() }) as Conta)
}

export async function listarInstituicoesBancarias(db: Firestore): Promise<InstituicaoBancaria[]> {
  const snapshot = await getDocs(query(collection(db, 'instituicoes_bancarias'), orderBy('nome')))
  return snapshot.docs.map((institution) => ({
    id: institution.id,
    ativo: institution.data().ativo !== false,
    ...institution.data(),
  }) as InstituicaoBancaria)
}

export async function atualizarConta(
  db: Firestore,
  familiaId: string,
  contaId: string,
  conta: Pick<Conta, 'nome' | 'tipoConta' | 'instituicaoId'>,
): Promise<void> {
  await updateDoc(doc(db, 'familias', familiaId, 'contas', contaId), omitUndefined({
    nome: conta.nome.trim(),
    tipoConta: conta.tipoConta,
    instituicaoId: conta.instituicaoId,
  }))
}

export async function arquivarConta(db: Firestore, familiaId: string, contaId: string): Promise<void> {
  await updateDoc(doc(db, 'familias', familiaId, 'contas', contaId), { ativo: false })
}

export async function ativarConta(db: Firestore, familiaId: string, contaId: string): Promise<void> {
  await updateDoc(doc(db, 'familias', familiaId, 'contas', contaId), { ativo: true })
}

export async function criarConta(
  db: Firestore,
  familiaId: string,
  usuarioId: string,
  conta: Omit<Conta, 'id'>,
): Promise<string> {
  const accountData = Object.fromEntries(
    Object.entries({
      ...conta,
      saldoAtual: Number(conta.saldoAtual),
      criadaPorUsuarioId: usuarioId,
      dataCriacao: Timestamp.now(),
    }).filter(([, value]) => value !== undefined),
  )
  const reference = await addDoc(familyCollection(db, familiaId, 'contas'), accountData)
  return reference.id
}

export async function listarCategorias(db: Firestore, familiaId: string): Promise<Categoria[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'categorias'), orderBy('nome')))
  return snapshot.docs.map((category) => ({
    id: category.id,
    ...category.data(),
    ativo: category.data().ativo !== false,
  }) as Categoria)
}

export async function criarCategoria(
  db: Firestore,
  familiaId: string,
  categoria: Omit<Categoria, 'id'>,
): Promise<string> {
  const reference = await addDoc(familyCollection(db, familiaId, 'categorias'), {
    nome: categoria.nome.trim(),
    icone: categoria.icone,
    tipo: categoria.tipo,
    categoriaPaiId: categoria.categoriaPaiId ?? null,
    ativo: true,
  })
  return reference.id
}

export async function atualizarCategoria(
  db: Firestore,
  familiaId: string,
  categoriaId: string,
  categoria: Pick<Categoria, 'nome' | 'icone' | 'tipo' | 'categoriaPaiId'>,
): Promise<void> {
  await updateDoc(doc(db, 'familias', familiaId, 'categorias', categoriaId), {
    nome: categoria.nome.trim(),
    icone: categoria.icone,
    tipo: categoria.tipo,
    categoriaPaiId: categoria.categoriaPaiId ?? null,
  })
}

export async function arquivarCategoria(
  db: Firestore,
  familiaId: string,
  categoriaId: string,
): Promise<void> {
  await updateDoc(doc(db, 'familias', familiaId, 'categorias', categoriaId), { ativo: false })
}

export async function ativarCategoria(
  db: Firestore,
  familiaId: string,
  categoriaId: string,
): Promise<void> {
  await updateDoc(doc(db, 'familias', familiaId, 'categorias', categoriaId), { ativo: true })
}

export async function listarCartoesPlasticos(db: Firestore, familiaId: string): Promise<CartaoPlastico[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'cartoes_plasticos'), orderBy('nomeExibicao')))
  return snapshot.docs.map((card) => mapDatedDocument<CartaoPlastico>(
    card.id,
    card.data(),
    ['dataCriacao'],
  ))
}

export async function criarCartaoPlastico(
  db: Firestore,
  familiaId: string,
  cartao: Omit<CartaoPlastico, 'id' | 'dataCriacao'>,
): Promise<string> {
  assertNonEmpty(cartao.nomeExibicao, 'Nome de exibição')
  const reference = await addDoc(familyCollection(db, familiaId, 'cartoes_plasticos'), omitUndefined({
    ...cartao,
    nomeExibicao: cartao.nomeExibicao.trim(),
    dataCriacao: Timestamp.now(),
  }))
  return reference.id
}

export async function atualizarCartaoPlastico(
  db: Firestore,
  familiaId: string,
  cartaoId: string,
  cartao: Pick<CartaoPlastico, 'contaId' | 'usuarioPortadorId' | 'nomeExibicao' | 'bandeira'>,
): Promise<void> {
  assertNonEmpty(cartao.nomeExibicao, 'Nome de exibição')
  await updateDoc(familyDocument(db, familiaId, 'cartoes_plasticos', cartaoId), omitUndefined({
    ...cartao,
    nomeExibicao: cartao.nomeExibicao.trim(),
  }))
}

export async function arquivarCartaoPlastico(db: Firestore, familiaId: string, cartaoId: string): Promise<void> {
  await updateDoc(familyDocument(db, familiaId, 'cartoes_plasticos', cartaoId), { ativo: false })
}

export async function listarOrcamentosMetas(db: Firestore, familiaId: string): Promise<OrcamentoMeta[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'orcamentos_metas'), orderBy('mesAno', 'desc')))
  return snapshot.docs.map((budget) => mapDatedDocument<OrcamentoMeta>(
    budget.id,
    budget.data(),
    ['dataCriacao'],
  ))
}

export async function criarOrcamentoMeta(
  db: Firestore,
  familiaId: string,
  orcamento: Omit<OrcamentoMeta, 'id' | 'dataCriacao'>,
): Promise<string> {
  assertPositive(orcamento.valorTeto, 'O teto do orçamento')
  assertMonth(orcamento.mesAno)
  const reference = await addDoc(familyCollection(db, familiaId, 'orcamentos_metas'), {
    ...orcamento,
    dataCriacao: Timestamp.now(),
  })
  return reference.id
}

export async function atualizarOrcamentoMeta(
  db: Firestore,
  familiaId: string,
  orcamentoId: string,
  orcamento: Pick<OrcamentoMeta, 'usuarioId' | 'categoriaId' | 'valorTeto' | 'mesAno'>,
): Promise<void> {
  assertPositive(orcamento.valorTeto, 'O teto do orçamento')
  assertMonth(orcamento.mesAno)
  await updateDoc(familyDocument(db, familiaId, 'orcamentos_metas', orcamentoId), orcamento)
}

export async function arquivarOrcamentoMeta(db: Firestore, familiaId: string, orcamentoId: string): Promise<void> {
  await updateDoc(familyDocument(db, familiaId, 'orcamentos_metas', orcamentoId), { ativo: false })
}

export async function listarParcelamentos(db: Firestore, familiaId: string): Promise<Parcelamento[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'parcelamentos'), orderBy('dataInicio', 'desc')))
  return snapshot.docs.map((plan) => mapDatedDocument<Parcelamento>(plan.id, plan.data(), ['dataInicio', 'dataCriacao']))
}

export async function criarParcelamento(
  db: Firestore,
  familiaId: string,
  parcelamento: Omit<Parcelamento, 'id' | 'dataCriacao'>,
): Promise<string> {
  assertNonEmpty(parcelamento.descricao, 'Descrição')
  assertPositive(parcelamento.valorTotal, 'O valor total')
  if (!Number.isInteger(parcelamento.totalParcelas) || parcelamento.totalParcelas < 1) {
    throw new Error('O número de parcelas deve ser um inteiro positivo.')
  }
  const reference = await addDoc(familyCollection(db, familiaId, 'parcelamentos'), omitUndefined({
    ...parcelamento,
    descricao: parcelamento.descricao.trim(),
    dataInicio: Timestamp.fromDate(parcelamento.dataInicio),
    dataCriacao: Timestamp.now(),
  }))
  return reference.id
}

export async function atualizarParcelamento(
  db: Firestore,
  familiaId: string,
  parcelamentoId: string,
  parcelamento: Pick<Parcelamento, 'descricao' | 'valorTotal' | 'totalParcelas' | 'dataInicio' | 'contaId' | 'categoriaId' | 'tipoMovimentacao' | 'cartaoPlasticoId'>,
): Promise<void> {
  assertNonEmpty(parcelamento.descricao, 'Descrição')
  assertPositive(parcelamento.valorTotal, 'O valor total')
  if (!Number.isInteger(parcelamento.totalParcelas) || parcelamento.totalParcelas < 1) {
    throw new Error('O número de parcelas deve ser um inteiro positivo.')
  }
  await updateDoc(familyDocument(db, familiaId, 'parcelamentos', parcelamentoId), omitUndefined({
    ...parcelamento,
    descricao: parcelamento.descricao.trim(),
    dataInicio: Timestamp.fromDate(parcelamento.dataInicio),
  }))
}

export async function arquivarParcelamento(db: Firestore, familiaId: string, parcelamentoId: string): Promise<void> {
  await updateDoc(familyDocument(db, familiaId, 'parcelamentos', parcelamentoId), { ativo: false })
}

export async function listarRecorrencias(db: Firestore, familiaId: string): Promise<Recorrencia[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'recorrencias'), orderBy('diaVencimento')))
  return snapshot.docs.map((recurrence) => mapDatedDocument<Recorrencia>(
    recurrence.id,
    recurrence.data(),
    ['dataProximaExecucao', 'dataFim', 'dataCriacao'],
  ))
}

export async function criarRecorrencia(
  db: Firestore,
  familiaId: string,
  recorrencia: Omit<Recorrencia, 'id' | 'dataCriacao'>,
): Promise<string> {
  assertNonEmpty(recorrencia.descricao, 'Descrição')
  assertPositive(recorrencia.valorEstimado, 'O valor estimado')
  if (!Number.isInteger(recorrencia.diaVencimento) || recorrencia.diaVencimento < 1 || recorrencia.diaVencimento > 31) {
    throw new Error('O dia de vencimento deve estar entre 1 e 31.')
  }
  const reference = await addDoc(familyCollection(db, familiaId, 'recorrencias'), {
    ...recorrencia,
    descricao: recorrencia.descricao.trim(),
    dataProximaExecucao: optionalTimestamp(recorrencia.dataProximaExecucao),
    dataFim: optionalTimestamp(recorrencia.dataFim),
    dataCriacao: Timestamp.now(),
  })
  return reference.id
}

export async function atualizarRecorrencia(
  db: Firestore,
  familiaId: string,
  recorrenciaId: string,
  recorrencia: Pick<Recorrencia, 'descricao' | 'valorEstimado' | 'diaVencimento' | 'dataProximaExecucao' | 'dataFim' | 'contaId' | 'categoriaId' | 'tipoMovimentacao'>,
): Promise<void> {
  assertNonEmpty(recorrencia.descricao, 'Descrição')
  assertPositive(recorrencia.valorEstimado, 'O valor estimado')
  if (!Number.isInteger(recorrencia.diaVencimento) || recorrencia.diaVencimento < 1 || recorrencia.diaVencimento > 31) {
    throw new Error('O dia de vencimento deve estar entre 1 e 31.')
  }
  await updateDoc(familyDocument(db, familiaId, 'recorrencias', recorrenciaId), {
    ...recorrencia,
    descricao: recorrencia.descricao.trim(),
    dataProximaExecucao: optionalTimestamp(recorrencia.dataProximaExecucao),
    dataFim: optionalTimestamp(recorrencia.dataFim),
  })
}

export async function arquivarRecorrencia(db: Firestore, familiaId: string, recorrenciaId: string): Promise<void> {
  await updateDoc(familyDocument(db, familiaId, 'recorrencias', recorrenciaId), { ativo: false })
}

export async function listarFaturasCartao(db: Firestore, familiaId: string): Promise<FaturaCartao[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'faturas_cartao'), orderBy('mesReferencia', 'desc')))
  return snapshot.docs.map((invoice) => mapDatedDocument<FaturaCartao>(
    invoice.id,
    invoice.data(),
    ['dataCriacao'],
  ))
}

export async function criarFaturaCartao(
  db: Firestore,
  familiaId: string,
  fatura: Omit<FaturaCartao, 'id' | 'dataCriacao' | 'valorTotal' | 'valorPago' | 'status'>,
): Promise<string> {
  assertMonth(fatura.mesReferencia)
  const reference = await addDoc(familyCollection(db, familiaId, 'faturas_cartao'), {
    ...fatura,
    valorTotal: 0,
    valorPago: 0,
    status: 'ABERTA',
    dataCriacao: Timestamp.now(),
  })
  return reference.id
}

export async function atualizarFaturaCartao(
  db: Firestore,
  familiaId: string,
  faturaId: string,
  fatura: Pick<FaturaCartao, 'valorTotal' | 'valorPago' | 'status'>,
): Promise<void> {
  if (!Number.isFinite(fatura.valorTotal) || fatura.valorTotal < 0
    || !Number.isFinite(fatura.valorPago) || fatura.valorPago < 0
    || fatura.valorPago > fatura.valorTotal) {
    throw new Error('Os valores da fatura são inválidos.')
  }
  await updateDoc(familyDocument(db, familiaId, 'faturas_cartao', faturaId), fatura)
}

export async function listarLogsAtividade(db: Firestore, familiaId: string): Promise<LogAtividade[]> {
  const snapshot = await getDocs(query(familyCollection(db, familiaId, 'logs_atividades'), orderBy('dataAcao', 'desc')))
  return snapshot.docs.map((log) => mapDatedDocument<LogAtividade>(log.id, log.data(), ['dataAcao']))
}

export async function obterExtrato(db: Firestore, familiaId: string): Promise<Transacao[]> {
  const snapshot = await getDocs(query(
    familyCollection(db, familiaId, 'transacoes'),
    orderBy('dataTransacao', 'desc'),
  ))
  return snapshot.docs.map((transaction) => mapTransaction(transaction.id, transaction.data()))
}

export async function cadastrarTransacao(
  db: Firestore,
  familiaId: string,
  transacao: Omit<Transacao, 'id' | 'contaId'> & { contaId: string },
): Promise<string> {
  assertPositiveAmount(transacao.valor)
  if (transacao.tipoMovimentacao === 'TRANSFERENCIA') {
    throw new Error('Use cadastrarTransferencia para movimentações entre contas.')
  }
  if (transacao.estornado) throw new Error('Não é possível criar uma movimentação já estornada.')

  const accountRef = doc(db, 'familias', familiaId, 'contas', transacao.contaId)
  const transactionRef = doc(familyCollection(db, familiaId, 'transacoes'))
  const logRef = doc(familyCollection(db, familiaId, 'logs_atividades'))
  const now = Timestamp.now()

  await runTransaction(db, async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef)
    if (!accountSnapshot.exists()) throw new Error('A conta selecionada não existe.')

    if (transacao.status === 'EFETIVADO') {
      const balance = Number(accountSnapshot.data().saldoAtual)
      if (!Number.isFinite(balance)) throw new Error('O saldo atual da conta é inválido.')
      transaction.update(accountRef, {
        saldoAtual: balance + balanceDelta(transacao.tipoMovimentacao, transacao.valor),
        ultimaMovimentacaoId: transactionRef.id,
      })
    }

    const transactionData = Object.fromEntries(
      Object.entries({
        ...transacao,
        dataTransacao: Timestamp.fromDate(transacao.dataTransacao),
        dataCriacao: now,
        dataAtualizacao: now,
      }).filter(([, value]) => value !== undefined),
    )
    transaction.set(transactionRef, transactionData)
    transaction.set(logRef, {
      transacaoId: transactionRef.id,
      usuarioId: transacao.criadoPorUsuarioId,
      acao: 'CRIAR',
      dataAcao: now,
      descricaoSnapshot: transacao.descricao,
      valoresNovos: { valor: transacao.valor, status: transacao.status },
    })
  })

  return transactionRef.id
}

export async function cadastrarTransferencia(
  db: Firestore,
  familiaId: string,
  input: {
    contaOrigemId: string
    contaDestinoId: string
    descricao: string
    valor: number
    dataTransacao: Date
    status: StatusTransacao
    criadoPorUsuarioId: string
    criadoPorNome: string
    categoriaId: string
  },
): Promise<string> {
  assertPositiveAmount(input.valor)
  if (input.contaOrigemId === input.contaDestinoId) {
    throw new Error('A conta de origem e destino devem ser diferentes.')
  }

  const originRef = doc(db, 'familias', familiaId, 'contas', input.contaOrigemId)
  const destinationRef = doc(db, 'familias', familiaId, 'contas', input.contaDestinoId)
  const transferRef = doc(familyCollection(db, familiaId, 'transferencias'))
  const originTransactionRef = doc(familyCollection(db, familiaId, 'transacoes'))
  const destinationTransactionRef = doc(familyCollection(db, familiaId, 'transacoes'))
  const logRef = doc(familyCollection(db, familiaId, 'logs_atividades'))
  const now = Timestamp.now()

  await runTransaction(db, async (transaction) => {
    const [originSnapshot, destinationSnapshot] = await Promise.all([
      transaction.get(originRef),
      transaction.get(destinationRef),
    ])
    if (!originSnapshot.exists() || !destinationSnapshot.exists()) {
      throw new Error('Uma das contas selecionadas não existe.')
    }

    if (input.status === 'EFETIVADO') {
      const originBalance = Number(originSnapshot.data().saldoAtual)
      const destinationBalance = Number(destinationSnapshot.data().saldoAtual)
      if (!Number.isFinite(originBalance) || !Number.isFinite(destinationBalance)) {
        throw new Error('O saldo atual de uma das contas é inválido.')
      }
      if (originBalance < input.valor) throw new Error('A conta de origem não tem saldo suficiente.')
      transaction.update(originRef, {
        saldoAtual: originBalance - input.valor,
        ultimaMovimentacaoId: originTransactionRef.id,
      })
      transaction.update(destinationRef, {
        saldoAtual: destinationBalance + input.valor,
        ultimaMovimentacaoId: destinationTransactionRef.id,
      })
    }

    transaction.set(transferRef, {
      contaOrigemId: input.contaOrigemId,
      contaDestinoId: input.contaDestinoId,
      transacaoOrigemId: originTransactionRef.id,
      transacaoDestinoId: destinationTransactionRef.id,
      status: input.status,
      valor: input.valor,
      dataTransacao: Timestamp.fromDate(input.dataTransacao),
      criadoPorUsuarioId: input.criadoPorUsuarioId,
      dataCriacao: now,
    })
    const sharedData = {
      descricao: input.descricao,
      valor: input.valor,
      tipoMovimentacao: 'TRANSFERENCIA',
      status: input.status,
      categoriaId: input.categoriaId,
      categoriaNome: 'Transferência',
      criadoPorUsuarioId: input.criadoPorUsuarioId,
      criadoPorNome: input.criadoPorNome,
      transferenciaId: transferRef.id,
      dataTransacao: Timestamp.fromDate(input.dataTransacao),
      dataCriacao: now,
      dataAtualizacao: now,
      estornado: false,
    }
    transaction.set(originTransactionRef, {
      ...sharedData,
      contaId: input.contaOrigemId,
      contaDestinoId: input.contaDestinoId,
      direcaoTransferencia: 'SAIDA',
    })
    transaction.set(destinationTransactionRef, {
      ...sharedData,
      contaId: input.contaDestinoId,
      contaDestinoId: input.contaOrigemId,
      direcaoTransferencia: 'ENTRADA',
    })
    transaction.set(logRef, {
      transacaoId: transferRef.id,
      usuarioId: input.criadoPorUsuarioId,
      acao: 'CRIAR_TRANSFERENCIA',
      dataAcao: now,
      descricaoSnapshot: input.descricao,
      valoresAntigos: {},
      valoresNovos: { valor: input.valor, status: input.status },
    })
  })

  return transferRef.id
}

export async function efetivarTransacaoPendente(
  db: Firestore,
  familiaId: string,
  transacaoId: string,
  usuarioId: string,
): Promise<void> {
  const transactionRef = doc(db, 'familias', familiaId, 'transacoes', transacaoId)
  const logRef = doc(familyCollection(db, familiaId, 'logs_atividades'))
  const now = Timestamp.now()

  await runTransaction(db, async (transaction) => {
    const transactionSnapshot = await transaction.get(transactionRef)
    if (!transactionSnapshot.exists()) throw new Error('A movimentação não existe.')
    const data = transactionSnapshot.data()
    if (data.status !== 'PENDENTE') {
      if (data.status === 'EFETIVADO') throw new Error('A movimentação já foi processada.')
      throw new Error('A movimentação não está pendente.')
    }
    if (data.estornado) throw new Error('Uma movimentação estornada não pode ser efetivada.')

    if (data.tipoMovimentacao === 'TRANSFERENCIA') {
      const transferRef = doc(db, 'familias', familiaId, 'transferencias', data.transferenciaId)
      const transferSnapshot = await transaction.get(transferRef)
      if (!transferSnapshot.exists()) throw new Error('Os dados da transferência não existem.')
      const transfer = transferSnapshot.data()
      if (transfer.status !== 'PENDENTE') throw new Error('A transferência já foi processada.')

      const originTransactionRef = doc(db, 'familias', familiaId, 'transacoes', transfer.transacaoOrigemId)
      const destinationTransactionRef = doc(db, 'familias', familiaId, 'transacoes', transfer.transacaoDestinoId)
      const originAccountRef = doc(db, 'familias', familiaId, 'contas', transfer.contaOrigemId)
      const destinationAccountRef = doc(db, 'familias', familiaId, 'contas', transfer.contaDestinoId)
      const [originTransaction, destinationTransaction, originAccount, destinationAccount] = await Promise.all([
        transaction.get(originTransactionRef),
        transaction.get(destinationTransactionRef),
        transaction.get(originAccountRef),
        transaction.get(destinationAccountRef),
      ])
      if (!originTransaction.exists() || !destinationTransaction.exists()
        || !originAccount.exists() || !destinationAccount.exists()) {
        throw new Error('Os dados da transferência estão incompletos.')
      }
      const amount = Number(transfer.valor)
      const originBalance = Number(originAccount.data().saldoAtual)
      const destinationBalance = Number(destinationAccount.data().saldoAtual)
      if (!Number.isFinite(amount) || !Number.isFinite(originBalance) || !Number.isFinite(destinationBalance)) {
        throw new Error('O valor ou o saldo da transferência é inválido.')
      }
      if (originBalance < amount) throw new Error('A conta de origem não tem saldo suficiente para efetivar a transferência.')

      transaction.update(originAccountRef, {
        saldoAtual: originBalance - amount,
        ultimaMovimentacaoId: transfer.transacaoOrigemId,
      })
      transaction.update(destinationAccountRef, {
        saldoAtual: destinationBalance + amount,
        ultimaMovimentacaoId: transfer.transacaoDestinoId,
      })
      transaction.update(originTransactionRef, {
        status: 'EFETIVADO',
        dataAtualizacao: now,
        atualizadoPorUsuarioId: usuarioId,
      })
      transaction.update(destinationTransactionRef, {
        status: 'EFETIVADO',
        dataAtualizacao: now,
        atualizadoPorUsuarioId: usuarioId,
      })
      transaction.update(transferRef, { status: 'EFETIVADO', dataAtualizacao: now })
    } else {
      if (typeof data.contaId !== 'string' || !data.contaId) {
        throw new Error('A movimentação não possui uma conta associada.')
      }
      const accountRef = doc(db, 'familias', familiaId, 'contas', data.contaId)
      const accountSnapshot = await transaction.get(accountRef)
      if (!accountSnapshot.exists()) throw new Error('A conta da movimentação não existe.')
      const balance = Number(accountSnapshot.data().saldoAtual)
      const amount = Number(data.valor)
      if (!Number.isFinite(balance) || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('O valor ou o saldo da movimentação é inválido.')
      }
      transaction.update(accountRef, {
        saldoAtual: balance + balanceDelta(data.tipoMovimentacao as TipoMovimentacao, amount),
        ultimaMovimentacaoId: transactionRef.id,
      })
      transaction.update(transactionRef, {
        status: 'EFETIVADO',
        dataAtualizacao: now,
        atualizadoPorUsuarioId: usuarioId,
      })
    }

    transaction.set(logRef, {
      transacaoId,
      usuarioId,
      acao: 'EFETIVAR',
      dataAcao: now,
      descricaoSnapshot: data.descricao,
    })
  })
}

type TransactionEdit = {
  descricao: string
  valor: number
  tipoMovimentacao: 'RECEITA' | 'DESPESA'
  status: StatusTransacao
  dataTransacao: Date
  contaId: string
  categoriaId: string
  categoriaNome: string
}

type TransferEdit = {
  descricao: string
  valor: number
  status: StatusTransacao
  dataTransacao: Date
  contaOrigemId: string
  contaDestinoId: string
}

function movementEffect(tipo: TipoMovimentacao, status: StatusTransacao, valor: number, estornado: boolean) {
  if (status !== 'EFETIVADO' || estornado) return 0
  return balanceDelta(tipo, valor)
}

function transferEffect(
  accountId: string,
  transfer: Record<string, unknown>,
) {
  if (transfer.status !== 'EFETIVADO' || transfer.estornado === true) return 0
  const originId = transfer.contaOrigemId
  const destinationId = transfer.contaDestinoId
  const amount = Number(transfer.valor)
  if (typeof originId !== 'string' || typeof destinationId !== 'string' || !Number.isFinite(amount)) {
    throw new Error('Os dados da transferência são inválidos.')
  }
  if (accountId === originId) return -amount
  if (accountId === destinationId) return amount
  return 0
}

export async function atualizarTransacao(
  db: Firestore,
  familiaId: string,
  transacaoId: string,
  usuarioId: string,
  input: TransactionEdit | TransferEdit,
): Promise<void> {
  if (!input.descricao.trim()) throw new Error('Informe uma descrição.')
  assertPositiveAmount(input.valor)
  const transactionRef = doc(db, 'familias', familiaId, 'transacoes', transacaoId)
  const logRef = doc(familyCollection(db, familiaId, 'logs_atividades'))
  const now = Timestamp.now()

  await runTransaction(db, async (transaction) => {
    const movementSnapshot = await transaction.get(transactionRef)
    if (!movementSnapshot.exists()) throw new Error('A movimentação não existe.')
    const movement = movementSnapshot.data()
    if (movement.estornado) throw new Error('Uma movimentação estornada não pode ser editada.')

    if (movement.tipoMovimentacao === 'TRANSFERENCIA') {
      if (!('contaOrigemId' in input)) throw new Error('Edite os dados da transferência como uma única operação.')
      if (input.contaOrigemId === input.contaDestinoId) {
        throw new Error('A conta de origem e destino devem ser diferentes.')
      }
      if (!movement.transferenciaId) throw new Error('A transferência vinculada está incompleta.')

      const transferRef = doc(db, 'familias', familiaId, 'transferencias', movement.transferenciaId)
      const transferSnapshot = await transaction.get(transferRef)
      if (!transferSnapshot.exists()) throw new Error('Os dados da transferência não existem.')
      const transfer = transferSnapshot.data()
      if (transfer.estornado) throw new Error('Uma transferência estornada não pode ser editada.')

      const originRef = doc(db, 'familias', familiaId, 'transacoes', transfer.transacaoOrigemId)
      const destinationRef = doc(db, 'familias', familiaId, 'transacoes', transfer.transacaoDestinoId)
      const [originSnapshot, destinationSnapshot] = await Promise.all([
        transaction.get(originRef),
        transaction.get(destinationRef),
      ])
      if (!originSnapshot.exists() || !destinationSnapshot.exists()) {
        throw new Error('Os dados da transferência estão incompletos.')
      }

      const accountIds = [...new Set([
        transfer.contaOrigemId,
        transfer.contaDestinoId,
        input.contaOrigemId,
        input.contaDestinoId,
      ])]
      const accountRefs = accountIds.map((id) => doc(db, 'familias', familiaId, 'contas', id))
      const accountSnapshots = await Promise.all(accountRefs.map((reference) => transaction.get(reference)))
      if (accountSnapshots.some((snapshot) => !snapshot.exists())) throw new Error('Uma conta selecionada não existe.')

      const newTransfer = {
        contaOrigemId: input.contaOrigemId,
        contaDestinoId: input.contaDestinoId,
        valor: input.valor,
        status: input.status,
        estornado: false,
      }
      accountRefs.forEach((reference, index) => {
        const accountId = accountIds[index]
        const account = accountSnapshots[index]?.data()
        const oldEffect = transferEffect(accountId, transfer)
        const newEffect = transferEffect(accountId, newTransfer)
        const balance = Number(account?.saldoAtual)
        if (!Number.isFinite(balance)) throw new Error('O saldo atual de uma conta é inválido.')
        if (oldEffect !== newEffect) {
          const nextBalance = balance + newEffect - oldEffect
          if (nextBalance < 0 && newEffect < oldEffect) {
            throw new Error('A conta de origem não tem saldo suficiente para esta alteração.')
          }
          transaction.update(reference, {
            saldoAtual: nextBalance,
            ultimaMovimentacaoId: accountId === input.contaOrigemId
              ? transfer.transacaoOrigemId
              : accountId === input.contaDestinoId
                ? transfer.transacaoDestinoId
                : accountId === transfer.contaOrigemId
                  ? transfer.transacaoOrigemId
                  : transfer.transacaoDestinoId,
          })
        }
      })

      const sharedMovementUpdate = {
        descricao: input.descricao.trim(),
        valor: input.valor,
        status: input.status,
        dataTransacao: Timestamp.fromDate(input.dataTransacao),
        dataAtualizacao: now,
        atualizadoPorUsuarioId: usuarioId,
      }
      transaction.update(originRef, {
        ...sharedMovementUpdate,
        contaId: input.contaOrigemId,
        contaDestinoId: input.contaDestinoId,
      })
      transaction.update(destinationRef, {
        ...sharedMovementUpdate,
        contaId: input.contaDestinoId,
        contaDestinoId: input.contaOrigemId,
      })
      transaction.update(transferRef, {
        contaOrigemId: input.contaOrigemId,
        contaDestinoId: input.contaDestinoId,
        valor: input.valor,
        status: input.status,
        dataTransacao: Timestamp.fromDate(input.dataTransacao),
        dataAtualizacao: now,
        estornado: false,
      })
      transaction.set(logRef, {
        transacaoId: movement.transferenciaId,
        usuarioId,
        acao: 'EDITAR_TRANSFERENCIA',
        dataAcao: now,
        descricaoSnapshot: input.descricao.trim(),
        valoresAntigos: {
          descricao: movement.descricao,
          valor: transfer.valor,
          status: transfer.status,
          dataTransacao: transfer.dataTransacao,
          contaOrigemId: transfer.contaOrigemId,
          contaDestinoId: transfer.contaDestinoId,
        },
        valoresNovos: { valor: input.valor, status: input.status },
      })
      return
    }

    if (!('contaId' in input)) throw new Error('Informe uma conta para a movimentação.')
    const oldAccountId = movement.contaId
    if (typeof oldAccountId !== 'string' || !oldAccountId) throw new Error('A movimentação não possui uma conta válida.')
    const accountIds = [...new Set([oldAccountId, input.contaId])]
    const accountRefs = accountIds.map((id) => doc(db, 'familias', familiaId, 'contas', id))
    const accountSnapshots = await Promise.all(accountRefs.map((reference) => transaction.get(reference)))
    if (accountSnapshots.some((snapshot) => !snapshot.exists())) throw new Error('Uma conta selecionada não existe.')
    const oldEffect = movementEffect(
      movement.tipoMovimentacao as TipoMovimentacao,
      movement.status as StatusTransacao,
      Number(movement.valor),
      movement.estornado === true,
    )
    const newEffect = movementEffect(input.tipoMovimentacao, input.status, input.valor, false)

    accountRefs.forEach((reference, index) => {
      const account = accountSnapshots[index].data()
      const accountId = accountIds[index]
      const accountOldEffect = accountId === oldAccountId ? oldEffect : 0
      const accountNewEffect = accountId === input.contaId ? newEffect : 0
      const balance = Number(account?.saldoAtual)
      if (!Number.isFinite(balance)) throw new Error('O saldo atual da conta é inválido.')
      if (accountOldEffect !== accountNewEffect) {
        transaction.update(reference, {
          saldoAtual: balance + accountNewEffect - accountOldEffect,
          ultimaMovimentacaoId: transacaoId,
        })
      }
    })

    transaction.update(transactionRef, {
      descricao: input.descricao.trim(),
      valor: input.valor,
      tipoMovimentacao: input.tipoMovimentacao,
      status: input.status,
      dataTransacao: Timestamp.fromDate(input.dataTransacao),
      contaId: input.contaId,
      categoriaId: input.categoriaId,
      categoriaNome: input.categoriaNome,
      dataAtualizacao: now,
      atualizadoPorUsuarioId: usuarioId,
    })
    transaction.set(logRef, {
      transacaoId,
      usuarioId,
      acao: 'EDITAR',
      dataAcao: now,
      descricaoSnapshot: input.descricao.trim(),
      valoresAntigos: {
        descricao: movement.descricao,
        valor: movement.valor,
        tipoMovimentacao: movement.tipoMovimentacao,
        status: movement.status,
        dataTransacao: movement.dataTransacao,
        contaId: movement.contaId,
        categoriaId: movement.categoriaId,
        categoriaNome: movement.categoriaNome,
      },
      valoresNovos: { valor: input.valor, status: input.status },
    })
  })
}

export async function estornarTransacao(
  db: Firestore,
  familiaId: string,
  transacaoId: string,
  usuarioId: string,
): Promise<void> {
  const transactionRef = doc(db, 'familias', familiaId, 'transacoes', transacaoId)
  const logRef = doc(familyCollection(db, familiaId, 'logs_atividades'))
  const now = Timestamp.now()

  await runTransaction(db, async (transaction) => {
    const movementSnapshot = await transaction.get(transactionRef)
    if (!movementSnapshot.exists()) throw new Error('A movimentação não existe.')
    const movement = movementSnapshot.data()
    if (movement.estornado) throw new Error('A movimentação já foi estornada.')

    if (movement.tipoMovimentacao === 'TRANSFERENCIA') {
      if (!movement.transferenciaId) throw new Error('A transferência vinculada está incompleta.')
      const transferRef = doc(db, 'familias', familiaId, 'transferencias', movement.transferenciaId)
      const transferSnapshot = await transaction.get(transferRef)
      if (!transferSnapshot.exists()) throw new Error('Os dados da transferência não existem.')
      const transfer = transferSnapshot.data()
      const originRef = doc(db, 'familias', familiaId, 'transacoes', transfer.transacaoOrigemId)
      const destinationRef = doc(db, 'familias', familiaId, 'transacoes', transfer.transacaoDestinoId)
      const accountIds = [...new Set([transfer.contaOrigemId, transfer.contaDestinoId])]
      const accountRefs = accountIds.map((id) => doc(db, 'familias', familiaId, 'contas', id))
      const [originSnapshot, destinationSnapshot, ...accountSnapshots] = await Promise.all([
        transaction.get(originRef),
        transaction.get(destinationRef),
        ...accountRefs.map((reference) => transaction.get(reference)),
      ])
      if (!originSnapshot.exists() || !destinationSnapshot.exists()
        || accountSnapshots.some((snapshot) => !snapshot.exists())) {
        throw new Error('Os dados da transferência estão incompletos.')
      }

      accountRefs.forEach((reference, index) => {
        const balance = Number(accountSnapshots[index]?.data()?.saldoAtual)
        if (!Number.isFinite(balance)) throw new Error('O saldo atual de uma conta é inválido.')
        const effect = transferEffect(accountIds[index], transfer)
        if (effect !== 0) {
          transaction.update(reference, {
            saldoAtual: balance - effect,
            ultimaMovimentacaoId: accountIds[index] === transfer.contaOrigemId
              ? transfer.transacaoOrigemId
              : transfer.transacaoDestinoId,
          })
        }
      })

      transaction.update(originRef, { estornado: true, dataAtualizacao: now, atualizadoPorUsuarioId: usuarioId })
      transaction.update(destinationRef, { estornado: true, dataAtualizacao: now, atualizadoPorUsuarioId: usuarioId })
      transaction.update(transferRef, { estornado: true, dataAtualizacao: now })
      transaction.set(logRef, {
        transacaoId: movement.transferenciaId,
        usuarioId,
        acao: 'ESTORNAR_TRANSFERENCIA',
        dataAcao: now,
        descricaoSnapshot: movement.descricao,
        valoresAntigos: {
          valor: transfer.valor,
          status: transfer.status,
          contaOrigemId: transfer.contaOrigemId,
          contaDestinoId: transfer.contaDestinoId,
        },
        valoresNovos: { estornado: true },
      })
      return
    }

    const accountId = movement.contaId
    if (typeof accountId !== 'string' || !accountId) throw new Error('A movimentação não possui uma conta válida.')
    const accountRef = doc(db, 'familias', familiaId, 'contas', accountId)
    const accountSnapshot = await transaction.get(accountRef)
    if (!accountSnapshot.exists()) throw new Error('A conta da movimentação não existe.')

    const effect = movementEffect(
      movement.tipoMovimentacao as TipoMovimentacao,
      movement.status as StatusTransacao,
      Number(movement.valor),
      false,
    )
    if (effect !== 0) {
      const balance = Number(accountSnapshot.data().saldoAtual)
      if (!Number.isFinite(balance)) throw new Error('O saldo atual da conta é inválido.')
      transaction.update(accountRef, { saldoAtual: balance - effect, ultimaMovimentacaoId: transacaoId })
    }
    transaction.update(transactionRef, {
      estornado: true,
      dataAtualizacao: now,
      atualizadoPorUsuarioId: usuarioId,
    })
    transaction.set(logRef, {
      transacaoId,
      usuarioId,
      acao: 'ESTORNAR',
      dataAcao: now,
      descricaoSnapshot: movement.descricao,
      valoresAntigos: {
        valor: movement.valor,
        status: movement.status,
        estornado: movement.estornado,
      },
      valoresNovos: { estornado: true },
    })
  })
}
