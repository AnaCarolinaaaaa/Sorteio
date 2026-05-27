'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Ticket, PlusCircle, List, LogOut, Trophy, Grid3X3 } from 'lucide-react'

// Componente para links da Sidebar Desktop
function SidebarLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.6rem 0.9rem',
        borderRadius: 10,
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'all 0.2s',
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

// Componente para links do Menu Flutuante Inferior Mobile
function MobileBottomLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`admin-mobile-link ${active ? 'admin-mobile-link-active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== 'true') {
      router.replace('/admin')
    }
  }, [router])

  function logout() {
    localStorage.removeItem('admin_auth')
    router.push('/admin')
  }

  // Não renderiza o layout de admin na tela de login
  if (pathname === '/admin') {
    return <>{children}</>
  }

  return (
    <div className="admin-container">
      {/* Estilos Responsivos Scoped */}
      <style dangerouslySetInnerHTML={{ __html: `
        .admin-container {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .admin-sidebar {
          width: 230px;
          flex-shrink: 0;
          background: var(--bg-card);
          borderRight: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 1.25rem 0.9rem;
          gap: 0.3rem;
          position: sticky;
          top: 0;
          height: 100vh;
          border-right: 1px solid var(--border);
        }

        .admin-main {
          flex: 1;
          overflow: auto;
          padding: 2rem;
        }

        .admin-mobile-nav {
          display: none;
        }

        .admin-mobile-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--text-muted);
          padding: 0.4rem 0.2rem;
          flex: 1;
          border-radius: 10px;
          transition: all 0.15s ease;
        }

        .admin-mobile-link span {
          font-size: 0.6rem;
          letter-spacing: -0.02em;
        }

        .admin-mobile-link-active {
          color: var(--accent-light);
          background: var(--accent-glow);
        }

        @media (max-width: 767px) {
          .admin-container {
            flex-direction: column;
          }

          .admin-sidebar {
            display: none !important;
          }

          .admin-main {
            padding: 1rem 1rem 6.5rem; /* Margem inferior para o menu flutuante */
          }

          .admin-mobile-nav {
            display: flex;
            position: fixed;
            bottom: 12px;
            left: 12px;
            right: 12px;
            background: rgba(19, 19, 26, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 0.35rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            justify-content: space-around;
            align-items: center;
          }
        }
      `}} />

      {/* Sidebar - VISÍVEL APENAS EM DESKTOP */}
      <aside className="admin-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.5rem', marginBottom: '1.5rem' }}>
          <Trophy size={20} color="var(--gold)" />
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Admin Sorteio</span>
        </div>

        <SidebarLink href="/admin/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <SidebarLink href="/admin/sorteios/novo" icon={<PlusCircle size={16} />} label="Novo Sorteio" />
        <SidebarLink href="/admin/cartela" icon={<Grid3X3 size={16} />} label="Cartela" />
        <SidebarLink href="/admin/bilhetes/registrar" icon={<Ticket size={16} />} label="Registrar Bilhete" />
        <SidebarLink href="/admin/bilhetes" icon={<List size={16} />} label="Bilhetes Vendidos" />

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

      {/* Floating Bottom Menu - VISÍVEL APENAS EM MOBILE */}
      <nav className="admin-mobile-nav">
        <MobileBottomLink href="/admin/dashboard" icon={<LayoutDashboard size={18} />} label="Painel" />
        <MobileBottomLink href="/admin/sorteios/novo" icon={<PlusCircle size={18} />} label="Novo" />
        <MobileBottomLink href="/admin/cartela" icon={<Grid3X3 size={18} />} label="Cartela" />
        <MobileBottomLink href="/admin/bilhetes/registrar" icon={<Ticket size={18} />} label="Vender" />
        <MobileBottomLink href="/admin/bilhetes" icon={<List size={18} />} label="Vendas" />
        
        <button
          onClick={logout}
          className="admin-mobile-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
        >
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  )
}
