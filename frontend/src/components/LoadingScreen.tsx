export default function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-base)',
        gap: '1.5rem',
      }}
    >
      <div className="spinner" />
      <p style={{ color: 'var(--color-subtext0)', fontSize: '0.9rem' }}>Loading…</p>
    </div>
  )
}
