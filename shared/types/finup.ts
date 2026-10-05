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

export interface Conta {
  id: string
  nome: string
  tipoConta: 'CORRENTE' | 'POUPANCA' | 'CARTAO_CREDITO' | 'CAIXINHA'
  saldoAtual: number
  limiteTotal?: number
  diaFechamento?: number
  diaVencimento?: number
  ativo: boolean
  ultimaMovimentacaoId?: string
}

export interface Categoria {
  id: string
  nome: string
  icone: string
  tipo: TipoCategoria
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
  estornado: boolean
  transferenciaId?: string
  direcaoTransferencia?: 'SAIDA' | 'ENTRADA'
  formaPagamento?: 'normal' | 'credit'
  parcelas?: number
  diaVencimento?: number
}
