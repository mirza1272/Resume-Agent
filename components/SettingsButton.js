'use client'

import { useState } from 'react'

export default function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false)

  const clearStorage = () => {
    // Remove Uploaded resumes
    sessionStorage.removeItem('uploadedEnrichedResume')
    // Remove Generated resumes
    sessionStorage.removeItem('agentData')
    // Remove OCR temporary files
    sessionStorage.removeItem('uploadedFileName')
    // Remove Cached job descriptions
    sessionStorage.removeItem('jobDesc')
    // Remove temporary ATS analysis files
    sessionStorage.removeItem('uploadATSAnalysis')

    alert('Temporary storage cleared successfully.')
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '6px 14px',
          background: 'none',
          color: 'var(--mid)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        ⚙️ Settings
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          padding: '12px',
          width: '220px',
          zIndex: 1000,
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--ink)' }}>Storage Management</h4>
          <p style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 12 }}>
            Frees up space to prevent upload errors. User profiles and templates are preserved.
          </p>
          <button
            onClick={clearStorage}
            style={{
              width: '100%',
              padding: '8px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear Temporary Storage
          </button>
        </div>
      )}
    </div>
  )
}
