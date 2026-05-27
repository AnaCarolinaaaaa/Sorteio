'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Raffle, Ticket } from '@/lib/types'
import { Trophy, Ticket as TicketIcon, Users, TrendingUp, Copy, Check, X, Upload, ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  // Estados para a compra/reserva interativa (mobile)
  const [selectedTickets, setSelectedTickets] = useState<number[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1) // 1: Form, 2: Pix/Comprovante, 3: Sucesso
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    buyer_name: '',
    buyer_doc: '',
    buyer_contact: '',
  })
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // Busca o sorteio mais recente ativo
      const { data: raffleData } = await supabase
        .from('raffles')
        .select('*')
        .in('status', ['open', 'closed', 'drawn'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (raffleData) {
        setRaffle(raffleData)
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('*')
          .eq('raffle_id', raffleData.id)
        setTickets(ticketData || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  if (!raffle) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <Trophy size={56} color="var(--text-muted)" />
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Nenhum sorteio ativo no momento.</p>
        <Link href="/admin" className="btn-secondary">Área Administrativa</Link>
      </div>
    )
  }

  const soldTickets = tickets.filter(t => t.status === 'paid').length
  const reservedTickets = tickets.filter(t => t.status === 'reserved').length
  const progress = (soldTickets / raffle.total_tickets) * 100
  const ticketPrice = raffle.ticket_price || 0
  const totalValue = selectedTickets.length * ticketPrice

  const getTicketStatus = (num: number) => {
    const t = tickets.find(t => t.ticket_number === num)
    if (!t) return 'available'
    return t.status
  }

  const getTicketClass = (num: number) => {
    if (raffle.drawn_ticket === num) return 'ticket-cell ticket-winner'
    if (selectedTickets.includes(num)) return 'ticket-cell ticket-selected'
    const s = getTicketStatus(num)
    const map: Record<string, string> = {
      available: 'ticket-cell ticket-available',
      paid: 'ticket-cell ticket-paid',
      reserved: 'ticket-cell ticket-reserved',
      cancelled: 'ticket-cell ticket-cancelled',
    }
    return map[s] || 'ticket-cell ticket-available'
  }

  const handleTicketClick = (num: number) => {
    if (raffle.status !== 'open') return
    const status = getTicketStatus(num)
    if (status !== 'available') return

    setSelectedTickets(prev =>
      prev.includes(num)
        ? prev.filter(n => n !== num)
        : [...prev, num].sort((a, b) => a - b)
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setFile(null)
      setPreview(null)
    }
  }

  const handleNextStep = () => {
    if (!form.buyer_name || !form.buyer_doc || !form.buyer_contact) {
      setError('Por favor, preencha todos os campos.')
      return
    }
    setError('')
    setCheckoutStep(2)
  }

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTickets.length === 0 || !raffle) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    let payment_proof: string | null = null

    // 1. Upload do comprovante, se houver
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${raffle.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(path, file, { upsert: true })

      if (uploadError) {
        setSubmitting(false)
        setError(`Erro no upload: ${uploadError.message}`)
        return
      }
      payment_proof = path
    }

    // 2. Insere os registros de bilhetes com status reserved
    const rows = selectedTickets.map(num => ({
      raffle_id: raffle.id,
      ticket_number: num,
      buyer_name: form.buyer_name.trim(),
      buyer_doc: form.buyer_doc.trim(),
      buyer_contact: form.buyer_contact.trim(),
      payment_proof,
      amount_paid: null,
      status: 'reserved',
    }))

    const { error: dbError } = await supabase.from('tickets').insert(rows)

    if (dbError) {
      if (dbError.code === '23505') {
        setError('⚠️ Um ou mais bilhetes que você selecionou já foram comprados ou reservados por outra pessoa. Por favor, recarregue a página e selecione outros números.')
      } else {
        setError('Erro ao concluir reserva: ' + dbError.message)
      }
      setSubmitting(false)
    } else {
      // Recarrega bilhetes da UI local
      const { data: updatedTickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', raffle.id)
      setTickets(updatedTickets || [])

      setCheckoutStep(3)
      setSubmitting(false)
    }
  }

  const resetSelection = () => {
    setSelectedTickets([])
    setCheckoutOpen(false)
    setCheckoutStep(1)
    setForm({ buyer_name: '', buyer_doc: '', buyer_contact: '' })
    setFile(null)
    setPreview(null)
    setError('')
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '0 0 6rem', position: 'relative' }}>
      
      {/* CSS adicional scoped para Mobile / Animacoes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .mobile-bottom-sheet {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            max-width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            animation: slideUpMobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
            transform: translateY(0);
          }
          .ticket-grid {
            grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)) !important;
            gap: 4px !important;
          }
          .ticket-cell {
            font-size: 0.65rem !important;
          }
        }
        @keyframes slideUpMobile {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}} />

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Trophy size={22} color="var(--gold)" />
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>Sorteio Virtual</span>
        </div>
        <Link href="/admin" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
          Painel Admin
        </Link>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem' }}>
        
        {/* Prize Hero */}
        <div className="glass-card glow-accent fade-in" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 65%)',
            pointerEvents: 'none'
          }} />
          {raffle.prize_image && (
            <img
              src={raffle.prize_image}
              alt={raffle.prize}
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 16, marginBottom: '1.25rem', border: '3px solid var(--gold)', boxShadow: '0 0 32px rgba(245,158,11,0.3)' }}
            />
          )}
          {!raffle.prize_image && (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', border: '2px solid var(--gold)' }}>
              <Trophy size={36} color="var(--gold)" />
            </div>
          )}
          <span className={`badge ${raffle.status === 'open' ? 'badge-open' : raffle.status === 'closed' ? 'badge-closed' : 'badge-drawn'}`} style={{ marginBottom: '0.75rem' }}>
            {raffle.status === 'open' ? '🟢 Aberto para Reservas' : raffle.status === 'closed' ? '🟡 Encerrado' : '🏆 Realizado'}
          </span>
          <h1 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', lineHeight: 1.2 }}>
            {raffle.title}
          </h1>
          {raffle.description && (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: 500, margin: '0 auto 1rem', fontSize: '0.9rem' }}>
              {raffle.description}
            </p>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-elevated)', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
            <Trophy size={14} color="var(--gold)" />
            <span style={{ color: 'var(--gold-light)', fontWeight: 700, fontSize: '0.85rem' }}>Prêmio: {raffle.prize}</span>
          </div>
        </div>

        {/* Sorteado Banner */}
        {raffle.status === 'drawn' && raffle.drawn_ticket && (
          <div className="glass-card glow-gold fade-in" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid rgba(245,158,11,0.4)', background: 'radial-gradient(circle at top, rgba(245,158,11,0.1) 0%, rgba(10,5,20,0.6) 100%)' }}>
            <p style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>🏆 NÚMERO GANHADOR 🏆</p>
            <div style={{ fontSize: '4.5rem', fontWeight: 900, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.5rem', textShadow: '0 0 15px rgba(245,158,11,0.4)' }}>
              #{String(raffle.drawn_ticket).padStart(3, '0')}
            </div>
            {raffle.drawn_at && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Sorteio concluído em {new Date(raffle.drawn_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { icon: <TicketIcon size={16} />, label: 'Bilhetes', value: raffle.total_tickets, color: 'var(--accent-light)' },
            { icon: <Users size={16} />, label: 'Pagos', value: soldTickets, color: 'var(--green)' },
            { icon: <TrendingUp size={16} />, label: 'Reservados', value: reservedTickets, color: 'var(--gold)' },
            { icon: <TicketIcon size={16} />, label: 'Disponíveis', value: raffle.total_tickets - soldTickets - reservedTickets, color: 'var(--text-muted)' },
          ].map((stat, i) => (
            <div key={i} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ color: stat.color, opacity: 0.8 }}>{stat.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Progresso de Vendas</span>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)' }}>{progress.toFixed(1)}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--gold))', borderRadius: 4, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {/* Ticket Selector Grid */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Selecione seus Bilhetes
              </h2>
              {raffle.status === 'open' && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                  {ticketPrice > 0 ? `${formatBRL(ticketPrice)} cada número` : 'Reserva de números'}
                </p>
              )}
            </div>
            {selectedTickets.length > 0 && (
              <button onClick={() => setSelectedTickets([])} className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 6 }}>
                Limpar
              </button>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            {[
              { cls: 'ticket-cell ticket-available', label: 'Disponível' },
              { cls: 'ticket-cell ticket-selected', label: 'Selecionado' },
              { cls: 'ticket-cell ticket-paid', label: 'Pago' },
              { cls: 'ticket-cell ticket-reserved', label: 'Reservado' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div className={l.cls} style={{ width: 18, height: 18, fontSize: '0.4rem', cursor: 'default' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {raffle.status !== 'open' ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              Este sorteio não está aberto para novas compras ou reservas.
            </div>
          ) : (
            <div className="ticket-grid">
              {Array.from({ length: raffle.total_tickets }, (_, i) => i + 1).map(num => (
                <div
                  key={num}
                  className={getTicketClass(num)}
                  onClick={() => handleTicketClick(num)}
                  style={{
                    cursor: getTicketStatus(num) === 'available' ? 'pointer' : 'not-allowed',
                    userSelect: 'none'
                  }}
                  title={`Bilhete #${String(num).padStart(3, '0')}`}
                >
                  {String(num).padStart(3, '0')}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Drawer / Action Bar */}
      {selectedTickets.length > 0 && raffle.status === 'open' && !checkoutOpen && (
        <div className="fade-in" style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '540px',
          background: 'rgba(19, 19, 26, 0.95)',
          border: '1px solid var(--accent-light)',
          boxShadow: '0 10px 30px rgba(124, 58, 237, 0.4)',
          borderRadius: 16,
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 9999,
          backdropFilter: 'blur(12px)',
        }}>
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedTickets.length} {selectedTickets.length === 1 ? 'bilhete selecionado' : 'bilhetes selecionados'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 600 }}>
              Números: {selectedTickets.map(n => `#${String(n).padStart(3, '0')}`).join(', ')}
            </p>
          </div>
          <button
            onClick={() => setCheckoutOpen(true)}
            className="btn-gold"
            style={{
              padding: '0.6rem 1.2rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: 10
            }}
          >
            Reservar por {formatBRL(totalValue)}
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Checkout Modal / Drawer */}
      {checkoutOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 8, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 99999,
        }}>
          <div className="glass-card slide-up mobile-bottom-sheet" style={{
            width: '100%',
            maxWidth: '480px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {checkoutStep === 3 ? 'Reserva Efetuada!' : 'Reserva de Bilhete(s)'}
                </h3>
                {checkoutStep !== 3 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                    {selectedTickets.length} bilhete(s) por {formatBRL(totalValue)}
                  </p>
                )}
              </div>
              {checkoutStep !== 3 && !submitting && (
                <button
                  onClick={() => setCheckoutOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Content Body */}
            <div style={{ padding: '1.5rem', flex: 1 }}>
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  color: 'var(--red)',
                  fontSize: '0.82rem',
                  marginBottom: '1.25rem',
                  lineHeight: '1.4'
                }}>
                  {error}
                </div>
              )}

              {/* PASSO 1: Formulário de Identificação */}
              {checkoutStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{
                    background: 'rgba(124, 58, 237, 0.05)',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    borderRadius: 12,
                    padding: '0.9rem',
                  }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Números Selecionados</p>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-light)' }}>
                      {selectedTickets.map(n => `#${String(n).padStart(3, '0')}`).join(', ')}
                    </p>
                  </div>

                  <div>
                    <label className="label" htmlFor="buyer_name">Nome Completo</label>
                    <input
                      id="buyer_name"
                      name="buyer_name"
                      type="text"
                      className="input-field"
                      placeholder="Seu nome completo"
                      value={form.buyer_name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="buyer_doc">CPF (Apenas números)</label>
                    <input
                      id="buyer_doc"
                      name="buyer_doc"
                      type="text"
                      maxLength={11}
                      className="input-field"
                      placeholder="Ex: 12345678901"
                      value={form.buyer_doc}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="buyer_contact">WhatsApp / Celular</label>
                    <input
                      id="buyer_contact"
                      name="buyer_contact"
                      type="text"
                      className="input-field"
                      placeholder="Ex: (11) 99999-9999"
                      value={form.buyer_contact}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="btn-primary"
                    style={{ justifyContent: 'center', padding: '0.85rem', width: '100%', marginTop: '0.5rem' }}
                  >
                    Avançar para o Pagamento
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* PASSO 2: PIX e Upload de Comprovante */}
              {checkoutStep === 2 && (
                <form onSubmit={handleSubmitCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Valor a Pagar</p>
                    <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--gold)' }}>{formatBRL(totalValue)}</p>
                  </div>

                  {/* Chave PIX Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '1rem',
                  }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', textAlign: 'center' }}>Chave Pix para Transferência</p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-primary)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}>
                      <code style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>
                        sorteioapp@pix.com.br
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('sorteioapp@pix.com.br')
                          alert('Chave Pix copiada com sucesso!')
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Copy size={16} color="var(--text-secondary)" />
                      </button>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'center' }}>Tipo: E-mail · Nome: Sorteio App</p>
                  </div>

                  {/* Upload do comprovante */}
                  <div>
                    <label className="label">Comprovante de Pagamento</label>
                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: 12,
                        padding: '1.25rem 1rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255, 255, 255, 0.01)',
                        transition: 'border-color 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-light)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      
                      {!preview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                          <Upload size={24} color="var(--text-muted)" />
                          <p style={{ fontSize: '0.78rem', fontWeight: 600 }}>Clique para anexar o comprovante (imagem)</p>
                          <p style={{ fontSize: '0.68rem' }}>Formatos suportados: PNG, JPG, JPEG</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <img
                            src={preview}
                            alt="Comprovante"
                            style={{ maxHeight: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
                          />
                          <p style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600 }}>Comprovante selecionado com sucesso!</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setCheckoutStep(1)}
                      className="btn-secondary"
                      style={{ flex: 1, justifyContent: 'center', padding: '0.85rem' }}
                    >
                      <ArrowLeft size={16} />
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-gold"
                      style={{ flex: 2, justifyContent: 'center', padding: '0.85rem' }}
                    >
                      {submitting ? (
                        <>
                          <div className="spinner" style={{ width: 16, height: 16 }} />
                          Enviando...
                        </>
                      ) : (
                        <>
                          Confirmar Pagamento
                          <Check size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* PASSO 3: Sucesso */}
              {checkoutStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.25rem', padding: '1rem 0' }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '2px solid var(--green)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                  }}>
                    <Check size={32} color="var(--green)" />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Reserva Confirmada!</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Seus bilhetes foram reservados com sucesso. O administrador irá conferir o comprovante e validar o status como **Pago**.
                    </p>
                  </div>

                  <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '1rem',
                    width: '100%',
                  }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Bilhetes Reservados</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gold)', letterSpacing: '0.05em' }}>
                      {selectedTickets.map(n => `#${String(n).padStart(3, '0')}`).join(', ')}
                    </p>
                  </div>

                  <button
                    onClick={resetSelection}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', marginTop: '0.5rem' }}
                  >
                    Voltar para o Início
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
