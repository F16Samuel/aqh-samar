import { Outlet, NavLink } from 'react-router-dom'
import { Target, LogOut, User } from 'lucide-react'
import { useAuth } from '@/store/AuthContext'

export default function EmployeeLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Brand */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-surface0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-mauve))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Target size={18} color="#11111b" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>GoalTrack</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext0)' }}>
                Employee Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '1rem', flex: 1 }}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `btn btn-ghost ${isActive ? 'btn-primary' : ''}`
            }
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
          >
            <Target size={16} /> My Goals
          </NavLink>
        </nav>

        {/* User info */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--color-surface0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--color-surface1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={14} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext0)' }}>Employee</div>
            </div>
          </div>
          <button onClick={signOut} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
