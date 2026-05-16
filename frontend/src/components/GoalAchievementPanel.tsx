import { useState, useEffect } from 'react'
import { CheckCircle, Plus } from 'lucide-react'
import api from '@/api/client'
import toast from 'react-hot-toast'

export type Goal = {
  id: string
  sheet_id: string
  thrust_area: string
  title: string
  description?: string
  uom_type: string
  target: number
  weightage: number
  is_locked: boolean
  shared_from?: string
}

type Achievement = {
  id: string
  goal_id: string
  quarter: string
  value: number
  progress_score: number
  comment: string
  created_at: string
}

export default function GoalAchievementPanel({ goal, isEditable }: { goal: Goal, isEditable: boolean }) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ quarter: 'Q1', value: 0, comment: '' })

  useEffect(() => {
    fetchAchievements()
  }, [goal.id])

  const fetchAchievements = async () => {
    try {
      const res = await api.get(`/achievements/goal/${goal.id}`)
      const mapped = res.data.data.map((a: any) => ({
        ...a,
        value: Number(a.actual || 0),
        comment: a.comment || 'Progress updated' // Backend doesn't have comment yet
      }))
      setAchievements(mapped)
    } catch (err: any) {
      console.error('Failed to load achievements', err)
    } finally {
      setLoading(false)
    }
  }

  const addAchievement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        goal_id: goal.id,
        quarter: form.quarter,
        actual: String(form.value),
        status: "on_track"
      }
      const res = await api.post('/achievements/', payload)
      // Convert backend model back to UI expectation temporarily
      const newAch = { ...res.data.data, value: Number(res.data.data.actual), comment: form.comment }
      setAchievements([...achievements, newAch])
      setIsAdding(false)
      setForm({ quarter: 'Q2', value: 0, comment: '' })
      toast.success('Achievement logged')
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message)
    }
  }

  // Calculate cumulative progress score (max of logged progress scores, since backend calculates normalized % per entry)
  // Or actually backend score is per achievement. 
  // Let's just find the most recent achievement or max score.
  const latestAchievement = achievements.length > 0 ? achievements[achievements.length - 1] : null
  const progressPercent = latestAchievement ? Math.min(Math.max(latestAchievement.progress_score, 0), 100) : 0

  return (
    <div style={{ marginTop: 'var(--space-6)', background: 'var(--color-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-4)' }}>
        <h4 style={{ color: 'var(--color-primary)' }}>Progress Tracking</h4>
        {isEditable && !isAdding && (
          <button className="btn btn-ghost btn-sm" onClick={() => setIsAdding(true)}>
            <Plus size={14} /> Log Progress
          </button>
        )}
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div className="flex justify-between" style={{ marginBottom: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--color-subtext1)' }}>
          <span>Current Score</span>
          <span>{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={addAchievement} className="card animate-fade-in" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Quarter/Phase</label>
              <select className="form-select" value={form.quarter} onChange={e => setForm({...form, quarter: e.target.value})}>
                <option value="Q1">Quarter 1</option>
                <option value="Q2">Quarter 2</option>
                <option value="Q3">Quarter 3</option>
                <option value="Q4">Quarter 4</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Value Achieved</label>
              <input type="number" required className="form-input" value={form.value} onChange={e => setForm({...form, value: Number(e.target.value)})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Comment / Evidence</label>
            <textarea className="form-textarea" required value={form.comment} onChange={e => setForm({...form, comment: e.target.value})} rows={2}></textarea>
          </div>
          <div className="flex gap-4" style={{ marginTop: 'var(--space-4)' }}>
            <button type="submit" className="btn btn-primary btn-sm">Submit</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-overlay0)' }}>Loading achievements...</div>
      ) : achievements.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-overlay0)' }}>No progress logged yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {achievements.map((ach) => (
            <div key={ach.id} className="flex justify-between items-center" style={{ background: 'var(--color-surface0)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <span className="badge badge-surface" style={{ marginRight: 'var(--space-2)' }}>{ach.quarter}</span>
                <span style={{ fontSize: '0.85rem' }}>Value: <strong>{ach.value}</strong></span>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext0)', marginTop: '4px' }}>{ach.comment}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 600 }}>
                  {ach.progress_score}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-overlay0)' }}>
                  {new Date(ach.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
