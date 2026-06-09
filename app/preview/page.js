'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthButton from '../../components/AuthButton'
import SettingsButton from '../../components/SettingsButton'

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [jobDesc, setJobDesc] = useState('')
  const [customPDF, setCustomPDF] = useState(null)
  const [uploadFileName, setUploadFileName] = useState('')

  // Email states
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  // Send states
  const [sendLoading, setSendLoading] = useState(false)
  const [sendStatus, setSendStatus] = useState(null)

  useEffect(() => {
    const d = sessionStorage.getItem('agentData')
    const j = sessionStorage.getItem('jobDesc')
    const pdfUrl = sessionStorage.getItem('customPDF')
    const fileName = sessionStorage.getItem('uploadedFileName')

    if (!d || !pdfUrl) {
      router.push('/')
      return
    }

    const parsedData = JSON.parse(d)
    setData(parsedData)
    setJobDesc(j || '')
    setCustomPDF(pdfUrl)
    setUploadFileName(fileName || 'Resume.pdf')

    setEmailSubject(parsedData.email?.subject || '')
    setEmailBody(parsedData.email?.body || '')
    if (parsedData.recipientEmail) {
      setRecipientEmail(parsedData.recipientEmail)
    }
  }, [router])

  async function handleSendEmail() {
    setSendLoading(true)
    setSendStatus(null)

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          userName: data?.name || 'Haseeb ur Rahman',
          emailContent: {
            subject: emailSubject,
            body: emailBody,
          },
          customPDF: customPDF,
          resumeData: data,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to send email.')
      }

      setSendStatus('success')
    } catch (e) {
      setSendStatus('error')
    } finally {
      setSendLoading(false)
    }
  }

  if (!data) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', color: 'var(--mid)' }}>
      Loading analysis...
    </div>
  )

  const atsScore = data.atsScore || 0
  const isGoodScore = atsScore >= 70

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 60 }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: '#fff', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', transition: 'background 0.2s', color: 'var(--mid)' }}
            title="Start Over"
          >
            ←
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>ATS Analysis Result</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--mid)' }}>{uploadFileName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <SettingsButton />
          <AuthButton />
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

        {/* Left Column: ATS Analysis & Email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ATS Score Card */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 Overall ATS Match
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: `6px solid ${isGoodScore ? '#10b981' : '#f59e0b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{atsScore}</span>
                <span style={{ fontSize: 10, color: 'var(--mid)', fontWeight: 600 }}>/100</span>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: isGoodScore ? '#10b981' : '#f59e0b' }}>
                  {isGoodScore ? 'Strong Match' : 'Needs Improvement'}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--mid)', lineHeight: 1.5 }}>
                  {isGoodScore
                    ? 'This resume aligns well with the job requirements. Review recommendations for minor tweaks.'
                    : 'This resume is missing key requirements for this position. See missing skills and recommendations below.'}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>

            {/* Strengths */}
            {data.strengths && data.strengths.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', margin: '0 0 12px' }}>✓ Strengths</h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {data.strengths.map((str, i) => <li key={i} style={{ marginBottom: 6 }}>{str}</li>)}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#3b82f6', margin: '0 0 12px' }}>💡 Recommendations</h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {data.recommendations.map((rec, i) => <li key={i} style={{ marginBottom: 6 }}>{rec}</li>)}
                </ul>
              </div>
            )}

            {/* Missing Skills */}
            {data.skillMatch?.missing && data.skillMatch.missing.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444', margin: '0 0 12px' }}>⚠️ Missing Keywords</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.skillMatch.missing.map((s, i) => (
                    <span key={i} style={{ background: '#fef2f2', color: '#b91c1c', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500, border: '1px solid #fecaca' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Matched Skills */}
            {data.skillMatch?.matched && data.skillMatch.matched.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', margin: '0 0 12px' }}>✓ Matched Keywords</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.skillMatch.matched.map((s, i) => (
                    <span key={i} style={{ background: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500, border: '1px solid #a7f3d0' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Email Preview & Send */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>✉️ Cover Email</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid)', marginBottom: 4, display: 'block' }}>To:</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                  placeholder="hr@company.com"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid)', marginBottom: 4, display: 'block' }}>Subject:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mid)', marginBottom: 4, display: 'block' }}>Body:</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={10}
                  style={{ width: '100%', padding: '12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13 }}>
                {sendStatus === 'success' && <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Email sent successfully</span>}
                {sendStatus === 'error' && <span style={{ color: '#ef4444', fontWeight: 500 }}>✕ Failed to send email</span>}
              </div>
              <button
                onClick={handleSendEmail}
                disabled={sendLoading || !recipientEmail}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: (sendLoading || !recipientEmail) ? 'not-allowed' : 'pointer', opacity: (sendLoading || !recipientEmail) ? 0.7 : 1, transition: 'background 0.2s'
                }}
              >
                {sendLoading ? 'Sending...' : 'Send Application'}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: PDF Preview */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>📄 Uploaded Resume</h2>
          <div style={{ flex: 1, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#f8fafc', minHeight: 600 }}>
            {customPDF ? (
              <iframe src={customPDF} style={{ width: '100%', height: '100%', border: 'none' }} title="Resume PDF Preview" />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid)' }}>
                No PDF to preview
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
