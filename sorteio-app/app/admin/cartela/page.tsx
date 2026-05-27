'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Raffle, Ticket } from '@/lib/types'
import { Search, Grid3X3, RefreshCw, Trophy } from 'lucide-react'
import Link from 'next/link'

type TicketMap = Record<number, Ticket>

export default function CartelaPage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [ticketMap, setTicketMap] = useState<TicketMap>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'available' | 'paid' | 'reserved'>('all')
  const [hoveredTicket, setHoveredTicket] = useState<number | null>(null)
  const [tooltipData, setTooltipData] = useState<{ ticket: Ticket; x: number; y: number } | null>(null)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: raffleData } = await supabase
      .from('raffles').select('*')
      .order('created_at', { ascending: false }).limit(1).single()

    if (raffleData) {
      setRaffle(raffleData)
      const { data: ticketData } = await supabase
        .from('tickets').select('*').eq('raffle_id', raffleData.id)
      const map: TicketMap = {}
      for (const t of ticketData || []) map[t.ticket_number] = t
      setTicketMap(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const getStatus = (num: number) => {
    const t = ticketMap[num]
    if (!t) return 'available'
    if (t.status === 'cancelled') return 'available'
    return t.status
  }

  // Stats
  const stats = useMemo(() => {
    if (!raffle) return { paid: 0, reserved: 0, available: 0 }
    const paid = Object.values(ticketMap).filter(t => t.status === 'paid').length
    const reserved = Object.values(ticketMap).filter(t => t.status === 'reserved').length
    return { paid, reserved, available: raffle.total_tickets - paid - reserved }
  }, [raffle, ticketMap])

  // Filtered numbers
  const numbers = useMemo(() => {
    if (!raffle) return []
    const all = Array.from({ length: raffle.total_tickets }, (_, i) => i + 1)
    const q = search.trim()

    return all.filter(num => {
      const status = getStatus(num)
      if (filter !== 'all' && status !== filter) return false
      if (q) {
        if (String(num).includes(q)) return true
        const t = ticketMap[num]
        if (t && t.buyer_name.toLowerCase().includes(q.toLowerCase())) return true
        return false
      }
      return true
    })
  }, [raffle, ticketMap, filter, search])

  const cellStyle = (num: number): React.CSSProperties => {
    const status = getStatus(num)
    const isWinner = raffle?.drawn_ticket === num
    const isHovered = hoveredTicket === num

    const base: React.CSSProperties = {
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 'clamp(0.55rem, 1.5vw, 0.8rem)',
      cursor: status !== 'available' ? 'pointer' : 'default',
      transition: 'transform 0.1s, box-shadow 0.1s',
      transform: isHovered && status !== 'available' ? 'scale(1.12)' : 'scale(1)',
      border: '1px solid',
      userSelect: 'none',
      position: 'relative',
    }

    if (isWinner) return {
      ...base,
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: '#1a1200',
      borderColor: '#f59e0b',
      boxShadow: '0 0 16px rgba(245,158,11,0.7)',
      animation: 'pulse-gold 1.5s ease-in-out infinite',
      zIndex: 2,
    }

    switch (status) {
      case 'paid': return {
        ...base,
        background: isHovered ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.18)',
        color: '#fca5a5',
        borderColor: isHovered ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.5)',
        boxShadow: isHovered ? '0 0 10px rgba(239,68,68,0.4)' : 'none',
      }
      case 'reserved': return {
        ...base,
        background: isHovered ? 'rgba(234,179,8,0.3)' : 'rgba(234,179,8,0.15)',
        color: '#fde047',
        borderColor: isHovered ? 'rgba(234,179,8,0.8)' : 'rgba(234,179,8,0.45)',
        boxShadow: isHovered ? '0 0 10px rgba(234,179,8,0.35)' : 'none',
      }
      default: return {
        ...base,
        background: isHovered ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)',
        color: '#6ee7b7',
        borderColor: isHovered ? 'rgba(16,185,129,0.7)' : 'rgba(16,185,129,0.3)',
      }
    }
  }

  function handleMouseEnter(e: React.MouseEvent, num: number) {
    setHoveredTicket(num)
    const t = ticketMap[num]
    if (t && t.status !== 'cancelled') {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setTooltipData({ ticket: t, x: rect.left + rect.width / 2, y: rect.top })
    }
  }

  function handleMouseLeave() {
    setHoveredTicket(null)
    setTooltipData(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  )

  if (!raffle) return (
    <div style={{ textAlign: 'center', marginTop: '5rem' }}>
      <Grid3X3 size={52} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Nenhum sorteio encontrado.</p>
      <Link href="/admin/sorteios/novo" className="btn-primary">Criar Sorteio</Link>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Tooltip global */}
      {tooltipData && (
        <div style={{
          position: 'fixed',
          left: tooltipData.x,
          top: tooltipData.y - 8,
          transform: 'translate(-50%, -100%)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '0.6rem 0.9rem',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: 180,
          maxWidth: 240,
        }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
            #{String(tooltipData.ticket.ticket_number).padStart(3, '0')} — {tooltipData.ticket.status === 'paid' ? '🔴 Vendido' : '🟡 Reservado'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{tooltipData.ticket.buyer_name}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{tooltipData.ticket.buyer_contact}</p>
          {tooltipData.ticket.amount_paid != null && (
            <p style={{ color: 'var(--green)', fontSize: '0.72rem', fontWeight: 600, marginTop: '0.2rem' }}>
              {tooltipData.ticket.amount_paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Grid3X3 size={22} color="var(--accent-light)" /> Cartela de Bilhetes
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{raffle.title}</p>
        </div>
        <button onClick={load} className="btn-secondary" style={{ padding: '0.5rem 0.9rem' }}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: raffle.total_tickets, color: 'var(--accent-light)', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
          { label: 'Vendidos', value: stats.paid, color: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
          { label: 'Reservados', value: stats.reserved, color: '#fde047', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)' },
          { label: 'Disponíveis', value: stats.available, color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Legenda + Filtros */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Legenda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            { color: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.5)', text: '#fca5a5', label: 'Vendido' },
            { color: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.45)', text: '#fde047', label: 'Reservado' },
            { color: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7', label: 'Disponível' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: l.color, border: `1px solid ${l.border}` }} />
              <span style={{ color: l.text, fontSize: '0.8rem', fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
          {raffle.drawn_ticket && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: '1px solid #f59e0b' }} />
              <span style={{ color: '#fcd34d', fontSize: '0.8rem', fontWeight: 600 }}>Sorteado 🏆</span>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" className="input-field"
              style={{ paddingLeft: '1.9rem', padding: '0.45rem 0.75rem 0.45rem 1.9rem', fontSize: '0.82rem' }}
              placeholder="Número ou nome..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          {(['all', 'paid', 'reserved', 'available'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
                background: filter === f
                  ? f === 'paid' ? 'rgba(239,68,68,0.2)' : f === 'reserved' ? 'rgba(234,179,8,0.2)' : f === 'available' ? 'rgba(16,185,129,0.2)' : 'var(--accent-glow)'
                  : 'var(--bg-elevated)',
                color: filter === f
                  ? f === 'paid' ? '#fca5a5' : f === 'reserved' ? '#fde047' : f === 'available' ? '#6ee7b7' : 'var(--accent-light)'
                  : 'var(--text-muted)',
                borderColor: filter === f
                  ? f === 'paid' ? 'rgba(239,68,68,0.5)' : f === 'reserved' ? 'rgba(234,179,8,0.5)' : f === 'available' ? 'rgba(16,185,129,0.5)' : 'rgba(167,139,250,0.5)'
                  : 'var(--border)',
              }}
            >
              {f === 'all' ? 'Todos' : f === 'paid' ? 'Vendidos' : f === 'reserved' ? 'Reservados' : 'Disponíveis'}
            </button>
          ))}
        </div>
      </div>

      {/* Sorteado destaque */}
      {raffle.drawn_ticket && (
        <div style={{
          marginBottom: '1rem', padding: '0.85rem 1.25rem', borderRadius: 12,
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <Trophy size={18} color="var(--gold)" />
          <span style={{ fontWeight: 700, color: 'var(--gold-light)' }}>
            Bilhete sorteado: #{String(raffle.drawn_ticket).padStart(3, '0')}
          </span>
          {ticketMap[raffle.drawn_ticket] && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              — {ticketMap[raffle.drawn_ticket].buyer_name}
            </span>
          )}
        </div>
      )}

      {/* CARTELA */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        {numbers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Nenhum bilhete encontrado para esse filtro.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
            gap: '5px',
          }}>
            {numbers.map(num => (
              <div
                key={num}
                style={{ ...cellStyle(num), aspectRatio: '1' }}
                onMouseEnter={e => handleMouseEnter(e, num)}
                onMouseLeave={handleMouseLeave}
              >
                {String(num).padStart(raffle.total_tickets >= 1000 ? 4 : 3, '0')}
              </div>
            ))}
          </div>
        )}

        {/* Rodapé com contagem */}
        {numbers.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Exibindo {numbers.length} de {raffle.total_tickets} bilhetes
            </span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>🔴 {stats.paid} vendidos</span>
              <span style={{ color: '#fde047', fontSize: '0.8rem', fontWeight: 600 }}>🟡 {stats.reserved} reservados</span>
              <span style={{ color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 600 }}>🟢 {stats.available} disponíveis</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
