import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

function Router() {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'

  if (normalizedPath === '/' || normalizedPath === '/chat') {
    return <App />
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Page not found</h1>
      <p>Open the app at <code>/chat</code> or <code>/</code>.</p>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
