'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Raffle, Ticket } from '@/lib/types'
import { Trophy, Ticket as TicketIcon, Users, TrendingUp, Zap, ChevronRight, DollarSign, TrendingDown, BarChart3, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [drawError, setDrawError] = useState('')
  // Animation state
  const [animating, setAnimating] = useState(false)
  const [animNumber, setAnimNumber] = useState<number>(1)
  const [animPhase, setAnimPhase] = useState<'spinning' | 'slowing' | 'done'>('spinning')
  const [winner, setWinner] = useState<Ticket | null>(null)
  const [winnerError, setWinnerError] = useState('')
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadData() {
    const supabase = createClient()
    const { data: raffleData } = await supabase
      .from('raffles').select('*')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (raffleData) {
      setRaffle(raffleData)
      const { data: ticketData } = await supabase
        .from('tickets').select('*').eq('raffle_id', raffleData.id)
      setTickets(ticketData || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    return () => {
      if (animRef.current) clearTimeout(animRef.current)
    }
  }, [])

  async function handleDraw() {
    if (!raffle) return
    setDrawError('')
    if (raffle.status === 'drawn') { setDrawError('Este sorteio já foi realizado.'); return }
    const paidTickets = tickets.filter(t => t.status === 'paid')
    if (paidTickets.length === 0) { setDrawError('Não há bilhetes pagos para sortear.'); return }
    if (!confirm(`Realizar o sorteio agora entre ${paidTickets.length} bilhetes pagos? Esta ação não pode ser desfeita.`)) return

    // Escolhe o vencedor
    const w = paidTickets[Math.floor(Math.random() * paidTickets.length)]

    // Salva no banco ANTES de animar (garante que nao perde o resultado)
    setDrawing(true)
    const supabase = createClient()
    const { error } = await supabase.from('raffles')
      .update({ drawn_ticket: w.ticket_number, drawn_at: new Date().toISOString(), status: 'drawn' })
      .eq('id', raffle.id)
    setDrawing(false)

    if (error) {
      setDrawError('Erro ao realizar sorteio: ' + error.message)
      return
    }

    // Inicia animacao
    setWinner(w)
    setAnimPhase('spinning')
    setAnimating(true)

    const total = raffle.total_tickets
    const winNum = w.ticket_number
    let elapsed = 0
    const totalDuration = 5000   // 5 segundos de animacao
    const fastInterval = 60      // ms no inicio (rapido)
    const slowInterval = 380     // ms no fim (lento)

    function getInterval(t: number) {
      // Desaceleracao exponencial
      const progress = Math.min(t / totalDuration, 1)
      return fastInterval + (slowInterval - fastInterval) * (progress ** 2)
    }

    function step() {
      elapsed += getInterval(elapsed)
      const remaining = totalDuration - elapsed

      if (remaining <= slowInterval * 3) {
        setAnimPhase('slowing')
      }

      if (elapsed >= totalDuration) {
        // Termina no vencedor
        setAnimNumber(winNum)
        setAnimPhase('done')
        return
      }

      // Numero aleatorio diferente do vencedor enquanto ainda nao chegou na hora
      let rand
      do { rand = Math.floor(Math.random() * total) + 1 } while (rand === winNum && remaining > slowInterval)
      setAnimNumber(rand)

      animRef.current = setTimeout(step, getInterval(elapsed))
    }

    animRef.current = setTimeout(step, fastInterval)
  }

  async function handleCloseRaffle() {
    if (!raffle || !confirm('Encerrar as vendas deste sorteio?')) return
    const supabase = createClient()
    await supabase.from('raffles').update({ status: 'closed' }).eq('id', raffle.id)
    await loadData()
  }

  async function handleDeleteRaffle() {
    if (!raffle) return
    const count = tickets.length
    const msg = count > 0
      ? `Tem certeza? Isso apagará o sorteio "${raffle.title}" e TODOS os ${count} bilhetes registrados. Esta ação é irreversível!`
      : `Apagar o sorteio "${raffle.title}"? Esta ação é irreversível!`
    if (!confirm(msg)) return
    const supabase = createClient()
    const { error } = await supabase.from('raffles').delete().eq('id', raffle.id)
    if (error) {
      alert('Erro ao apagar sorteio: ' + error.message)
    } else {
      setRaffle(null)
      setTickets([])
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  )

  if (!raffle) return (
    <div style={{ textAlign: 'center', marginTop: '5rem' }}>
      <Trophy size={52} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Nenhum sorteio cadastrado ainda.</p>
      <Link href="/admin/sorteios/novo" className="btn-primary">Criar primeiro sorteio</Link>
    </div>
  )

  // Métricas de bilhetes
  const paid = tickets.filter(t => t.status === 'paid').length
  const reserved = tickets.filter(t => t.status === 'reserved').length
  const available = raffle.total_tickets - paid - reserved
  const progress = (paid / raffle.total_tickets) * 100

  // Métricas financeiras
  const ticketPrice = raffle.ticket_price || 0
  const prizeValue = raffle.prize_value || 0
  // Receita real = soma dos amount_paid registrados (bilhetes pagos com valor informado)
  const revenue = tickets
    .filter(t => t.status === 'paid' && t.amount_paid != null)
    .reduce((sum, t) => sum + (t.amount_paid || 0), 0)
  // Estimativa = bilhetes pagos sem amount_paid × preço do bilhete
  const paidWithoutAmount = tickets.filter(t => t.status === 'paid' && t.amount_paid == null).length
  const revenueEstimate = revenue + paidWithoutAmount * ticketPrice
  const reservedRevenue = reserved * ticketPrice
  const maxRevenue = raffle.total_tickets * ticketPrice
  const profit = revenueEstimate - prizeValue
  const hasFinancial = ticketPrice > 0 || revenue > 0

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const statusLabel: Record<string, string> = { open: '🟢 Aberto', closed: '🟡 Encerrado', drawn: '🏆 Sorteado' }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Visão geral do sorteio ativo</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/admin/sorteios/novo" className="btn-secondary">+ Novo Sorteio</Link>
          <Link href="/admin/bilhetes/registrar" className="btn-primary">+ Registrar Bilhete</Link>
        </div>
      </div>

      {/* Raffle Info Card */}
      <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '1.5rem', border: '1px solid rgba(124,58,237,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className={`badge badge-${raffle.status}`} style={{ marginBottom: '0.5rem' }}>{statusLabel[raffle.status]}</span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{raffle.title}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span><Trophy size={13} style={{ display: 'inline', marginRight: '0.3rem', color: 'var(--gold)' }} />{raffle.prize}</span>
              {ticketPrice > 0 && <span><TicketIcon size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />{fmtBRL(ticketPrice)} por bilhete</span>}
              {prizeValue > 0 && <span><DollarSign size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />Prêmio: {fmtBRL(prizeValue)}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {raffle.status === 'open' && (
              <button onClick={handleCloseRaffle} className="btn-secondary">Encerrar Vendas</button>
            )}
            {raffle.status !== 'drawn' && (
              <button onClick={handleDraw} className="btn-gold" disabled={drawing}>
                {drawing ? <div className="spinner" /> : <><Zap size={16} />Realizar Sorteio</>}
              </button>
            )}
            <button onClick={handleDeleteRaffle} className="btn-danger" title="Apagar sorteio">
              <Trash2 size={15} /> Apagar
            </button>
          </div>
        </div>

        {drawError && (
          <div style={{ marginTop: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.65rem 1rem', color: 'var(--red)', fontSize: '0.85rem' }}>
            {drawError}
          </div>
        )}

        {raffle.status === 'drawn' && raffle.drawn_ticket && (
          <div style={{ marginTop: '1.25rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--gold)' }}>#{String(raffle.drawn_ticket).padStart(3, '0')}</div>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--gold-light)' }}>Bilhete Sorteado!</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{raffle.drawn_at ? new Date(raffle.drawn_at).toLocaleString('pt-BR') : ''}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats de bilhetes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: <TicketIcon size={18} />, label: 'Total', value: raffle.total_tickets, color: 'var(--accent-light)' },
          { icon: <Users size={18} />, label: 'Pagos', value: paid, color: 'var(--green)' },
          { icon: <TrendingUp size={18} />, label: 'Reservados', value: reserved, color: 'var(--gold)' },
          { icon: <TicketIcon size={18} />, label: 'Disponíveis', value: available, color: 'var(--text-muted)' },
        ].map((stat, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ color: stat.color, marginBottom: '0.4rem' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Progresso de vendas */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Progresso de vendas</span>
          <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{progress.toFixed(1)}% pagos</span>
        </div>
        <div style={{ height: 12, background: 'var(--bg-primary)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--gold))', borderRadius: 6, transition: 'width 0.8s ease' }} />
        </div>
        {reserved > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--gold)', marginTop: '0.5rem' }}>
            + {((reserved / raffle.total_tickets) * 100).toFixed(1)}% reservados (aguardando pagamento)
          </p>
        )}
      </div>

      {/* === FINANCEIRO === */}
      {hasFinancial && (
        <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '1.5rem', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <BarChart3 size={18} color="var(--green)" />
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>Financeiro</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '1rem' }}>
            {/* Arrecadado */}
            <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <DollarSign size={14} color="var(--green)" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arrecadado</span>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{fmtBRL(revenueEstimate)}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {revenue > 0 && paidWithoutAmount > 0
                  ? `R$ ${fmtBRL(revenue)} confirmado + estimativa`
                  : `${paid} bilhetes pagos`}
              </p>
            </div>

            {/* Potencial (reservados) */}
            {reserved > 0 && (
              <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <TrendingUp size={14} color="var(--gold)" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Potencial</span>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gold)' }}>{fmtBRL(revenue + reservedRevenue)}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Se reservados pagarem</p>
              </div>
            )}

            {/* Meta (100% vendido) */}
            <div style={{ padding: '1rem', background: 'rgba(124,58,237,0.08)', borderRadius: 10, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <BarChart3 size={14} color="var(--accent-light)" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meta (100%)</span>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-light)' }}>{fmtBRL(maxRevenue)}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{raffle.total_tickets} bilhetes</p>
            </div>

            {/* Lucro / Prejuízo */}
            {prizeValue > 0 && (
              <div style={{ padding: '1rem', background: profit >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: 10, border: `1px solid ${profit >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  {profit >= 0 ? <TrendingUp size={14} color="var(--green)" /> : <TrendingDown size={14} color="var(--red)" />}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lucro atual</span>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtBRL(profit)}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {profit >= 0 ? '✅ Lucrando' : '⚠️ Ainda no prejuízo'}
                </p>
              </div>
            )}
          </div>

          {/* Break-even */}
          {prizeValue > 0 && ticketPrice > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-primary)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Ponto de equilíbrio: <strong style={{ color: 'var(--text-secondary)' }}>{Math.ceil(prizeValue / ticketPrice)} bilhetes pagos</strong>
              </span>
              <span style={{ fontSize: '0.82rem', color: profit >= 0 ? 'var(--green)' : 'var(--gold)' }}>
                {profit >= 0
                  ? `✅ Meta atingida com ${paid} bilhetes!`
                  : `Faltam ${Math.ceil(prizeValue / ticketPrice) - paid} bilhetes para cobrir o prêmio`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ações rápidas */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Ações rápidas</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { href: '/admin/bilhetes/registrar', label: 'Registrar bilhetes vendidos' },
            { href: '/admin/bilhetes', label: 'Ver todos os bilhetes' },
            { href: '/admin/sorteios/novo', label: 'Criar novo sorteio' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.75rem 1rem', borderRadius: 8,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              textDecoration: 'none', color: 'var(--text-secondary)',
              fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-light)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              {l.label}
              <ChevronRight size={16} color="var(--text-muted)" />
            </Link>
          ))}
        </div>
      </div>

      {/* Overlay de Animação do Sorteio */}
      {animating && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 5, 20, 0.96)',
          backdropFilter: 'blur(12px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: 'var(--text-primary)',
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes shake {
              0% { transform: translate(1px, 1px) rotate(0deg) scale(1); }
              10% { transform: translate(-1px, -2px) rotate(-1deg) scale(1.02); }
              20% { transform: translate(-2px, 0px) rotate(1deg) scale(0.99); }
              30% { transform: translate(0px, 2px) rotate(0deg) scale(1); }
              40% { transform: translate(1px, -1px) rotate(1deg) scale(1.01); }
              50% { transform: translate(-1px, 2px) rotate(-1deg) scale(0.98); }
              60% { transform: translate(-2px, 1px) rotate(0deg) scale(1); }
              70% { transform: translate(2px, 1px) rotate(-1deg) scale(1.02); }
              80% { transform: translate(-1px, -1px) rotate(1deg) scale(0.99); }
              90% { transform: translate(2px, 2px) rotate(0deg) scale(1); }
              100% { transform: translate(1px, -2px) rotate(-1deg) scale(1.01); }
            }
            @keyframes spin-dashed {
              to { transform: rotate(360deg); }
            }
            @keyframes bounce-subtle {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-5px); }
            }
          `}} />

          {animPhase !== 'done' ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              <div style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                border: '4px dashed var(--gold)',
                borderTopColor: 'transparent',
                animation: 'spin-dashed 2s linear infinite',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Trophy size={36} color="var(--gold)" style={{ animation: 'bounce-subtle 2s ease-in-out infinite' }} />
              </div>
              <div>
                <h2 style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  background: 'linear-gradient(90deg, var(--accent-light), var(--gold))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.05em'
                }}>
                  {animPhase === 'spinning' ? 'SORTEANDO NÚMERO...' : 'DESACELERANDO...'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Escolhendo entre os bilhetes pagos</p>
              </div>

              {/* Slot machine numeric view */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '2px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 0 50px rgba(124, 58, 237, 0.25)',
                borderRadius: 24,
                padding: '2.5rem 5rem',
                fontSize: '6.5rem',
                fontWeight: 900,
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                color: 'var(--gold)',
                textShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                minWidth: '280px',
                textAlign: 'center',
                animation: animPhase === 'spinning' ? 'shake 0.15s infinite' : 'none',
              }}>
                {String(animNumber).padStart(raffle.total_tickets >= 1000 ? 4 : 3, '0')}
              </div>
            </div>
          ) : (
            <div className="glass-card fade-in" style={{
              maxWidth: 480,
              width: '100%',
              padding: '2.5rem 2rem',
              textAlign: 'center',
              border: '2px solid var(--gold)',
              boxShadow: '0 0 60px rgba(245,158,11,0.35)',
              background: 'radial-gradient(circle at top, rgba(245,158,11,0.12) 0%, rgba(10,5,20,0.85) 100%)',
            }}>
              <div style={{
                width: 72,
                height: 72,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                boxShadow: '0 0 20px rgba(245,158,11,0.4)',
              }}>
                <Trophy size={36} color="#1a1200" />
              </div>

              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--gold)', textShadow: '0 2px 10px rgba(245,158,11,0.2)', marginBottom: '0.3rem' }}>
                GANHADOR!
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.75rem' }}>
                O sorteio foi finalizado com sucesso!
              </p>

              <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 16,
                padding: '1.25rem',
                border: '1px solid var(--border)',
                marginBottom: '1.75rem',
              }}>
                <div style={{
                  fontSize: '4.5rem',
                  fontWeight: 900,
                  color: 'var(--gold)',
                  fontFamily: 'monospace',
                  lineHeight: '1',
                  marginBottom: '1rem',
                  textShadow: '0 0 15px rgba(245,158,11,0.3)',
                }}>
                  #{String(winner?.ticket_number).padStart(3, '0')}
                </div>
                
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comprador</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{winner?.buyer_name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{winner?.buyer_contact}</p>
                  {winner?.amount_paid != null && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600, marginTop: '0.15rem' }}>
                      Valor Recebido: {winner.amount_paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setAnimating(false)
                  setWinner(null)
                  loadData()
                }}
                className="btn-gold"
                style={{ width: '100%', justifyContent: 'center', padding: '0.9rem', fontSize: '1rem', fontWeight: 800 }}
              >
                Concluir Sorteio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
