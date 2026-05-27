'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trophy, ArrowLeft, DollarSign } from 'lucide-react'
import Link from 'next/link'

function CurrencyInput({ id, name, value, onChange, placeholder }: {
  id: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>R$</span>
      <input
        id={id} name={name} type="number" min="0" step="0.01"
        className="input-field" style={{ paddingLeft: '2.5rem' }}
        placeholder={placeholder || '0,00'}
        value={value} onChange={onChange}
      />
    </div>
  )
}

export default function NovoSorteioPage() {
  const [form, setForm] = useState({
    title: '', description: '', prize: '', prize_image: '',
    prize_value: '', ticket_price: '', total_tickets: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Estimativas em tempo real
  const total = parseInt(form.total_tickets) || 0
  const ticketPrice = parseFloat(form.ticket_price) || 0
  const prizeValue = parseFloat(form.prize_value) || 0
  const expectedRevenue = total * ticketPrice
  const expectedProfit = expectedRevenue - prizeValue

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.title || !form.prize || !form.total_tickets) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }
    if (isNaN(total) || total < 1 || total > 100000) {
      setError('Quantidade de bilhetes deve ser entre 1 e 100.000.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('raffles').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      prize: form.prize.trim(),
      prize_image: form.prize_image.trim() || null,
      prize_value: prizeValue || null,
      ticket_price: ticketPrice || null,
      total_tickets: total,
      status: 'open',
    })

    if (dbError) {
      setError('Erro ao criar sorteio: ' + dbError.message)
      setLoading(false)
    } else {
      router.push('/admin/dashboard')
    }
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/admin/dashboard" className="btn-secondary" style={{ padding: '0.5rem 0.9rem' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Criar Novo Sorteio</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Configure o sorteio, prêmio e quantidade de bilhetes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Informações do Sorteio</p>

          <div>
            <label className="label" htmlFor="title">Nome do Sorteio *</label>
            <input id="title" name="title" type="text" className="input-field"
              placeholder="Ex: Sorteio de Natal 2025"
              value={form.title} onChange={handleChange} required />
          </div>

          <div>
            <label className="label" htmlFor="description">Descrição</label>
            <textarea id="description" name="description" className="input-field"
              placeholder="Descrição opcional..."
              value={form.description} onChange={handleChange}
              rows={2} style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label className="label" htmlFor="total_tickets">Quantidade de Bilhetes *</label>
            <input id="total_tickets" name="total_tickets" type="number" min="1" max="100000"
              className="input-field" placeholder="Ex: 100"
              value={form.total_tickets} onChange={handleChange} required />
          </div>

          <div>
            <label className="label" htmlFor="ticket_price">
              <DollarSign size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Valor do Bilhete (R$)
            </label>
            <CurrencyInput id="ticket_price" name="ticket_price" value={form.ticket_price} onChange={handleChange} placeholder="Ex: 10,00" />
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prêmio</p>

          <div>
            <label className="label" htmlFor="prize">
              <Trophy size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Descrição do Prêmio *
            </label>
            <input id="prize" name="prize" type="text" className="input-field"
              placeholder="Ex: iPhone 15 Pro Max 256GB"
              value={form.prize} onChange={handleChange} required />
          </div>

          <div>
            <label className="label" htmlFor="prize_value">
              <DollarSign size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Valor do Prêmio (R$)
            </label>
            <CurrencyInput id="prize_value" name="prize_value" value={form.prize_value} onChange={handleChange} placeholder="Ex: 5000,00" />
          </div>

          <div>
            <label className="label" htmlFor="prize_image">URL da Imagem do Prêmio</label>
            <input id="prize_image" name="prize_image" type="url" className="input-field"
              placeholder="https://..."
              value={form.prize_image} onChange={handleChange} />
            {form.prize_image && (
              <img src={form.prize_image} alt="Preview" style={{ marginTop: '0.75rem', width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
                onError={e => (e.currentTarget.style.display = 'none')} />
            )}
          </div>
        </div>

        {/* Estimativa financeira em tempo real */}
        {(ticketPrice > 0 || prizeValue > 0) && total > 0 && (
          <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(124,58,237,0.25)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
              📊 Estimativa Financeira
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Arrecadação total</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--green)' }}>{fmtBRL(expectedRevenue)}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{total} × {fmtBRL(ticketPrice)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Custo do prêmio</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--red)' }}>{fmtBRL(prizeValue)}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Lucro estimado</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: expectedProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtBRL(expectedProfit)}
                </p>
                <p style={{ fontSize: '0.7rem', color: expectedProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {expectedProfit >= 0 ? '✅ Lucro' : '⚠️ Prejuízo'}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--red)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center', padding: '0.85rem' }}>
          {loading ? <div className="spinner" /> : 'Criar Sorteio'}
        </button>
      </form>
    </div>
  )
}
