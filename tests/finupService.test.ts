// tests/finupService.test.ts
// Arquivo
//==================================================

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { resolve } from 'node:path'
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'
import {
  cadastrarTransacao,
  cadastrarTransferencia,
  arquivarConta,
  arquivarCartaoPlastico,
  arquivarInstituicaoBancaria,
  arquivarOrcamentoMeta,
  arquivarParcelamento,
  arquivarRecorrencia,
  atualizarCartaoPlastico,
  atualizarFaturaCartao,
  atualizarInstituicaoBancaria,
  atualizarConta,
  atualizarOrcamentoMeta,
  atualizarParcelamento,
  atualizarRecorrencia,
  criarCartaoPlastico,
  criarConta,
  criarCategoria,
  criarConvite,
  criarFaturaCartao,
  criarInstituicaoBancaria,
  criarOrcamentoMeta,
  criarParcelamento,
  criarRecorrencia,
  criarUsuarioPrincipal,
  criarUsuarioSecundario,
  efetivarTransacaoPendente,
  ativarInstituicaoBancaria,
  listarContas,
  listarCartoesPlasticos,
  listarFaturasCartao,
  listarInstituicoesBancarias,
  listarOrcamentosMetas,
  listarParcelamentos,
  listarRecorrencias,
  obterExtrato,
  obterUsuario,
} from '../shared/services/finupService'

let environment: RulesTestEnvironment

function getTestFirestore(context: RulesTestContext): Firestore {
  // The testing package returns the compat Firestore type, though its context supports modular APIs.
  return context.firestore() as unknown as Firestore
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-finup',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  })
})

after(async () => {
  if (environment) await environment.cleanup()
})

test('profile registration, pending entries and transfers update Firestore atomically', async () => {
  const principalDb = getTestFirestore(environment.authenticatedContext('principal-1', {
    email: 'principal@finup.test',
  }))
  await criarUsuarioPrincipal(principalDb, 'principal-1', 'principal@finup.test', 'Pessoa Principal')

  const initialAccounts = await listarContas(principalDb, 'principal-1')
  assert.equal(initialAccounts.length, 1)
  assert.equal(initialAccounts[0].saldoAtual, 0)
  await assert.rejects(
    updateDoc(doc(principalDb, 'familias', 'principal-1', 'contas', initialAccounts[0].id), {
      saldoAtual: 500,
    }),
  )

  await cadastrarTransacao(principalDb, 'principal-1', {
    descricao: 'Saldo inicial',
    valor: 50,
    tipoMovimentacao: 'RECEITA',
    status: 'EFETIVADO',
    dataTransacao: new Date('2026-09-30T12:00:00.000Z'),
    contaId: initialAccounts[0].id,
    categoriaId: '10000000-0000-4000-8000-000000000001',
    categoriaNome: 'Salário',
    criadoPorUsuarioId: 'principal-1',
    criadoPorNome: 'Pessoa Principal',
    estornado: false,
  })

  const pendingExpenseId = await cadastrarTransacao(principalDb, 'principal-1', {
    descricao: 'Conta de luz',
    valor: 25,
    tipoMovimentacao: 'DESPESA',
    status: 'PENDENTE',
    dataTransacao: new Date('2026-10-01T12:00:00.000Z'),
    contaId: initialAccounts[0].id,
    categoriaId: '20000000-0000-4000-8000-000000000003',
    categoriaNome: 'Moradia',
    criadoPorUsuarioId: 'principal-1',
    criadoPorNome: 'Pessoa Principal',
    estornado: false,
  })
  let accounts = await listarContas(principalDb, 'principal-1')
  assert.equal(accounts[0].saldoAtual, 50, 'pending expenses must not change the balance')

  await efetivarTransacaoPendente(principalDb, 'principal-1', pendingExpenseId, 'principal-1')
  accounts = await listarContas(principalDb, 'principal-1')
  assert.equal(accounts[0].saldoAtual, 25)

  const destinationAccountId = await criarConta(principalDb, 'principal-1', 'principal-1', {
    nome: 'Poupança',
    tipoConta: 'POUPANCA',
    saldoAtual: 100,
    ativo: true,
  })
  await cadastrarTransferencia(principalDb, 'principal-1', {
    contaOrigemId: initialAccounts[0].id,
    contaDestinoId: destinationAccountId,
    descricao: 'Reserva mensal',
    valor: 10,
    dataTransacao: new Date('2026-10-02T12:00:00.000Z'),
    status: 'EFETIVADO',
    criadoPorUsuarioId: 'principal-1',
    criadoPorNome: 'Pessoa Principal',
    categoriaId: '30000000-0000-4000-8000-000000000001',
  })
  accounts = await listarContas(principalDb, 'principal-1')
  assert.equal(accounts.find((item) => item.id === initialAccounts[0].id)?.saldoAtual, 15)
  assert.equal(accounts.find((item) => item.id === destinationAccountId)?.saldoAtual, 110)

  const pendingTransferId = await cadastrarTransferencia(principalDb, 'principal-1', {
    contaOrigemId: initialAccounts[0].id,
    contaDestinoId: destinationAccountId,
    descricao: 'Reserva futura',
    valor: 5,
    dataTransacao: new Date('2026-10-03T12:00:00.000Z'),
    status: 'PENDENTE',
    criadoPorUsuarioId: 'principal-1',
    criadoPorNome: 'Pessoa Principal',
    categoriaId: '30000000-0000-4000-8000-000000000001',
  })
  accounts = await listarContas(principalDb, 'principal-1')
  assert.equal(accounts.find((item) => item.id === initialAccounts[0].id)?.saldoAtual, 15)
  assert.equal(accounts.find((item) => item.id === destinationAccountId)?.saldoAtual, 110)
  const transferEntries = (await obterExtrato(principalDb, 'principal-1'))
    .filter((entry) => entry.transferenciaId === pendingTransferId)
  assert.equal(transferEntries.length, 2)
  await efetivarTransacaoPendente(principalDb, 'principal-1', transferEntries[0].id, 'principal-1')
  await assert.rejects(
    efetivarTransacaoPendente(principalDb, 'principal-1', transferEntries[1].id, 'principal-1'),
    /já foi processada/,
  )
  accounts = await listarContas(principalDb, 'principal-1')
  assert.equal(accounts.find((item) => item.id === initialAccounts[0].id)?.saldoAtual, 10)
  assert.equal(accounts.find((item) => item.id === destinationAccountId)?.saldoAtual, 115)
  await assert.rejects(
    cadastrarTransferencia(principalDb, 'principal-1', {
      contaOrigemId: initialAccounts[0].id,
      contaDestinoId: destinationAccountId,
      descricao: 'Saldo insuficiente',
      valor: 100,
      dataTransacao: new Date('2026-10-04T12:00:00.000Z'),
      status: 'EFETIVADO',
      criadoPorUsuarioId: 'principal-1',
      criadoPorNome: 'Pessoa Principal',
      categoriaId: '30000000-0000-4000-8000-000000000001',
    }),
    /saldo suficiente/,
  )
})

test('invite acceptance creates a secondary profile and denies cross-family reads', async () => {
  const principalDb = getTestFirestore(environment.authenticatedContext('principal-2', {
    email: 'owner@finup.test',
  }))
  await criarUsuarioPrincipal(principalDb, 'principal-2', 'owner@finup.test', 'Pessoa Titular')
  const principal = await obterUsuario(principalDb, 'principal-2')
  assert.ok(principal)

  const token = 'invite-test-token'
  await criarConvite(
    principalDb,
    principal,
    'secondary@finup.test',
    token,
    new Date(Date.now() + 60_000),
  )
  const secondaryDb = getTestFirestore(environment.authenticatedContext('secondary-2', {
    email: 'secondary@finup.test',
  }))
  await criarUsuarioSecundario(
    secondaryDb,
    'secondary-2',
    'secondary@finup.test',
    'Pessoa Convidada',
    token,
  )
  const secondary = await obterUsuario(secondaryDb, 'secondary-2')
  assert.equal(secondary?.papel, 'SECUNDARIO')
  assert.equal(secondary?.familiaId, 'principal-2')

  const unrelatedDb = getTestFirestore(environment.authenticatedContext('unrelated', {
    email: 'other@finup.test',
  }))
  await assert.rejects(
    getDoc(doc(unrelatedDb, 'familias', 'principal-2', 'contas', 'principal')),
  )
})

test('missing relational entities support family-scoped CRUD and reject cross-family references', async () => {
  const db = getTestFirestore(environment.authenticatedContext('entities-owner', {
    email: 'entities@finup.test',
  }))
  await criarUsuarioPrincipal(db, 'entities-owner', 'entities@finup.test', 'Pessoa Entidades')
  const [account] = await listarContas(db, 'entities-owner')
  const categoryId = await criarCategoria(db, 'entities-owner', {
    nome: 'Categoria filha',
    icone: 'pricetag-outline',
    tipo: 'DESPESA',
    categoriaPaiId: '20000000-0000-4000-8000-000000000003',
  })

  const cardId = await criarCartaoPlastico(db, 'entities-owner', {
    contaId: account.id,
    nomeExibicao: 'Cartão principal',
    bandeira: 'VISA',
    ativo: true,
  })
  await atualizarCartaoPlastico(db, 'entities-owner', cardId, {
    contaId: account.id,
    usuarioPortadorId: 'entities-owner',
    nomeExibicao: 'Cartão atualizado',
    bandeira: 'MASTERCARD',
  })
  assert.equal((await listarCartoesPlasticos(db, 'entities-owner'))[0].nomeExibicao, 'Cartão atualizado')

  const budgetId = await criarOrcamentoMeta(db, 'entities-owner', {
    usuarioId: 'entities-owner',
    categoriaId: categoryId,
    valorTeto: 250,
    mesAno: '2026-10',
    ativo: true,
  })
  await atualizarOrcamentoMeta(db, 'entities-owner', budgetId, {
    usuarioId: 'entities-owner',
    categoriaId: categoryId,
    valorTeto: 300,
    mesAno: '2026-10',
  })
  assert.equal((await listarOrcamentosMetas(db, 'entities-owner'))[0].valorTeto, 300)

  const installmentId = await criarParcelamento(db, 'entities-owner', {
    descricao: 'Notebook',
    valorTotal: 1200,
    totalParcelas: 12,
    dataInicio: new Date('2026-10-01T12:00:00.000Z'),
    contaId: account.id,
    categoriaId: categoryId,
    tipoMovimentacao: 'DESPESA',
    ativo: true,
    criadoPorUsuarioId: 'entities-owner',
  })
  await atualizarParcelamento(db, 'entities-owner', installmentId, {
    descricao: 'Notebook atualizado',
    valorTotal: 1200,
    totalParcelas: 12,
    dataInicio: new Date('2026-10-01T12:00:00.000Z'),
    contaId: account.id,
    categoriaId: categoryId,
    tipoMovimentacao: 'DESPESA',
  })
  assert.equal((await listarParcelamentos(db, 'entities-owner'))[0].descricao, 'Notebook atualizado')

  const recurrenceId = await criarRecorrencia(db, 'entities-owner', {
    descricao: 'Mensalidade',
    valorEstimado: 80,
    diaVencimento: 10,
    dataProximaExecucao: new Date('2026-11-10T12:00:00.000Z'),
    dataFim: null,
    contaId: account.id,
    categoriaId: categoryId,
    tipoMovimentacao: 'DESPESA',
    ativo: true,
    criadoPorUsuarioId: 'entities-owner',
  })
  await atualizarRecorrencia(db, 'entities-owner', recurrenceId, {
    descricao: 'Mensalidade atualizada',
    valorEstimado: 90,
    diaVencimento: 10,
    dataProximaExecucao: new Date('2026-11-10T12:00:00.000Z'),
    dataFim: null,
    contaId: account.id,
    categoriaId: categoryId,
    tipoMovimentacao: 'DESPESA',
  })
  assert.equal((await listarRecorrencias(db, 'entities-owner'))[0].valorEstimado, 90)

  const invoiceId = await criarFaturaCartao(db, 'entities-owner', {
    contaId: account.id,
    mesReferencia: '2026-10',
  })
  await atualizarFaturaCartao(db, 'entities-owner', invoiceId, {
    valorTotal: 100,
    valorPago: 25,
    status: 'FECHADA',
  })
  assert.equal((await listarFaturasCartao(db, 'entities-owner'))[0].valorPago, 25)

  await arquivarCartaoPlastico(db, 'entities-owner', cardId)
  await arquivarOrcamentoMeta(db, 'entities-owner', budgetId)
  await arquivarParcelamento(db, 'entities-owner', installmentId)
  await arquivarRecorrencia(db, 'entities-owner', recurrenceId)
  assert.equal((await listarCartoesPlasticos(db, 'entities-owner'))[0].ativo, false)
  assert.equal((await listarOrcamentosMetas(db, 'entities-owner'))[0].ativo, false)
  assert.equal((await listarParcelamentos(db, 'entities-owner'))[0].ativo, false)
  assert.equal((await listarRecorrencias(db, 'entities-owner'))[0].ativo, false)

  await assert.rejects(criarCartaoPlastico(db, 'entities-owner', {
    contaId: 'not-in-this-family',
    nomeExibicao: 'Cartão inválido',
    bandeira: 'VISA',
    ativo: true,
  }))
})

test('bank institutions support authenticated maintenance and link to investment accounts', async () => {
  const ownerDb = getTestFirestore(environment.authenticatedContext('institution-owner', {
    email: 'institution-owner@finup.test',
  }))
  await criarUsuarioPrincipal(ownerDb, 'institution-owner', 'institution-owner@finup.test', 'Pessoa Instituição')

  const institutionId = await criarInstituicaoBancaria(ownerDb, {
    nome: 'Banco de Teste',
    codigoBancario: '123',
    corHex: '#1A2B3C',
    ativo: true,
  })
  const unlinkedMobileCardId = await criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Cartão criado pelo fluxo mobile',
    tipoConta: 'CARTAO_CREDITO',
    saldoAtual: 0,
    ativo: true,
  })
  await atualizarInstituicaoBancaria(ownerDb, institutionId, {
    nome: 'Banco de Teste Atualizado',
    codigoBancario: '456',
    corHex: '#2B3C4D',
  })

  await assert.rejects(criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Conta sem identificação',
    tipoConta: 'CORRENTE',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
  }))

  const legacyAccountId = 'legacy-linked-account'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(getTestFirestore(context), 'familias', 'institution-owner', 'contas', legacyAccountId), {
      nome: 'Conta vinculada antiga',
      tipoConta: 'CORRENTE',
      saldoAtual: 0,
      ativo: true,
      instituicaoId: institutionId,
      criadaPorUsuarioId: 'institution-owner',
      dataCriacao: Timestamp.now(),
    })
  })
  await arquivarConta(ownerDb, 'institution-owner', legacyAccountId)
  assert.equal((await listarContas(ownerDb, 'institution-owner')).find((item) => item.id === legacyAccountId)?.ativo, false)

  const accountId = await criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Investimentos',
    tipoConta: 'INVESTIMENTO',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    agencia: '0001',
    numeroConta: '12345-6',
  })
  const sameNumberDifferentBranchId = await criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Investimentos - outra agência',
    tipoConta: 'INVESTIMENTO',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    agencia: '0002',
    numeroConta: '12345-6',
  })
  await assert.rejects(criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Cartão sem conta corrente',
    tipoConta: 'CARTAO_CREDITO',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    agencia: '0001',
    numeroConta: '11111-1',
    limiteTotal: 30000,
    contaCorrenteId: accountId,
  }))
  const checkingAccountId = await criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Conta corrente',
    tipoConta: 'CORRENTE',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    agencia: '0001',
    numeroConta: '22222-2',
    limiteTotal: 1500,
  })
  const creditAccountId = await criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Conta cartão',
    tipoConta: 'CARTAO_CREDITO',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    limiteTotal: 30000,
    contaCorrenteId: checkingAccountId,
    diaVencimento: 10,
  })
  await assert.rejects(criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Conta cartão sem vencimento',
    tipoConta: 'CARTAO_CREDITO',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    limiteTotal: 30000,
    contaCorrenteId: checkingAccountId,
  }))
  await assert.rejects(criarConta(ownerDb, 'institution-owner', 'institution-owner', {
    nome: 'Conta cartão com vencimento inválido',
    tipoConta: 'CARTAO_CREDITO',
    saldoAtual: 0,
    ativo: true,
    instituicaoId: institutionId,
    limiteTotal: 30000,
    contaCorrenteId: checkingAccountId,
    diaVencimento: 32,
  }))
  await atualizarConta(ownerDb, 'institution-owner', creditAccountId, {
    nome: 'Conta cartão',
    tipoConta: 'CARTAO_CREDITO',
    instituicaoId: institutionId,
    limiteTotal: 30000,
    contaCorrenteId: checkingAccountId,
    diaVencimento: 15,
  })
  await atualizarConta(ownerDb, 'institution-owner', accountId, {
    nome: 'Investimentos',
    tipoConta: 'INVESTIMENTO',
    instituicaoId: institutionId,
    agencia: '0001',
    numeroConta: '67890-1',
  })
  assert.equal(
    (await listarInstituicoesBancarias(ownerDb)).find((item) => item.id === institutionId)?.nome,
    'Banco de Teste Atualizado',
  )
  assert.equal(
    (await listarContas(ownerDb, 'institution-owner')).find((item) => item.id === accountId)?.instituicaoId,
    institutionId,
  )
  const institutionAccounts = await listarContas(ownerDb, 'institution-owner')
  assert.equal(institutionAccounts.find((item) => item.id === unlinkedMobileCardId)?.diaVencimento, undefined)
  assert.equal(institutionAccounts.find((item) => item.id === checkingAccountId)?.limiteTotal, 1500)
  assert.equal(institutionAccounts.find((item) => item.id === creditAccountId)?.limiteTotal, 30000)
  assert.equal(institutionAccounts.find((item) => item.id === creditAccountId)?.contaCorrenteId, checkingAccountId)
  assert.equal(institutionAccounts.find((item) => item.id === creditAccountId)?.diaVencimento, 15)
  const savedAccounts = await listarContas(ownerDb, 'institution-owner')
  assert.equal(savedAccounts.find((item) => item.id === accountId)?.numeroConta, '67890-1')
  assert.equal(savedAccounts.find((item) => item.id === sameNumberDifferentBranchId)?.agencia, '0002')
  await assert.rejects(deleteDoc(doc(ownerDb, 'instituicoes_bancarias', institutionId)))

  const authenticatedUserDb = getTestFirestore(environment.authenticatedContext('institution-editor', {
    email: 'institution-editor@finup.test',
  }))
  await atualizarInstituicaoBancaria(authenticatedUserDb, institutionId, {
    nome: 'Banco Atualizado por Outro Usuário',
  })
  await arquivarInstituicaoBancaria(ownerDb, institutionId)
  assert.equal(
    (await listarInstituicoesBancarias(ownerDb)).find((item) => item.id === institutionId)?.ativo,
    false,
  )
  await ativarInstituicaoBancaria(ownerDb, institutionId)
  assert.equal(
    (await listarInstituicoesBancarias(ownerDb)).find((item) => item.id === institutionId)?.ativo,
    true,
  )
})
