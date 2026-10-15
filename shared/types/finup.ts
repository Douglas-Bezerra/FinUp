// shared/types/finup.ts
// Arquivo de tipos (define campos e tipos de dados) para aplicação web e mobile
//==============================================================================

export type PapelUsuario = 'PRINCIPAL' | 'SECUNDARIO'
export type TipoMovimentacao = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
export type StatusTransacao = 'EFETIVADO' | 'PENDENTE'
export type TipoCategoria = TipoMovimentacao | 'AMBAS'

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: PapelUsuario
  usuarioPaiId: string | null
  familiaId: string
  dataCriacao: Date
}

export interface InstituicaoBancaria {
  id: string
  nome: string
  codigoBancario?: string
  corHex?: string
  ativo: boolean
}

export interface Conta {
  id: string
  usuarioId?: string
  instituicaoId?: string | null
  agencia?: string | null
  numeroConta?: string | null
  contaCorrenteId?: string | null
  nome: string
  tipoConta: 'CORRENTE' | 'POUPANCA' | 'CARTAO_CREDITO' | 'CAIXINHA' | 'INVESTIMENTO' | 'OUTROS'
  saldoAtual: number
  limiteTotal?: number | null
  diaFechamento?: number
  diaVencimento?: number | null
  ativo: boolean
  ultimaMovimentacaoId?: string
}

export interface Categoria {
  id: string
  categoriaPaiId?: string | null
  nome: string
  icone: string
  tipo: TipoCategoria
  ativo?: boolean
}

export interface Transacao {
  id: string
  descricao: string
  valor: number
  tipoMovimentacao: TipoMovimentacao
  status: StatusTransacao
  dataTransacao: Date
  contaId: string | null
  contaDestinoId?: string
  categoriaId: string
  categoriaNome: string
  criadoPorUsuarioId: string
  criadoPorNome: string
  atualizadoPorUsuarioId?: string
  dataAtualizacao?: Date
  dataCriacao?: Date
  estornado: boolean
  cartaoPlasticoId?: string
  parcelamentoId?: string
  recorrenciaId?: string
  faturaId?: string
  parcelaAtual?: number
  observacao?: string
  transferenciaId?: string
  direcaoTransferencia?: 'SAIDA' | 'ENTRADA'
  formaPagamento?: 'normal' | 'credit'
  parcelas?: number
  diaVencimento?: number
}

export interface CartaoPlastico {
  id: string
  contaId: string
  usuarioPortadorId?: string | null
  nomeExibicao: string
  bandeira: 'ELO' | 'VISA' | 'MASTERCARD' | 'AMEX' | 'HIPERCARD' | 'OUTRA'
  ativo: boolean
  dataCriacao: Date
}

export interface OrcamentoMeta {
  id: string
  usuarioId: string
  categoriaId: string
  valorTeto: number
  mesAno: string
  ativo: boolean
  dataCriacao: Date
}

export interface Parcelamento {
  id: string
  descricao: string
  valorTotal: number
  totalParcelas: number
  dataInicio: Date
  contaId: string
  categoriaId: string
  tipoMovimentacao: 'RECEITA' | 'DESPESA'
  cartaoPlasticoId?: string
  ativo: boolean
  criadoPorUsuarioId: string
  dataCriacao: Date
}

export interface Recorrencia {
  id: string
  descricao: string
  valorEstimado: number
  diaVencimento: number
  dataProximaExecucao: Date | null
  dataFim: Date | null
  contaId: string
  categoriaId: string
  tipoMovimentacao: 'RECEITA' | 'DESPESA'
  ativo: boolean
  criadoPorUsuarioId: string
  dataCriacao: Date
}

export interface FaturaCartao {
  id: string
  contaId: string
  mesReferencia: string
  valorTotal: number
  valorPago: number
  status: 'ABERTA' | 'FECHADA' | 'PAGA'
  dataCriacao: Date
}

export interface LogAtividade {
  id: string
  transacaoId: string
  usuarioId: string
  acao: string
  dataAcao: Date
  descricaoSnapshot?: string
  valoresAntigos?: Record<string, unknown>
  valoresNovos?: Record<string, unknown>
}
