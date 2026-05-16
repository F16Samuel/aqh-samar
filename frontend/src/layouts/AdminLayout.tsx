import { Outlet, NavLink } from 'react-router-dom'
import { Shield, LogOut, User } from 'lucide-react'
import { useAuth } from '@/store/AuthContext'

export default function AdminLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-surface0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--color-mauve), var(--color-pink))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Shield size={18} color="#11111b" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>GoalTrack</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext0)' }}>Admin Panel</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: '1rem', flex: 1 }}>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `btn btn-ghost ${isActive ? 'btn-primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
          >
            <Shield size={16} /> Admin Panel
          </NavLink>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-surface0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext0)' }}>Admin / HR</div>
            </div>
          </div>
          <button onClick={signOut} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="animate-fade-in"><Outlet /></div>
      </main>
    </div>
  )
}
