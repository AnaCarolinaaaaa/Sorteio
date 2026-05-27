'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Ticket, PlusCircle, List, LogOut, Trophy, Grid3X3 } from 'lucide-react'

function NavLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.65rem',
        padding: '0.6rem 0.9rem', borderRadius: 10, textDecoration: 'none',
        fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s',
        background: active ? 'var(--accent-glow)' : 'transparent',
        color: active ? 'var(--accent-light)' : 'var(--text-muted)',
        border: active ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
      }}
    >
      {icon}
      {label}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== 'true') {
      router.replace('/admin')
    }
  }, [router])

  function logout() {
    localStorage.removeItem('admin_auth')
    router.push('/admin')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 230, flexShrink: 0,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '1.25rem 0.9rem',
        gap: '0.3rem',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.5rem', marginBottom: '1.5rem' }}>
          <Trophy size={20} color="var(--gold)" />
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Admin Sorteio</span>
        </div>

        <NavLink href="/admin/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <NavLink href="/admin/sorteios/novo" icon={<PlusCircle size={16} />} label="Novo Sorteio" />
        <NavLink href="/admin/cartela" icon={<Grid3X3 size={16} />} label="Cartela" />
        <NavLink href="/admin/bilhetes/registrar" icon={<Ticket size={16} />} label="Registrar Bilhete" />
        <NavLink href="/admin/bilhetes" icon={<List size={16} />} label="Bilhetes Vendidos" />

        <div style={{ marginTop: 'auto' }}>
          <button onClick={logout} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
            <LogOut size={15} />
            Sair
          </button>
          <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Ver página pública
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        {children}
      </main>
    </div>
  )
}
