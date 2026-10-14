// src/components/ManagerPlasticCard.tsx
// Arquivo para gerenciar Cartões plásticos
// ==========================================

import { useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import {
  arquivarCartaoPlastico,
  atualizarCartaoPlastico,
  criarCartaoPlastico,
} from '../../../shared/services/finupService'
import type { CartaoPlastico, Conta, Usuario } from '../../../shared/types/finup'
import { db } from '../firebase'

type Props = {
  profile: Usuario
  accounts: Conta[]
  cards: CartaoPlastico[]
  onCardsChanged: (cards: CartaoPlastico[]) => void
}

type CardBrand = CartaoPlastico['bandeira']

const cardBrandLabels: Record<CardBrand, string> = {
  ELO: 'Elo',
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMEX: 'American Express',
  HIPERCARD: 'Hipercard',
  OUTRA: 'Outra',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ManagerPlasticCard({ profile, accounts, cards, onCardsChanged }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CartaoPlastico | null>(null)
  const [cardName, setCardName] = useState('')
  const [cardAccountId, setCardAccountId] = useState('')
  const [cardHolderId, setCardHolderId] = useState('')
  const [cardBrand, setCardBrand] = useState<CardBrand>('OUTRA')

  const creditAccounts = accounts.filter((account) => account.tipoConta === 'CARTAO_CREDITO')
  const canCreateCard = creditAccounts.some((account) => account.ativo)

  function openEditor(card?: CartaoPlastico) {
    setEditingCard(card ?? null)
    setCardName(card?.nomeExibicao ?? '')
    setCardAccountId(card?.contaId ?? creditAccounts.find((account) => account.ativo)?.id ?? '')
    setCardHolderId(card?.usuarioPortadorId ?? '')
    setCardBrand(card?.bandeira ?? 'OUTRA')
    setFormError('')
    setIsEditorOpen(true)
  }

  function closeEditor() {
    if (isSaving) return
    setIsEditorOpen(false)
    setFormError('')
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!cardName.trim() || !cardAccountId) {
      setFormError('Informe o nome e a conta do cartão.')
      return
    }

    setIsSaving(true)
    try {
      const card = {
        contaId: cardAccountId,
        usuarioPortadorId: cardHolderId || null,
        nomeExibicao: cardName.trim(),
        bandeira: cardBrand,
      }
      if (editingCard) {
        await atualizarCartaoPlastico(db, profile.familiaId, editingCard.id, card)
        onCardsChanged(cards.map((item) => item.id === editingCard.id
          ? { ...item, ...card }
          : item))
      } else {
        const id = await criarCartaoPlastico(db, profile.familiaId, { ...card, ativo: true })
        onCardsChanged([...cards, { ...card, id, ativo: true, dataCriacao: new Date() }]
          .sort((left, right) => left.nomeExibicao.localeCompare(right.nomeExibicao, 'pt-BR')))
      }
      setFeedback(editingCard ? 'Cartão atualizado.' : 'Cartão criado.')
      setIsEditorOpen(false)
    } catch (error) {
      console.error('Erro ao salvar cartão plástico:', error)
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o cartão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function changeCardStatus(card: CartaoPlastico, active: boolean) {
    if (active && !window.confirm(`Arquivar o cartão “${card.nomeExibicao}”?`)) return
    setIsSaving(true)
    try {
      if (active) {
        await arquivarCartaoPlastico(db, profile.familiaId, card.id)
      } else {
        await updateDoc(doc(db, 'familias', profile.familiaId, 'cartoes_plasticos', card.id), { ativo: true })
      }
      onCardsChanged(cards.map((item) => item.id === card.id ? { ...item, ativo: !active } : item))
      setFeedback(active ? 'Cartão arquivado.' : 'Cartão reativado.')
    } catch (error) {
      console.error(active ? 'Erro ao arquivar cartão plástico:' : 'Erro ao reativar cartão plástico:', error)
      setFeedback(error instanceof Error
        ? error.message
        : active ? 'Não foi possível arquivar o cartão.' : 'Não foi possível reativar o cartão.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="manager-resource-heading">
        <div>
          <h2>Cartões</h2>
          <p>Gerencie cartões plásticos e as contas de crédito às quais estão vinculados.</p>
        </div>
        {canCreateCard && (
          <button className="records-create-button" type="button" onClick={() => openEditor()}>
            <span aria-hidden="true">+</span> Novo cartão
          </button>
        )}
      </div>

      {feedback && <p className="records-feedback" role="status">{feedback}</p>}
      {!canCreateCard && (
        <p className="records-state">Cadastre uma conta ativa do tipo cartão de crédito antes de adicionar cartões plásticos.</p>
      )}
      {cards.length === 0 ? (
        <p className="records-state">Nenhum cartão plástico cadastrado.</p>
      ) : (
        <ul className="manager-list">
          {cards.map((card) => {
            const account = accounts.find((item) => item.id === card.contaId)
            return (
              <li className={card.ativo ? 'manager-card' : 'manager-card is-archived'} key={card.id}>
                <div className="manager-card-main">
                  <span className="manager-card-icon" aria-hidden="true">▰</span>
                  <div>
                    <strong>{card.nomeExibicao}</strong>
                    <span>{cardBrandLabels[card.bandeira]} · {account?.nome ?? 'Conta indisponível'}</span>
                    {account?.limiteTotal != null && (
                      <small>Compartilha o limite da conta: {currencyFormatter.format(account.limiteTotal)}</small>
                    )}
                  </div>
                  {!card.ativo && <span className="manager-badge">Arquivado</span>}
                </div>
                <div className="manager-card-actions">
                  <button className="manager-action" type="button" onClick={() => openEditor(card)}>Editar</button>
                  {card.ativo
                    ? <button className="manager-action is-danger" type="button" disabled={isSaving} onClick={() => void changeCardStatus(card, true)}>Arquivar</button>
                    : <button className="manager-action" type="button" disabled={isSaving} onClick={() => void changeCardStatus(card, false)}>Reativar</button>}
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
          <section className="records-dialog manager-dialog" role="dialog" aria-modal="true" aria-labelledby="plastic-card-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Cartões</p>
                <h2 id="plastic-card-dialog-title">{editingCard ? 'Editar cartão' : 'Novo cartão'}</h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={closeEditor} disabled={isSaving}>×</button>
            </header>
            <form className="records-form" onSubmit={(event) => void saveCard(event)}>
              <label htmlFor="plastic-card-name">Nome de exibição</label>
              <input id="plastic-card-name" value={cardName} onChange={(event) => setCardName(event.target.value)} maxLength={80} required />
              <label htmlFor="plastic-card-account">Conta de crédito</label>
              <select id="plastic-card-account" value={cardAccountId} onChange={(event) => setCardAccountId(event.target.value)} required>
                <option value="" disabled>Selecione uma conta</option>
                {creditAccounts.filter((account) => account.ativo || account.id === editingCard?.contaId).map((account) => (
                  <option key={account.id} value={account.id}>{account.nome}{account.ativo ? '' : ' (arquivada)'}</option>
                ))}
              </select>
              <label htmlFor="plastic-card-brand">Bandeira</label>
              <select id="plastic-card-brand" value={cardBrand} onChange={(event) => setCardBrand(event.target.value as CardBrand)}>
                {Object.entries(cardBrandLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label htmlFor="plastic-card-holder">Responsável</label>
              <select id="plastic-card-holder" value={cardHolderId} onChange={(event) => setCardHolderId(event.target.value)}>
                <option value="">Sem responsável</option>
                <option value={profile.id}>{profile.nome}</option>
                {cardHolderId && cardHolderId !== profile.id && (
                  <option value={cardHolderId}>Outro membro da família</option>
                )}
              </select>
              {formError && <p className="records-form-error" role="alert">{formError}</p>}
              <button className="records-save" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar cartão'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
