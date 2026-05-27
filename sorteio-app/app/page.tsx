'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Raffle, Ticket } from '@/lib/types'
import { Trophy, Ticket as TicketIcon, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // Busca o sorteio mais recente que não esteja cancelado
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

  const getTicketStatus = (num: number) => {
    const t = tickets.find(t => t.ticket_number === num)
    if (!t) return 'available'
    return t.status
  }

  const getTicketClass = (num: number) => {
    if (raffle.drawn_ticket === num) return 'ticket-cell ticket-winner'
    const s = getTicketStatus(num)
    const map: Record<string, string> = {
      available: 'ticket-cell ticket-available',
      paid: 'ticket-cell ticket-paid',
      reserved: 'ticket-cell ticket-reserved',
      cancelled: 'ticket-cell ticket-cancelled',
    }
    return map[s] || 'ticket-cell ticket-available'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '0 0 4rem' }}>
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
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Sorteio</span>
        </div>
        <Link href="/admin" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
          Admin
        </Link>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Prize Hero */}
        <div className="glass-card glow-accent fade-in" style={{ padding: '2.5rem', marginBottom: '2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 65%)',
            pointerEvents: 'none'
          }} />
          {raffle.prize_image && (
            <img
              src={raffle.prize_image}
              alt={raffle.prize}
              style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 16, marginBottom: '1.5rem', border: '3px solid var(--gold)', boxShadow: '0 0 32px rgba(245,158,11,0.4)' }}
            />
          )}
          {!raffle.prize_image && (
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '3px solid var(--gold)' }}>
              <Trophy size={44} color="var(--gold)" />
            </div>
          )}
          <span className={`badge ${raffle.status === 'open' ? 'badge-open' : raffle.status === 'closed' ? 'badge-closed' : 'badge-drawn'}`} style={{ marginBottom: '0.75rem' }}>
            {raffle.status === 'open' ? '🟢 Aberto' : raffle.status === 'closed' ? '🟡 Encerrado' : '🏆 Sorteado'}
          </span>
          <h1 className="gradient-text" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: '0.5rem', lineHeight: 1.2 }}>
            {raffle.title}
          </h1>
          {raffle.description && (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: 540, margin: '0 auto 1rem' }}>
              {raffle.description}
            </p>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-elevated)', padding: '0.6rem 1.2rem', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)' }}>
            <Trophy size={16} color="var(--gold)" />
            <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{raffle.prize}</span>
          </div>
        </div>

        {/* Resultado do Sorteio */}
        {raffle.status === 'drawn' && raffle.drawn_ticket && (
          <div className="glass-card glow-gold fade-in" style={{ padding: '2.5rem', marginBottom: '2rem', textAlign: 'center', border: '1px solid rgba(245,158,11,0.4)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>🎉 Bilhete Sorteado</p>
            <div style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 900, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.5rem' }}>
              #{String(raffle.drawn_ticket).padStart(3, '0')}
            </div>
            {raffle.drawn_at && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Sorteado em {new Date(raffle.drawn_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: <TicketIcon size={18} />, label: 'Total de Bilhetes', value: raffle.total_tickets, color: 'var(--accent-light)' },
            { icon: <Users size={18} />, label: 'Vendidos', value: soldTickets, color: 'var(--green)' },
            { icon: <TrendingUp size={18} />, label: 'Reservados', value: reservedTickets, color: 'var(--gold)' },
            { icon: <TicketIcon size={18} />, label: 'Disponíveis', value: raffle.total_tickets - soldTickets - reservedTickets, color: 'var(--text-muted)' },
          ].map((stat, i) => (
            <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ color: stat.color }}>{stat.icon}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Progresso de vendas</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{progress.toFixed(1)}%</span>
          </div>
          <div style={{ height: 10, background: 'var(--bg-primary)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--gold))', borderRadius: 5, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {/* Ticket Grid */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
            Grade de Bilhetes
          </h2>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { cls: 'ticket-cell ticket-available', label: 'Disponível' },
              { cls: 'ticket-cell ticket-paid', label: 'Pago' },
              { cls: 'ticket-cell ticket-reserved', label: 'Reservado' },
              { cls: 'ticket-cell ticket-winner', label: 'Sorteado' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div className={l.cls} style={{ width: 24, height: 24, fontSize: '0.5rem', cursor: 'default' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div className="ticket-grid">
            {Array.from({ length: raffle.total_tickets }, (_, i) => i + 1).map(num => (
              <div key={num} className={getTicketClass(num)} title={`Bilhete #${String(num).padStart(3,'0')}`}>
                {String(num).padStart(3, '0')}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
