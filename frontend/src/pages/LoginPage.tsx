import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useAuth } from '@/store/AuthContext'
import { Target } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await signIn(data.email, data.password)
      toast.success('Signed in successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-crust)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-mauve))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            <Target size={24} color="#11111b" />
          </div>
          <h2>Sign in to GoalTrack</h2>
          <p style={{ fontSize: '0.875rem', marginTop: 'var(--space-2)' }}>
            AtomQuest Hackathon 1.0 Portal
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="form-group" style={{ gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@company.com"
              {...register('email')}
            />
            {errors.email && <span className="form-error">{errors.email.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && <span className="form-error">{errors.password.message}</span>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-4)' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo hints */}
        <div style={{ marginTop: 'var(--space-6)', fontSize: '0.75rem', color: 'var(--color-subtext0)', textAlign: 'center' }}>
          Demo Credentials: <br />
          Admin: <code>admin@company.com</code><br />
          Manager: <code>mgr1@company.com</code><br />
          Employee: <code>emp1@company.com</code><br />
          (Password is <code>password123</code> for all)
        </div>
      </div>
    </div>
  )
}
