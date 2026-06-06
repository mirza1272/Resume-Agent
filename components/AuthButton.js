'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      if (typeof window === 'undefined' || !window.puter) return

      try {
        const isSignedIn = window.puter.auth.isSignedIn()
        if (isSignedIn) {
          const userData = await window.puter.auth.getUser()
          setUser(userData)
        }
      } catch (err) {
        console.error("Auth check failed:", err)
      } finally {
        setLoading(false)
      }
    }

    // Puter script might take a moment to load
    if (window.puter) {
      checkAuth()
    } else {
      const interval = setInterval(() => {
        if (window.puter) {
          clearInterval(interval)
          checkAuth()
        }
      }, 500)
      return () => clearInterval(interval)
    }
  }, [])

  async function handleSignIn() {
    if (!window.puter) return
    setLoading(true)
    try {
      // Force fresh auth session
      await window.puter.auth.signIn()
      const userData = await window.puter.auth.getUser()
      if (userData) {
        setUser(userData)
        console.log("Active account verified:", userData)
        window.location.reload()
      }
    } catch (err) {
      console.error("Sign in failed:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    if (!window.puter) return
    setLoading(true)
    try {
      // Clear Puter session data
      if (window.puter.auth.isSignedIn()) {
        await window.puter.auth.signOut()
      }

      // Clear local storage related to Puter / Auth / Tokens
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.toLowerCase().includes('puter') || key.toLowerCase().includes('token') || key.toLowerCase().includes('session'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))

      // Also clear session storage for good measure
      sessionStorage.clear()

      setUser(null)

      // Navigate to home and force reload for fresh state
      router.push('/')

      // Dispatch custom app-logout event for ClientLoginGate
      window.dispatchEvent(new Event('app-logout'))

      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (err) {
      console.error("Sign out failed:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: 'var(--mid)' }}>Checking Auth...</div>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {user ? (
        <>
          <span style={{ fontSize: 13, color: 'var(--mid)', fontWeight: 500 }}>
            {user.username || user.email || 'Logged In'}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              padding: '6px 12px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Sign Out
          </button>
        </>
      ) : (
        <button
          onClick={handleSignIn}
          style={{
            padding: '6px 14px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          Sign In
        </button>
      )}
    </div>
  )
}
