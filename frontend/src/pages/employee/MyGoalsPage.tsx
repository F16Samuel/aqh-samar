import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { validateWeightage, WeightageError } from '@/utils/validateWeightage'
import { Plus, Send, AlertTriangle, Target, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/api/client'
import { useAuth } from '@/store/AuthContext'
import GoalAchievementPanel from '@/components/GoalAchievementPanel'

// Types (should ideally be in a shared types file)
export type GoalSheet = {
  id: string
  status: 'draft' | 'submitted' | 'rework' | 'approved'
  employee_id: string
}

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

export default function MyGoalsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [validationErrors, setValidationErrors] = useState<WeightageError[]>([])

  // Form State
  const [isAddingGoal, setIsAddingGoal] = useState(false)
  const [formData, setFormData] = useState({
    thrust_area: '',
    title: '',
    description: '',
    uom_type: 'max',
    target: 0,
    weightage: 10,
  })

  const { data: sheet, isLoading: sheetLoading } = useQuery({
    queryKey: ['my-sheet'],
    queryFn: async () => {
      const res = await api.get('/goal-sheets/mine')
      return res.data.data.length > 0 ? res.data.data[0] : null
    }
  })

  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals', sheet?.id],
    queryFn: async () => {
      if (!sheet) return []
      const res = await api.get(`/goals/sheet/${sheet.id}`)
      return res.data.data
    },
    enabled: !!sheet
  })
  const goals = goalsData || []
  const loading = sheetLoading || goalsLoading

  const createSheetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/goal-sheets/')
      return res.data.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['my-sheet'], data)
      toast.success('Goal sheet initialized')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message)
    }
  })

  const submitSheetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/goal-sheets/${sheet.id}/submit`)
      return res.data.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['my-sheet'], data)
      toast.success('Sheet submitted for manager approval')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message)
    }
  })

  const addGoalMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/goals/sheet/${sheet.id}`, payload)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', sheet?.id] })
      setIsAddingGoal(false)
      setFormData({ thrust_area: '', title: '', description: '', uom_type: 'max', target: 0, weightage: 10 })
      setValidationErrors([])
      toast.success('Goal added')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message)
    }
  })

  const createSheet = () => createSheetMutation.mutate()
  const submitSheet = () => submitSheetMutation.mutate()

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sheet) return
    const payload = {
      ...formData,
      target: Number(formData.target),
      weightage: Number(formData.weightage),
    }
    const allGoals = [...goals, payload as any]
    const errors = validateWeightage(allGoals)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    addGoalMutation.mutate(payload)
  }

  if (loading && !sheet) {
    return <div className="spinner" />
  }

  if (!sheet) {
    return (
      <div className="animate-fade-in delay-1">
        <div className="page-header">
          <h1>My Goals</h1>
          <p>You don't have an active goal sheet for this cycle yet.</p>
        </div>
        <div className="card glass flex-col items-center gap-6" style={{ padding: 'var(--space-12)' }}>
          <Target size={64} color="var(--color-primary)" opacity={0.5} />
          <h2 style={{ textAlign: 'center' }}>Ready to set your objectives?</h2>
          <button className="btn btn-primary" onClick={createSheet}>
            <Plus size={18} /> Initialize Goal Sheet
          </button>
        </div>
      </div>
    )
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0)
  const submitErrors = validateWeightage(goals)
  const canSubmit = submitErrors.length === 0 && goals.length > 0 && (sheet.status === 'draft' || sheet.status === 'rework')
  const isEditable = sheet.status === 'draft' || sheet.status === 'rework'

  return (
    <div className="animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>My Goals</h1>
          <div className="flex gap-4 items-center">
            <span className={`badge badge-${
              sheet.status === 'approved' ? 'green' : 
              sheet.status === 'submitted' ? 'blue' : 
              sheet.status === 'rework' ? 'red' : 'surface'
            }`}>
              {sheet.status.toUpperCase()}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-subtext1)' }}>
              Weightage: {totalWeightage}% / 100%
            </span>
          </div>
        </div>
        {canSubmit && (
          <button className="btn btn-primary animate-fade-in" onClick={submitSheet}>
            <Send size={18} /> Submit for Approval
          </button>
        )}
      </div>

      {isEditable && (
        <div className="card glass animate-fade-in delay-1" style={{ marginBottom: 'var(--space-8)' }}>
          {isAddingGoal ? (
            <form onSubmit={addGoal} className="animate-fade-in">
              <h3 style={{ marginBottom: 'var(--space-4)' }}>New Goal</h3>
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Thrust Area</label>
                  <input required className="form-input" value={formData.thrust_area} onChange={e => setFormData({...formData, thrust_area: e.target.value})} placeholder="e.g. Revenue, Engineering Excellence" />
                </div>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input required className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Goal Title" />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2}></textarea>
              </div>

              <div className="grid-cols-3">
                <div className="form-group">
                  <label className="form-label">UoM Type</label>
                  <select className="form-select" value={formData.uom_type} onChange={e => setFormData({...formData, uom_type: e.target.value})}>
                    <option value="max">Maximize (Higher is better)</option>
                    <option value="min">Minimize (Lower is better)</option>
                    <option value="zero">Target Zero</option>
                    <option value="timeline">Timeline (Days)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target Value</label>
                  <input type="number" required className="form-input" value={formData.target} onChange={e => setFormData({...formData, target: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Weightage (%)</label>
                  <input type="number" required min={10} max={100} className="form-input" value={formData.weightage} onChange={e => setFormData({...formData, weightage: Number(e.target.value)})} />
                </div>
              </div>

              <div className="flex gap-4" style={{ marginTop: 'var(--space-4)' }}>
                <button type="submit" className="btn btn-primary" disabled={addGoalMutation.isPending}>
                  {addGoalMutation.isPending ? 'Saving...' : 'Save Goal'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setIsAddingGoal(false); setValidationErrors([]); }}>Cancel</button>
              </div>

              {validationErrors.length > 0 && (
                <div className="form-error" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-2)', background: 'var(--color-surface0)', borderRadius: '4px' }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {validationErrors.map((err, idx) => (
                      <li key={idx}><AlertTriangle size={14} style={{display:'inline', marginBottom:'-2px'}} /> {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <div>
                <p>Define your OKRs. You have {goals.length}/8 goals.</p>
                {totalWeightage < 100 && <p className="form-error mt-2"><AlertTriangle size={14} style={{display:'inline', marginBottom:'-2px'}} /> {100 - totalWeightage}% weightage remaining.</p>}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => setIsAddingGoal(true)}
                disabled={goals.length >= 8}
              >
                <Plus size={18} /> Add Goal
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 animate-fade-in delay-2">
        {goals.map((g, i) => (
          <div key={g.id} className="card" style={{ animationDelay: `${(i+3)*100}ms` }}>
            <div className="flex justify-between" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <span className="badge badge-surface" style={{ marginBottom: 'var(--space-2)' }}>{g.thrust_area}</span>
                <h3>{g.title} {g.is_locked && <Lock size={16} color="var(--color-warning)" style={{display:'inline'}} />}</h3>
                {g.description && <p style={{ marginTop: 'var(--space-2)' }}>{g.description}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {g.weightage}%
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext0)' }}>Weightage</div>
              </div>
            </div>

            <div className="flex gap-8" style={{ borderTop: '1px solid var(--color-surface0)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext0)', textTransform: 'uppercase' }}>Target</div>
                <div style={{ fontWeight: 600 }}>{g.target} <span style={{fontSize: '0.8rem', opacity: 0.6}}>({g.uom_type})</span></div>
              </div>
              
              {/* If goal is shared, indicate it */}
              {g.shared_from && (
                <div>
                  <span className="badge badge-blue">Shared from Management</span>
                </div>
              )}
            </div>

            {/* In Phase 9 we embed an Achievement tracking panel inside the goal card */}
            {(sheet.status === 'approved' || goals.length > 0) && (
              <GoalAchievementPanel goal={g} isEditable={sheet.status === 'approved'} />
            )}
          </div>
        ))}
        {goals.length === 0 && !isAddingGoal && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-subtext1)' }}>
            No goals added yet.
          </div>
        )}
      </div>
    </div>
  )
}
