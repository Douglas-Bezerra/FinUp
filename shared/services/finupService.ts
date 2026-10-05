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
} from 'firebase/firestore'
import type {
  Categoria,
  Conta,
  PapelUsuario,
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

    const familyRef = doc(db, 'familias', invite.familiaId)
    if (!(await transaction.get(familyRef)).exists()) {
      throw new Error('A família associada ao convite não existe.')
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
  return snapshot.docs.map((category) => ({ id: category.id, ...category.data() }) as Categoria)
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
    if (data.status !== 'PENDENTE') throw new Error('A movimentação não está pendente.')
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
