import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Inject Supabase JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Uniform error shape: surface error.message from backend
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error?.message ?? err.message ?? 'An unknown error occurred'
    return Promise.reject(new Error(message))
  },
)

export default api
