'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Raffle, Ticket } from '@/lib/types'
import { Search, ExternalLink, Trash2, ChevronDown, FileText, Pencil, X, Save, Upload, Loader2 } from 'lucide-react'
import Link from 'next/link'

// ─── Modal de Edição ─────────────────────────────────────────────────────────
function EditModal({ ticket, onClose, onSaved }: {
  ticket: Ticket
  onClose: () => void
  onSaved: (updated: Ticket) => void
}) {
  const [form, setForm] = useState({
    buyer_name: ticket.buyer_name,
    buyer_doc: ticket.buyer_doc,
    buyer_contact: ticket.buyer_contact,
    status: ticket.status,
    amount_paid: ticket.amount_paid != null ? String(ticket.amount_paid) : '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    } else setPreview(null)
  }

  async function handleSave() {
    setError('')
    if (!form.buyer_name.trim() || !form.buyer_doc.trim() || !form.buyer_contact.trim()) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }
    setLoading(true)
    const supabase = createClient()

    let payment_proof = ticket.payment_proof

    // Novo comprovante
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${ticket.raffle_id}/${ticket.ticket_number}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('comprovantes').upload(path, file, { upsert: true })
      if (uploadError) {
        setError('Erro no upload: ' + uploadError.message)
        setLoading(false)
        return
      }
      payment_proof = path
    }

    const updates = {
      buyer_name: form.buyer_name.trim(),
      buyer_doc: form.buyer_doc.trim(),
      buyer_contact: form.buyer_contact.trim(),
      status: form.status as Ticket['status'],
      amount_paid: form.amount_paid !== '' ? parseFloat(form.amount_paid) : null,
      payment_proof,
    }

    const { error: dbError } = await supabase.from('tickets').update(updates).eq('id', ticket.id)
    if (dbError) {
      setError('Erro ao salvar: ' + dbError.message)
    } else {
      onSaved({ ...ticket, ...updates })
      onClose()
    }
    setLoading(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        className="glass-card slide-up"
        style={{ width: '100%', maxWidth: 500, padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Editar Bilhete #{String(ticket.ticket_number).padStart(3, '0')}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Dados do comprador</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Nome */}
          <div>
            <label className="label" htmlFor="edit_buyer_name">Nome Completo *</label>
            <input id="edit_buyer_name" name="buyer_name" type="text" className="input-field"
              value={form.buyer_name} onChange={handleChange} />
          </div>

          {/* Documento */}
          <div>
            <label className="label" htmlFor="edit_buyer_doc">CPF / Documento *</label>
            <input id="edit_buyer_doc" name="buyer_doc" type="text" className="input-field"
              value={form.buyer_doc} onChange={handleChange} />
          </div>

          {/* Contato */}
          <div>
            <label className="label" htmlFor="edit_buyer_contact">Telefone / WhatsApp / E-mail *</label>
            <input id="edit_buyer_contact" name="buyer_contact" type="text" className="input-field"
              value={form.buyer_contact} onChange={handleChange} />
          </div>

          {/* Status */}
          <div>
            <label className="label" htmlFor="edit_status">Status</label>
            <select id="edit_status" name="status" className="input-field" value={form.status} onChange={handleChange}>
              <option value="paid">Pago ✅</option>
              <option value="reserved">Reservado ⏳</option>
              <option value="cancelled">Cancelado ❌</option>
            </select>
          </div>

          {/* Valor recebido */}
          <div>
            <label className="label" htmlFor="edit_amount_paid">Valor Recebido (R$)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>R$</span>
              <input
                id="edit_amount_paid" name="amount_paid" type="number" min="0" step="0.01"
                className="input-field" style={{ paddingLeft: '2.5rem' }}
                placeholder="0,00 — deixe vazio se não houver desconto"
                value={form.amount_paid}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Comprovante */}
          <div>
            <label className="label">
              <Upload size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
              {ticket.payment_proof ? 'Substituir Comprovante' : 'Adicionar Comprovante'}
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-primary)', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-light)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxHeight: 100, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
              ) : file ? (
                <p style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.85rem' }}>📄 {file.name}</p>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {ticket.payment_proof ? '🔄 Clique para substituir o comprovante atual' : 'Clique para selecionar imagem ou PDF'}
                </p>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            {file && (
              <button type="button" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remover seleção
              </button>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.7rem 1rem', color: 'var(--red)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={handleSave} className="btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <><Save size={15} /> Salvar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function BilhetesPage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filtered, setFiltered] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: raffleData } = await supabase
        .from('raffles').select('*')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (raffleData) {
        setRaffle(raffleData)
        const { data: ticketData } = await supabase
          .from('tickets').select('*').eq('raffle_id', raffleData.id)
          .order('ticket_number', { ascending: true })
        setTickets(ticketData || [])
        setFiltered(ticketData || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let result = tickets
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.buyer_name.toLowerCase().includes(q) ||
        t.buyer_doc.toLowerCase().includes(q) ||
        t.buyer_contact.toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q)
      )
    }
    setFiltered(result)
  }, [search, statusFilter, tickets])

  async function viewProof(path: string) {
    setProofLoading(true)
    const supabase = createClient()
    const { data } = await supabase.storage.from('comprovantes').createSignedUrl(path, 120)
    if (data?.signedUrl) setProofUrl(data.signedUrl)
    setProofLoading(false)
  }

  async function deleteTicket(ticket: Ticket) {
    if (!confirm(`Excluir o bilhete #${String(ticket.ticket_number).padStart(3, '0')} de ${ticket.buyer_name}?`)) return
    const supabase = createClient()
    await supabase.from('tickets').delete().eq('id', ticket.id)
    setTickets(prev => prev.filter(t => t.id !== ticket.id))
  }

  function handleSaved(updated: Ticket) {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )

  return (
    <div className="fade-in">
      {/* Edit Modal */}
      {editingTicket && (
        <EditModal
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSaved={handleSaved}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Bilhetes Vendidos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {raffle?.title} — {filtered.length} de {tickets.length} bilhetes
          </p>
        </div>
        <Link href="/admin/bilhetes/registrar" className="btn-primary">+ Registrar Bilhete</Link>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" className="input-field" style={{ paddingLeft: '2.2rem' }}
            placeholder="Buscar por nome, CPF, contato ou número..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ position: 'relative' }}>
          <select className="input-field" style={{ paddingRight: '2rem', appearance: 'none', cursor: 'pointer' }}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            <option value="paid">Pagos</option>
            <option value="reserved">Reservados</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Tabela */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Comprador</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Recebido</th>
                <th>Comprovante</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {search || statusFilter !== 'all' ? 'Nenhum resultado encontrado.' : 'Nenhum bilhete registrado ainda.'}
                  </td>
                </tr>
              )}
              {filtered.map(ticket => (
                <tr key={ticket.id}>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    #{String(ticket.ticket_number).padStart(3, '0')}
                    {raffle?.drawn_ticket === ticket.ticket_number && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>🏆</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ticket.buyer_name}</td>
                  <td>{ticket.buyer_doc}</td>
                  <td>{ticket.buyer_contact}</td>
                  <td>
                    <span className={`badge badge-${ticket.status}`}>
                      {ticket.status === 'paid' ? 'Pago' : ticket.status === 'reserved' ? 'Reservado' : 'Cancelado'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {ticket.amount_paid != null
                      ? <span style={{ color: 'var(--green)' }}>{ticket.amount_paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td>
                    {ticket.payment_proof ? (
                      <button onClick={() => viewProof(ticket.payment_proof!)}
                        className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>
                        {proofLoading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><FileText size={13} /> Ver</>}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => setEditingTicket(ticket)}
                        className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                        title="Editar dados do comprador">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteTicket(ticket)}
                        className="btn-danger" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                        title="Excluir bilhete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Modal */}
      {proofUrl && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setProofUrl(null)}
        >
          <div className="glass-card" style={{ maxWidth: 700, width: '100%', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Comprovante de Pagamento</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                  <ExternalLink size={13} /> Abrir
                </a>
                <button onClick={() => setProofUrl(null)} className="btn-danger" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>Fechar</button>
              </div>
            </div>
            <img src={proofUrl} alt="Comprovante" style={{ width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: '70vh' }}
              onError={() => window.open(proofUrl, '_blank')} />
          </div>
        </div>
      )}
    </div>
  )
}
