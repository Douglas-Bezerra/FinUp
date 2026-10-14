// src/components/ManagerContas.tsx
// Arquivo para gerenciar Contas
// ========================================

import { useState, type FormEvent } from 'react'
import {
  arquivarConta,
  atualizarConta,
  ativarConta,
  criarConta,
} from '../../../shared/services/finupService'
import type { Conta, InstituicaoBancaria, Usuario } from '../../../shared/types/finup'
import { db } from '../firebase'

type Props = {
  profile: Usuario
  accounts: Conta[]
  institutions: InstituicaoBancaria[]
  onAccountsChanged: (accounts: Conta[]) => void
}

type AccountType = Conta['tipoConta']

const accountTypeLabels: Record<AccountType, string> = {
  CORRENTE: 'Conta corrente',
  POUPANCA: 'Poupança',
  CARTAO_CREDITO: 'Cartão de crédito',
  INVESTIMENTO: 'Conta investimento',
  CAIXINHA: 'Caixinha',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function parseBalance(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value
  const balance = Number(normalized)
  return Number.isFinite(balance) ? balance : null
}

export default function ManagerContas({ profile, accounts, institutions, onAccountsChanged }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Conta | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('CORRENTE')
  const [accountInstitutionId, setAccountInstitutionId] = useState('')
  const [agency, setAgency] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [linkedCheckingAccountId, setLinkedCheckingAccountId] = useState('')
  const [creditLimit, setCreditLimit] = useState('0')
  const [dueDay, setDueDay] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')

  function openEditor(account?: Conta) {
    setEditingAccount(account ?? null)
    setAccountName(account?.nome ?? '')
    setAccountType(account?.tipoConta ?? 'CORRENTE')
    const linkedCheckingAccount = accounts.find((item) => item.id === account?.contaCorrenteId)
    setAccountInstitutionId(linkedCheckingAccount?.instituicaoId ?? account?.instituicaoId ?? '')
    setAgency(account?.agencia ?? '')
    setAccountNumber(account?.numeroConta ?? '')
    setLinkedCheckingAccountId(account?.contaCorrenteId ?? '')
    setCreditLimit(String(account?.limiteTotal ?? 0).replace('.', ','))
    setDueDay(account?.diaVencimento == null ? '' : String(account.diaVencimento))
    setOpeningBalance('0')
    setFormError('')
    setIsEditorOpen(true)
  }

  function closeEditor() {
    if (isSaving) return
    setIsEditorOpen(false)
    setFormError('')
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!accountName.trim()) {
      setFormError('Informe o nome da conta.')
      return
    }
    const linkedCheckingAccount = accounts.find((account) => account.id === linkedCheckingAccountId)
    const institutionId = accountType === 'CARTAO_CREDITO'
      ? linkedCheckingAccount?.instituicaoId ?? ''
      : accountInstitutionId
    if (accountType !== 'CARTAO_CREDITO' && institutionId && !agency.trim()) {
      setFormError('Informe a agência da conta vinculada à instituição.')
      return
    }
    if (accountType !== 'CARTAO_CREDITO' && institutionId && !accountNumber.trim()) {
      setFormError('Informe o número da conta vinculada à instituição.')
      return
    }
    const normalizedDueDay = Number(dueDay)
    if (accountType === 'CARTAO_CREDITO'
      && (!Number.isInteger(normalizedDueDay) || normalizedDueDay < 1 || normalizedDueDay > 31)) {
      setFormError('Informe um dia de vencimento entre 1 e 31.')
      return
    }
    const normalizedLimit = parseBalance(creditLimit)
    if ((accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO')
      && (normalizedLimit === null || normalizedLimit < 0)) {
      setFormError('Informe um limite válido, igual ou maior que zero.')
      return
    }
    if (accountType === 'CARTAO_CREDITO') {
      if (!linkedCheckingAccountId || !linkedCheckingAccount
        || linkedCheckingAccount.tipoConta !== 'CORRENTE'
        || !linkedCheckingAccount.instituicaoId) {
        setFormError('Selecione uma conta corrente vinculada a uma instituição.')
        return
      }
      if (normalizedLimit === null || normalizedLimit <= 0) {
        setFormError('O limite da conta cartão deve ser maior que zero.')
        return
      }
    }
    if (editingAccount && accounts.some((account) => account.contaCorrenteId === editingAccount.id)
      && (accountType !== 'CORRENTE' || institutionId !== editingAccount.instituicaoId)) {
      setFormError('Esta conta corrente possui contas-cartão vinculadas. Desvincule ou atualize essas contas antes de alterar sua instituição ou tipo.')
      return
    }
    const balance = parseBalance(openingBalance)
    if (!editingAccount && balance === null) {
      setFormError('Informe um saldo inicial válido.')
      return
    }

    setIsSaving(true)
    try {
      const details = {
        nome: accountName.trim(),
        tipoConta: accountType,
        instituicaoId: institutionId || null,
        agencia: accountType === 'CARTAO_CREDITO' ? null : agency.trim() || null,
        numeroConta: accountType === 'CARTAO_CREDITO' ? null : accountNumber.trim() || null,
        limiteTotal: accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO'
          ? normalizedLimit
          : null,
        contaCorrenteId: accountType === 'CARTAO_CREDITO' ? linkedCheckingAccountId : null,
        diaVencimento: accountType === 'CARTAO_CREDITO' ? normalizedDueDay : null,
      }
      if (editingAccount) {
        await atualizarConta(db, profile.familiaId, editingAccount.id, details)
        onAccountsChanged(accounts.map((account) => account.id === editingAccount.id
          ? { ...account, ...details }
          : account))
        setFeedback('Conta atualizada.')
      } else {
        if (balance === null) {
          setFormError('Informe um saldo inicial válido.')
          return
        }
        const newAccount = {
          ...details,
          saldoAtual: balance,
          ativo: true,
        }
        const id = await criarConta(db, profile.familiaId, profile.id, newAccount)
        onAccountsChanged([...accounts, { ...newAccount, id }])
        setFeedback('Conta criada.')
      }
      setIsEditorOpen(false)
    } catch (error) {
      console.error('Erro ao salvar conta:', error)
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a conta. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function changeAccountStatus(account: Conta, isActive: boolean) {
    if (isActive && !window.confirm(`Arquivar a conta “${account.nome}”? O histórico será mantido.`)) return
    setIsSaving(true)
    try {
      if (isActive) {
        await arquivarConta(db, profile.familiaId, account.id)
      } else {
        await ativarConta(db, profile.familiaId, account.id)
      }
      onAccountsChanged(accounts.map((item) => item.id === account.id ? { ...item, ativo: !isActive } : item))
      setFeedback(isActive ? 'Conta arquivada. O histórico foi mantido.' : 'Conta reativada.')
    } catch (error) {
      console.error(isActive ? 'Erro ao arquivar conta:' : 'Erro ao reativar conta:', error)
      setFeedback(isActive
        ? 'Não foi possível arquivar a conta. Tente novamente.'
        : 'Não foi possível reativar a conta. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="records-heading manager-heading">
        <div>
          <p className="eyebrow">Gerenciamento financeiro</p>
          <h2>Contas</h2>
          <p>Gerencie contas, instituições, agência e número de identificação.</p>
        </div>
        <button className="records-create-button" type="button" onClick={() => openEditor()}>
          <span aria-hidden="true">+</span> Nova conta
        </button>
      </div>

      {feedback && <p className="records-feedback" role="status">{feedback}</p>}
      {accounts.length === 0 ? (
        <div className="records-state">
          <p className="records-empty-title">Nenhuma conta cadastrada</p>
          <p>Crie uma conta para começar a organizar suas finanças.</p>
          <button className="records-empty-action" type="button" onClick={() => openEditor()}>
            Criar conta
          </button>
        </div>
      ) : (
        <ul className="manager-list">
          {accounts.map((account) => {
            const institution = institutions.find((item) => item.id === account.instituicaoId)
            const linkedCheckingAccount = accounts.find((item) => item.id === account.contaCorrenteId)
            return (
              <li className={account.ativo ? 'manager-card' : 'manager-card is-archived'} key={account.id}>
                <div className="manager-card-main">
                  <span
                    className="manager-card-icon"
                    aria-hidden="true"
                    style={institution?.corHex ? { backgroundColor: institution.corHex } : undefined}
                  >
                    
                  </span>
                  <div>
                    <strong>{account.nome}</strong>
                    <span>
                      {accountTypeLabels[account.tipoConta]} · {currencyFormatter.format(account.saldoAtual)}
                      {account.instituicaoId && ` · ${institution?.nome ?? 'Instituição indisponível'}`}
                    </span>
                    {account.limiteTotal != null && (
                      <small>
                        {account.tipoConta === 'CARTAO_CREDITO' ? 'Limite total do cartão' : 'Limite de crédito'}
                        : {currencyFormatter.format(account.limiteTotal)}
                        {account.tipoConta === 'CARTAO_CREDITO' && linkedCheckingAccount
                          ? ` · vinculada a ${linkedCheckingAccount.nome}`
                          : ''}
                      </small>
                    )}
                    {account.tipoConta === 'CARTAO_CREDITO' && account.diaVencimento != null && (
                      <small>Vencimento dia {account.diaVencimento}</small>
                    )}
                    {(account.agencia || account.numeroConta) && (
                      <small>
                        {account.agencia && `Agência ${account.agencia}`}
                        {account.agencia && account.numeroConta && ' · '}
                        {account.numeroConta && `Conta ${account.numeroConta}`}
                      </small>
                    )}
                  </div>
                  {!account.ativo && <span className="manager-badge">Arquivada</span>}
                </div>
                <div className="manager-card-actions">
                  <button type="button" className="manager-action" onClick={() => openEditor(account)}>Editar</button>
                  {account.ativo
                    ? <button type="button" className="manager-action is-danger" disabled={isSaving} onClick={() => void changeAccountStatus(account, true)}>Arquivar</button>
                    : <button type="button" className="manager-action" disabled={isSaving} onClick={() => void changeAccountStatus(account, false)}>Reativar</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {isEditorOpen && (
        <div className="records-overlay" onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) closeEditor()
        }} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor()
        }}>
          <section className="records-dialog manager-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-account-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Gerenciamento financeiro</p>
                <h2 id="manager-account-dialog-title">{editingAccount ? 'Editar conta' : 'Nova conta'}</h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={closeEditor} disabled={isSaving}>×</button>
            </header>
            <form className="records-form" onSubmit={(event) => void saveAccount(event)}>
              <label htmlFor="manager-account-name">Nome</label>
              <input id="manager-account-name" value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={80} required />
              <label htmlFor="manager-account-type">Tipo</label>
              <select id="manager-account-type" value={accountType} onChange={(event) => {
                const nextType = event.target.value as AccountType
                setAccountType(nextType)
                setLinkedCheckingAccountId('')
                if (nextType === 'CARTAO_CREDITO') {
                  setAccountInstitutionId('')
                  setAgency('')
                  setAccountNumber('')
                }
              }}>
                {Object.entries(accountTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {accountType === 'CARTAO_CREDITO' ? (
                <>
                  <label htmlFor="manager-account-checking">Conta corrente vinculada</label>
                  <select
                    id="manager-account-checking"
                    value={linkedCheckingAccountId}
                    onChange={(event) => {
                      const checkingAccount = accounts.find((account) => account.id === event.target.value)
                      setLinkedCheckingAccountId(event.target.value)
                      setAccountInstitutionId(checkingAccount?.instituicaoId ?? '')
                    }}
                    required
                  >
                    <option value="">Selecione uma conta corrente</option>
                    {accounts.filter((account) => account.tipoConta === 'CORRENTE'
                      && Boolean(account.instituicaoId)
                      && (account.ativo || account.id === editingAccount?.contaCorrenteId)).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.nome}{account.ativo ? '' : ' (arquivada)'}
                      </option>
                    ))}
                  </select>
                  <p className="manager-form-note">
                    Instituição: {institutions.find((item) => item.id === accountInstitutionId)?.nome ?? 'definida pela conta corrente'}
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="manager-account-institution">Instituição bancária</label>
                  <select id="manager-account-institution" value={accountInstitutionId} onChange={(event) => {
                    const institutionId = event.target.value
                    setAccountInstitutionId(institutionId)
                  }}>
                    <option value="">Sem instituição</option>
                    {institutions.filter((institution) => institution.ativo || institution.id === editingAccount?.instituicaoId).map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.nome}{institution.ativo ? '' : ' (arquivada)'}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="manager-account-agency">Agência{accountInstitutionId ? ' *' : ''}</label>
                  <input id="manager-account-agency" value={agency} onChange={(event) => setAgency(event.target.value)} maxLength={20} required={Boolean(accountInstitutionId)} />
                  <label htmlFor="manager-account-number">Número da conta{accountInstitutionId ? ' *' : ''}</label>
                  <input id="manager-account-number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} maxLength={30} required={Boolean(accountInstitutionId)} />
                </>
              )}
              {(accountType === 'CORRENTE' || accountType === 'CARTAO_CREDITO') && (
                <>
                  <label htmlFor="manager-account-limit">
                    {accountType === 'CARTAO_CREDITO' ? 'Limite total de crédito do cartão' : 'Limite de crédito / cheque especial'}
                  </label>
                  <input
                    id="manager-account-limit"
                    type="text"
                    inputMode="decimal"
                    value={creditLimit}
                    onChange={(event) => setCreditLimit(event.target.value)}
                    required
                  />
                </>
              )}
              {accountType === 'CARTAO_CREDITO' && (
                <>
                  <label htmlFor="manager-account-due-day">Dia de vencimento</label>
                  <input
                    id="manager-account-due-day"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={dueDay}
                    onChange={(event) => setDueDay(event.target.value)}
                    required
                  />
                  <p className="manager-form-note">Os cartões plásticos vinculados a esta conta compartilham este único limite.</p>
                </>
              )}
              {!editingAccount && (
                <>
                  <label htmlFor="manager-account-balance">Saldo inicial</label>
                  <input id="manager-account-balance" type="text" inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} required />
                </>
              )}
              {formError && <p className="records-form-error" role="alert">{formError}</p>}
              <button className="records-save" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar conta'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
