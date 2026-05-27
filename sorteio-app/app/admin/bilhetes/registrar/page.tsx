'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Raffle } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, User, FileText, Phone, Loader2, X, Plus } from 'lucide-react'
import Link from 'next/link'

export default function RegistrarBilhetePage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [takenNumbers, setTakenNumbers] = useState<number[]>([])
  const [selectedTickets, setSelectedTickets] = useState<number[]>([])
  const [ticketInput, setTicketInput] = useState('')
  const [form, setForm] = useState({
    buyer_name: '', buyer_doc: '', buyer_contact: '',
    status: 'paid' as 'paid' | 'reserved',
    amount_paid: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: raffleData } = await supabase
        .from('raffles').select('*')
        .in('status', ['open', 'closed'])
        .order('created_at', { ascending: false })
        .limit(1).single()

      if (raffleData) {
        setRaffle(raffleData)
        const { data: ticketData } = await supabase
          .from('tickets').select('ticket_number')
          .eq('raffle_id', raffleData.id)
          .in('status', ['paid', 'reserved'])
        setTakenNumbers((ticketData || []).map((t: { ticket_number: number }) => t.ticket_number))
      }
      setPageLoading(false)
    }
    load()
  }, [])

  function addTicket() {
    const num = parseInt(ticketInput)
    if (!raffle) return
    if (isNaN(num) || num < 1 || num > raffle.total_tickets) {
      setError(`Número inválido. Use entre 1 e ${raffle.total_tickets}.`)
      return
    }
    if (takenNumbers.includes(num)) {
      setError(`Bilhete #${String(num).padStart(3, '0')} já está registrado.`)
      return
    }
    if (selectedTickets.includes(num)) {
      setError(`Bilhete #${String(num).padStart(3, '0')} já adicionado.`)
      return
    }
    setSelectedTickets(prev => [...prev, num].sort((a, b) => a - b))
    setTicketInput('')
    setError('')
  }

  function removeTicket(num: number) {
    setSelectedTickets(prev => prev.filter(n => n !== num))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!raffle) return
    if (selectedTickets.length === 0) {
      setError('Adicione ao menos um número de bilhete.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Upload do comprovante (único para todos os bilhetes do lote)
    let payment_proof: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${raffle.id}/lote_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('comprovantes').upload(path, file, { upsert: true })
      if (uploadError) {
        setLoading(false)
        setError(`⚠️ Erro no upload do comprovante: ${uploadError.message}. Verifique as permissões do bucket no Supabase.`)
        return
      }
      payment_proof = path
    }

    // Valor real recebido: distribuído proporcionalmente por bilhete
    const totalPaid = parseFloat(form.amount_paid) || null
    const perTicket = totalPaid !== null ? parseFloat((totalPaid / selectedTickets.length).toFixed(2)) : null

    // Insere um registro por bilhete selecionado
    const rows = selectedTickets.map(num => ({
      raffle_id: raffle.id,
      ticket_number: num,
      buyer_name: form.buyer_name.trim(),
      buyer_doc: form.buyer_doc.trim(),
      buyer_contact: form.buyer_contact.trim(),
      payment_proof,
      amount_paid: perTicket,
      status: form.status,
    }))

    const { error: dbError } = await supabase.from('tickets').insert(rows)

    if (dbError) {
      setError('Erro ao registrar: ' + dbError.message)
    } else {
      const nums = selectedTickets.map(n => `#${String(n).padStart(3, '0')}`).join(', ')
      setSuccess(`✅ ${selectedTickets.length} bilhete(s) registrado(s): ${nums}`)
      setTakenNumbers(prev => [...prev, ...selectedTickets])
      setSelectedTickets([])
      setForm({ buyer_name: '', buyer_doc: '', buyer_contact: '', status: 'paid', amount_paid: '' })
      setFile(null); setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    }
    setLoading(false)
  }

  if (pageLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )

  if (!raffle) return (
    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Nenhum sorteio ativo.</p>
      <Link href="/admin/sorteios/novo" className="btn-primary">Criar Sorteio</Link>
    </div>
  )

  const ticketPrice = raffle.ticket_price || 0
  const totalValue = selectedTickets.length * ticketPrice
  const amountPaid = parseFloat(form.amount_paid) || 0
  const discount = totalValue > 0 && amountPaid > 0 ? totalValue - amountPaid : 0
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/admin/dashboard" className="btn-secondary" style={{ padding: '0.5rem 0.9rem' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Registrar Bilhete(s)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {raffle.title}
            {ticketPrice > 0 && ` · ${ticketPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por bilhete`}
          </p>
        </div>
      </div>

      {success && (
        <div style={{ marginBottom: '1.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '1rem 1.25rem', color: 'var(--green)', fontWeight: 600, fontSize: '0.9rem' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* === SELEÇÃO DE BILHETES === */}
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
            Números dos Bilhetes
          </p>

          {/* Input + botão adicionar */}
          <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <input
              type="number" min="1" max={raffle.total_tickets}
              className="input-field" style={{ flex: 1 }}
              placeholder={`Número (1 a ${raffle.total_tickets})`}
              value={ticketInput}
              onChange={e => setTicketInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTicket() } }}
            />
            <button type="button" className="btn-primary" onClick={addTicket} style={{ flexShrink: 0 }}>
              <Plus size={16} /> Adicionar
            </button>
          </div>

          {/* Tags dos bilhetes selecionados */}
          {selectedTickets.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.85rem', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)' }}>
              {selectedTickets.map(num => (
                <div key={num} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.3rem 0.65rem', borderRadius: 999,
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(167,139,250,0.4)',
                  color: 'var(--accent-light)', fontWeight: 700, fontSize: '0.85rem'
                }}>
                  #{String(num).padStart(3, '0')}
                  <button type="button" onClick={() => removeTicket(num)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', display: 'flex', padding: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-primary)', borderRadius: 10, border: '1px dashed var(--border)' }}>
              Nenhum bilhete adicionado ainda
            </div>
          )}

          {/* Resumo do lote */}
          {selectedTickets.length > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {selectedTickets.length} bilhete(s) selecionado(s)
                </span>
                {ticketPrice > 0 && (
                  <span style={{ fontWeight: 700, color: amountPaid > 0 && amountPaid < totalValue ? 'var(--gold)' : 'var(--green)', fontSize: '0.95rem' }}>
                    {amountPaid > 0 ? fmtBRL(amountPaid) : fmtBRL(totalValue)}
                  </span>
                )}
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valor cheio: {fmtBRL(totalValue)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600 }}>Desconto: -{fmtBRL(discount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Valor recebido */}
          <div style={{ marginTop: '0.75rem' }}>
            <label className="label" htmlFor="amount_paid">Valor Total Recebido (R$)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>R$</span>
              <input
                id="amount_paid" name="amount_paid" type="number" min="0" step="0.01"
                className="input-field" style={{ paddingLeft: '2.5rem' }}
                placeholder={ticketPrice > 0 ? `Cheio: ${fmtBRL(totalValue)}` : 'Ex: 45,00'}
                value={form.amount_paid}
                onChange={handleChange}
              />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Deixe em branco se não houver desconto.
              {ticketPrice > 0 && selectedTickets.length > 0 && ` Valor cheio: ${fmtBRL(totalValue)}.`}
            </p>
          </div>

          {/* Status */}
          <div style={{ marginTop: '0.5rem' }}>
            <label className="label" htmlFor="status">Status dos Bilhetes</label>
            <select id="status" name="status" className="input-field" value={form.status} onChange={handleChange}>
              <option value="paid">Pago ✅</option>
              <option value="reserved">Reservado ⏳</option>
            </select>
          </div>
        </div>

        {/* === DADOS DO COMPRADOR === */}
        <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Dados do Comprador
          </p>

          <div>
            <label className="label" htmlFor="buyer_name">
              <User size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />Nome Completo *
            </label>
            <input id="buyer_name" name="buyer_name" type="text" className="input-field"
              placeholder="Nome do comprador..." value={form.buyer_name} onChange={handleChange} required />
          </div>

          <div>
            <label className="label" htmlFor="buyer_doc">
              <FileText size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />CPF / Documento *
            </label>
            <input id="buyer_doc" name="buyer_doc" type="text" className="input-field"
              placeholder="000.000.000-00" value={form.buyer_doc} onChange={handleChange} required />
          </div>

          <div>
            <label className="label" htmlFor="buyer_contact">
              <Phone size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />Telefone / WhatsApp / E-mail *
            </label>
            <input id="buyer_contact" name="buyer_contact" type="text" className="input-field"
              placeholder="(11) 99999-9999" value={form.buyer_contact} onChange={handleChange} required />
          </div>

          {/* Upload comprovante */}
          <div>
            <label className="label">
              <Upload size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />Comprovante de Pagamento
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '1.25rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-primary)', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-light)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
              ) : file ? (
                <div style={{ color: 'var(--green)', fontWeight: 600 }}>📄 {file.name}</div>
              ) : (
                <>
                  <Upload size={20} color="var(--text-muted)" style={{ marginBottom: '0.4rem' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Clique para selecionar imagem ou PDF</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            {file && (
              <button type="button" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remover arquivo
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--red)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading || selectedTickets.length === 0} style={{ justifyContent: 'center', padding: '0.85rem' }}>
          {loading
            ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Registrando...</>
            : `Registrar ${selectedTickets.length > 0 ? selectedTickets.length + ' bilhete(s)' : 'Bilhete(s)'}`
          }
        </button>
      </form>
    </div>
  )
}
