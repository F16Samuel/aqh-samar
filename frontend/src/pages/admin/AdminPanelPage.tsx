import { useEffect, useState } from 'react'
import { Activity, Users, Target, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/api/client'

type CompanyReport = {
  average_score: number
  total_sheets: number
  total_goals: number
}

type UserProfile = {
  id: string
  full_name: string
  email: string
  role: string
  department_id: string | null
}

export default function AdminPanelPage() {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<CompanyReport | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Run both fetches in parallel
      const [reportRes, usersRes] = await Promise.all([
        api.get('/reports/company'),
        api.get('/users/')
      ])

      setReport(reportRes.data.data)
      setUsers(usersRes.data.data)
    } catch (err: any) {
      toast.error('Failed to load admin data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Admin Control Center</h1>
        <p>System configuration, cycle management, and platform analytics.</p>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="grid-cols-3 delay-1 animate-fade-in" style={{ marginBottom: 'var(--space-10)' }}>
            <div className="card glass flex items-center justify-between">
              <div>
                <p className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Company Score</p>
                <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {report?.average_score.toFixed(1)}%
                </div>
              </div>
              <Activity size={48} color="var(--color-primary)" opacity={0.2} />
            </div>

            <div className="card glass flex items-center justify-between">
              <div>
                <p className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Active Goal Sheets</p>
                <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-text)' }}>
                  {report?.total_sheets}
                </div>
              </div>
              <BarChart2 size={48} color="var(--color-text)" opacity={0.2} />
            </div>

            <div className="card glass flex items-center justify-between">
              <div>
                <p className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Total Goals Tracked</p>
                <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--color-text)' }}>
                  {report?.total_goals}
                </div>
              </div>
              <Target size={48} color="var(--color-text)" opacity={0.2} />
            </div>
          </div>

          <div className="animate-fade-in delay-2">
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-4)' }}>
              <h2>System Directory</h2>
              <span className="badge badge-surface">{users.length} Users</span>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>{u.full_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.role === 'admin' ? 'red' : u.role === 'manager' ? 'blue' : 'green'}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
