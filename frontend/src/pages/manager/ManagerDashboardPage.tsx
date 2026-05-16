import { useEffect, useState } from 'react'
import { Check, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/api/client'
import { useAuth } from '@/store/AuthContext'
import type { GoalSheet, Goal } from '@/pages/employee/MyGoalsPage'
import GoalAchievementPanel from '@/components/GoalAchievementPanel'

type TeamMember = {
  id: string
  full_name: string
  email: string
  role: string
}

type EnrichedSheet = GoalSheet & {
  employee?: TeamMember
}

export default function ManagerDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [sheets, setSheets] = useState<EnrichedSheet[]>([])
  
  // Detail View State
  const [selectedSheet, setSelectedSheet] = useState<EnrichedSheet | null>(null)
  const [sheetGoals, setSheetGoals] = useState<Goal[]>([])
  const [isReturning, setIsReturning] = useState(false)
  const [returnComment, setReturnComment] = useState('')

  useEffect(() => {
    if (user) {
      fetchTeamData()
    }
  }, [user])

  const fetchTeamData = async () => {
    try {
      setLoading(true)
      // 1. Fetch team members
      const teamRes = await api.get(`/users/${user?.id}/team`)
      const team: TeamMember[] = teamRes.data.data

      // 2. Fetch team sheets
      const sheetsRes = await api.get('/goal-sheets/team')
      const rawSheets: GoalSheet[] = sheetsRes.data.data

      // Merge
      const enriched: EnrichedSheet[] = rawSheets.map(sheet => ({
        ...sheet,
        employee: team.find(t => t.id === sheet.employee_id)
      }))

      setSheets(enriched)
    } catch (err: any) {
      toast.error('Failed to load team data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const viewSheet = async (sheet: EnrichedSheet) => {
    try {
      setSelectedSheet(sheet)
      const res = await api.get(`/goals/sheet/${sheet.id}`)
      setSheetGoals(res.data.data)
      setIsReturning(false)
      setReturnComment('')
    } catch (err: any) {
      toast.error('Failed to load goals: ' + err.message)
    }
  }

  const approveSheet = async (sheetId: string) => {
    try {
      await api.post(`/goal-sheets/${sheetId}/approve`)
      toast.success('Sheet approved successfully')
      setSelectedSheet(null)
      fetchTeamData() // Refresh status
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const returnSheet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSheet) return
    try {
      await api.post(`/goal-sheets/${selectedSheet.id}/return`, { comment: returnComment })
      toast.success('Sheet returned for rework')
      setSelectedSheet(null)
      fetchTeamData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Team Dashboard</h1>
        <p>Review and approve your direct reports' goal sheets.</p>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : selectedSheet ? (
        <div className="animate-fade-in">
          <button className="btn btn-ghost" onClick={() => setSelectedSheet(null)} style={{ marginBottom: 'var(--space-6)' }}>
            ← Back to Team
          </button>
          
          <div className="card glass flex justify-between items-center" style={{ marginBottom: 'var(--space-8)' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>{selectedSheet.employee?.full_name}'s Goals</h2>
              <span className={`badge badge-${
                selectedSheet.status === 'approved' ? 'green' : 
                selectedSheet.status === 'submitted' ? 'blue' : 
                selectedSheet.status === 'rework' ? 'red' : 'surface'
              }`}>
                {selectedSheet.status.toUpperCase()}
              </span>
            </div>
            
            {selectedSheet.status === 'submitted' && !isReturning && (
              <div className="flex gap-4">
                <button className="btn btn-primary" onClick={() => approveSheet(selectedSheet.id)}>
                  <Check size={18} /> Approve
                </button>
                <button className="btn btn-danger" onClick={() => setIsReturning(true)}>
                  <X size={18} /> Return for Rework
                </button>
              </div>
            )}
          </div>

          {isReturning && (
            <form className="card animate-fade-in" onSubmit={returnSheet} style={{ marginBottom: 'var(--space-8)', borderColor: 'var(--color-danger)' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-danger)' }}>Reason for Rework</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  required 
                  placeholder="Provide feedback on what needs to be changed..."
                  value={returnComment}
                  onChange={(e) => setReturnComment(e.target.value)}
                />
              </div>
              <div className="flex gap-4" style={{ marginTop: 'var(--space-4)' }}>
                <button type="submit" className="btn btn-danger">Confirm Return</button>
                <button type="button" className="btn btn-ghost" onClick={() => setIsReturning(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-6">
            {sheetGoals.map((g, i) => (
              <div key={g.id} className="card animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="flex justify-between" style={{ marginBottom: 'var(--space-4)' }}>
                  <div>
                    <span className="badge badge-surface" style={{ marginBottom: 'var(--space-2)' }}>{g.thrust_area}</span>
                    <h3>{g.title}</h3>
                    {g.description && <p style={{ marginTop: 'var(--space-2)' }}>{g.description}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {g.weightage}%
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                  <span style={{ color: 'var(--color-subtext1)' }}>Target:</span> {g.target} ({g.uom_type})
                </div>

                {/* Show achievements (read-only for manager unless logging checkin, but for simplicity read-only view here) */}
                <GoalAchievementPanel goal={g} isEditable={false} />
              </div>
            ))}
            {sheetGoals.length === 0 && (
              <p>This sheet has no goals.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="table-wrapper animate-fade-in delay-1">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map(sheet => (
                <tr key={sheet.id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {sheet.employee?.full_name || 'Unknown'}
                  </td>
                  <td>
                    <span className={`badge badge-${
                      sheet.status === 'approved' ? 'green' : 
                      sheet.status === 'submitted' ? 'blue' : 
                      sheet.status === 'rework' ? 'red' : 'surface'
                    }`}>
                      {sheet.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{sheet.submitted_at ? new Date(sheet.submitted_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => viewSheet(sheet)}>
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {sheets.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    No goal sheets found for your team yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
