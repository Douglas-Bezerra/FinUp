// webapp/src/views/ManagerInstFin.tsx
// Arquivo para gerenciar Instituições Financeiras
// ================================================

import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  arquivarInstituicaoBancaria,
  atualizarInstituicaoBancaria,
  ativarInstituicaoBancaria,
  criarInstituicaoBancaria,
} from '../../../shared/services/finupService'
import type { InstituicaoBancaria } from '../../../shared/types/finup'
import { db } from '../firebase'

type Props = {
  institutions: InstituicaoBancaria[]
  onInstitutionsChanged: (institutions: InstituicaoBancaria[]) => void
}

const institutionColors = [
  { name: 'Ouro', value: '#FCFC30' }, // Banco do Brasil
  { name: 'Azul', value: '#1c60ab' }, // Caixa Econômica Federal
  { name: 'Verde', value: '#00AE9D' }, // Sicoob
  { name: 'Roxo', value: '#820AD1' }, // Nubank
  { name: 'Vermelho', value: '#CC092F' }, // Bradesco, Santander
  { name: 'Laranja', value: '#FF6200' }, // Itaú
  { name: 'Ciano', value: '#0891B2' },
  { name: 'Rosa', value: '#DB2777' },
  { name: 'Grafite', value: '#475569' },
  { name: 'Turquesa', value: '#0F766E' },
] as const

export default function ManagerInstFin({ institutions, onInstitutionsChanged }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingInstitution, setEditingInstitution] = useState<InstituicaoBancaria | null>(null)
  const [institutionName, setInstitutionName] = useState('')
  const [institutionCode, setInstitutionCode] = useState('')
  const [institutionColor, setInstitutionColor] = useState<string>(institutionColors[0].value)

  function openEditor(institution?: InstituicaoBancaria) {
    setEditingInstitution(institution ?? null)
    setInstitutionName(institution?.nome ?? '')
    setInstitutionCode(institution?.codigoBancario ?? '')
    setInstitutionColor(institution?.corHex ?? institutionColors[0].value)
    setFormError('')
    setIsEditorOpen(true)
  }

  function closeEditor() {
    if (isSaving) return
    setIsEditorOpen(false)
    setFormError('')
  }

  async function saveInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!institutionName.trim()) {
      setFormError('Informe o nome da instituição.')
      return
    }
    if (institutionCode.trim().length > 20) {
      setFormError('O código bancário deve ter até 20 caracteres.')
      return
    }

    setIsSaving(true)
    try {
      const institution = {
        nome: institutionName.trim(),
        codigoBancario: institutionCode.trim(),
        corHex: institutionColor,
      }
      if (editingInstitution) {
        await atualizarInstituicaoBancaria(db, editingInstitution.id, institution)
        onInstitutionsChanged(institutions.map((item) => item.id === editingInstitution.id
          ? { ...item, ...institution }
          : item))
      } else {
        const id = await criarInstituicaoBancaria(db, { ...institution, ativo: true })
        onInstitutionsChanged([...institutions, { ...institution, id, ativo: true }].sort((left, right) =>
          left.nome.localeCompare(right.nome, 'pt-BR')))
      }
      setFeedback(editingInstitution ? 'Instituição atualizada.' : 'Instituição cadastrada.')
      setIsEditorOpen(false)
    } catch (error) {
      console.error('Erro ao salvar instituição bancária:', error)
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a instituição.')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateInstitutionStatus(institution: InstituicaoBancaria, active: boolean) {
    if (!active && !window.confirm(`Arquivar “${institution.nome}”? Contas já vinculadas manterão a referência.`)) return
    setIsSaving(true)
    try {
      if (active) {
        await ativarInstituicaoBancaria(db, institution.id)
      } else {
        await arquivarInstituicaoBancaria(db, institution.id)
      }
      onInstitutionsChanged(institutions.map((item) => item.id === institution.id
        ? { ...item, ativo: active }
        : item))
      setFeedback(active ? 'Instituição reativada.' : 'Instituição arquivada.')
    } catch (error) {
      console.error('Erro ao atualizar instituição bancária:', error)
      setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar a instituição.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="manager-resource-heading">
        <div>
          <h2>Instituições bancárias</h2>
          <p>Cadastre e identifique as instituições vinculadas às contas.</p>
        </div>
        <button className="records-create-button" type="button" onClick={() => openEditor()}>
          <span aria-hidden="true">+</span> Nova instituição
        </button>
      </div>
      {feedback && <p className="records-feedback" role="status">{feedback}</p>}
      {institutions.length === 0 ? (
        <p className="records-state">Nenhuma instituição bancária cadastrada.</p>
      ) : (
        <ul className="manager-list">
          {institutions.map((institution) => (
            <li className={institution.ativo ? 'manager-card' : 'manager-card is-archived'} key={institution.id}>
              <div className="manager-card-main">
                <span
                  className="manager-card-icon"
                  aria-hidden="true"
                  style={institution.corHex ? { backgroundColor: institution.corHex } : undefined}
                ></span>
                <div>
                  <strong>{institution.nome}</strong>
                  <span>{institution.codigoBancario || 'Sem código bancário'}</span>
                </div>
                {!institution.ativo && <span className="manager-badge">Arquivada</span>}
              </div>
              <div className="manager-card-actions">
                <button className="manager-action" type="button" onClick={() => openEditor(institution)}>Editar</button>
                {institution.ativo
                  ? <button className="manager-action is-danger" type="button" disabled={isSaving} onClick={() => void updateInstitutionStatus(institution, false)}>Arquivar</button>
                  : <button className="manager-action" type="button" disabled={isSaving} onClick={() => void updateInstitutionStatus(institution, true)}>Reativar</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isEditorOpen && (
        <div className="records-overlay" onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSaving) closeEditor()
        }} onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor()
        }}>
          <section className="records-dialog manager-dialog" role="dialog" aria-modal="true" aria-labelledby="institution-dialog-title">
            <header className="records-dialog-header">
              <div>
                <p className="eyebrow">Instituições bancárias</p>
                <h2 id="institution-dialog-title">{editingInstitution ? 'Editar instituição' : 'Nova instituição'}</h2>
              </div>
              <button className="records-close" type="button" aria-label="Fechar formulário" onClick={closeEditor} disabled={isSaving}>×</button>
            </header>
            <form className="records-form" onSubmit={(event) => void saveInstitution(event)}>
              <label htmlFor="resource-institution-name">Nome</label>
              <input id="resource-institution-name" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} maxLength={100} required />
              <label htmlFor="resource-institution-code">Código bancário (opcional)</label>
              <input id="resource-institution-code" value={institutionCode} onChange={(event) => setInstitutionCode(event.target.value)} maxLength={20} />
              <fieldset className="manager-color-fieldset">
                <legend>Cor identificadora</legend>
                <div className="manager-color-palette" role="group" aria-label="Paleta de cores da instituição">
                  {institutionColors.map((color) => (
                    <button
                      key={color.value}
                      className={institutionColor === color.value ? 'manager-color-option is-selected' : 'manager-color-option'}
                      type="button"
                      style={{ '--institution-color': color.value } as CSSProperties}
                      aria-label={`${color.name} (${color.value})`}
                      aria-pressed={institutionColor === color.value}
                      title={`${color.name} · ${color.value}`}
                      onClick={() => setInstitutionColor(color.value)}
                    />
                  ))}
                </div>
                <p className="manager-form-note">
                  Selecionada: {institutionColors.find((color) => color.value === institutionColor)?.name ?? 'Personalizada'} ({institutionColor})
                </p>
              </fieldset>
              {formError && <p className="records-form-error" role="alert">{formError}</p>}
              <button className="records-save" type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar instituição'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
