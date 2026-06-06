'use client'

import { useState, useEffect } from 'react'

export default function ClientLoginGate({ authEmail, authPassword, children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Check local storage on mount
    const authStatus = localStorage.getItem('isAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
    setIsChecking(false)
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    // Fallback safety if env vars aren't set: allow access, 
    // or strictly require them to be set. The prompt implies strict match.
    if (!authEmail || !authPassword) {
      console.warn("Auth environment variables are missing! Check your .env file.")
      // If the user hasn't set up the .env file yet, we might want to either block or let them in.
      // But strictly matching undefined with an empty string is bad. 
    }

    if (email === authEmail && password === authPassword) {
      localStorage.setItem('isAuthenticated', 'true')
      setIsAuthenticated(true)
    } else {
      setError('Invalid email or password')
    }
  }

  // To support the logout function requested in the main UI, 
  // we can expose a global window function or an event listener.
  // The user asked to "Add logout button in main UI" and "Remove isAuthenticated from localStorage"
  useEffect(() => {
    const handleLogout = () => {
      localStorage.removeItem('isAuthenticated')
      setIsAuthenticated(false)
    }
    window.addEventListener('app-logout', handleLogout)
    return () => window.removeEventListener('app-logout', handleLogout)
  }, [])

  if (isChecking) {
    return null // prevent flash of unauthenticated content
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--paper)',
      padding: 24,
      fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{
        background: '#fff',
        padding: '40px 32px',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        width: '100%',
        maxWidth: 400
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>R</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>Welcome Back</h1>
          <p style={{ color: 'var(--mid)', fontSize: 14, marginTop: 4 }}>Please sign in to access Resume Agent.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              marginTop: 8,
              width: '100%',
              padding: '14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Login to Access Tool
          </button>
        </form>
      </div>
    </div>
  )
}
