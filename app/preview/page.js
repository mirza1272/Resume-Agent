'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ResumePDFViewer = dynamic(() => import('../../components/ResumePDFViewer'), { ssr: false })

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [jobDesc, setJobDesc] = useState('')
  const [userInfo, setUserInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('resume')

  // Edit states
  const [editMode, setEditMode] = useState(false)
  const [editRequest, setEditRequest] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Email states (fully editable)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  // Send states
  const [sendLoading, setSendLoading] = useState(false)
  const [sendStatus, setSendStatus] = useState(null)

  // Custom PDF upload
  const [customPDF, setCustomPDF] = useState(null)
  const fileRef = useRef(null)

  // Memoize the heavy PDF rendering to prevent lag on keystroke changes
  const pdfViewerEl = useMemo(() => {
    if (!data?.resume) return null
    return <ResumePDFViewer resumeData={data.resume} />
  }, [data?.resume])

  useEffect(() => {
    const d = sessionStorage.getItem('agentData')
    const j = sessionStorage.getItem('jobDesc')
    const u = sessionStorage.getItem('userInfo')
    if (!d) { router.push('/'); return }

    const parsedData = JSON.parse(d)
    setData(parsedData)
    setJobDesc(j || '')
    setUserInfo(u ? JSON.parse(u) : null)

    setEmailSubject(parsedData.email?.subject || '')
    setEmailBody(parsedData.email?.body || '')

    if (parsedData.recipientEmail) {
      setRecipientEmail(parsedData.recipientEmail)
    } else if (u) {
      setRecipientEmail(JSON.parse(u).email || '')
    }
  }, [])

  // Regenerates the entire tailored resume & email from the base template
  async function handleRegenerate() {
    if (typeof window === 'undefined' || !window.puter) {
      setEditError('Puter AI script is not loaded yet. Please try again.')
      return
    }
    setEditLoading(true)
    setEditError('')
    try {
      // 1. Fetch template from server
      const templateRes = await fetch('/api/template')
      if (!templateRes.ok) throw new Error('Failed to load resume template.')
      const template = await templateRes.json()

      // 2. Prepare prompting
      const prompt = `You are an expert resume writer and ATS optimization specialist.

Given the following base resume template and job description, tailor the resume to fit the job description, calculate the ATS score, and generate a professional cover email.

USER CONTEXT (MANDATORY INJECTION):
The applicant is:
- A Computer Science student
- Specializing in Artificial Intelligence and Machine Learning
- Skilled in Python, Deep Learning, and Full-Stack Development
- Actively building real-world projects (including AI Resume Agent, CNN-based classifiers, and web applications)
- Actively applying for internships and junior software/AI roles
- Goal: To get AI/ML Engineer or Software Engineer internships
This context MUST be included implicitly in every email generation task. Do NOT explicitly list this context in emails. Instead, naturally reflect it in tone and content.

BASE RESUME:
${JSON.stringify(template, null, 2)}

JOB DESCRIPTION:
${jobDesc}

Respond ONLY with a valid JSON object in this exact format:
{
  "atsScore": <number 0-100 based on keyword match, skills match, project relevance, and education relevance>,
  "resume": {
    "name": "${template.name}",
    "title": "${template.title || 'Software Engineer'}",
    "email": "${template.email}",
    "phone": "${template.phone || ''}",
    "location": "${template.location || ''}",
    "linkedin": "${template.linkedin || ''}",
    "github": "${template.github || ''}",
    "portfolio": "${template.portfolio || ''}",
    "summary": "<2-3 sentence tailored summary matching the job description>",
    "experience": [
      {
        "title": "<tailored job title or template title>",
        "company": "<company from template>",
        "dates": "<dates from template>",
        "location": "<location from template>",
        "bullets": ["<tailored bullet 1>", "<tailored bullet 2>", "<tailored bullet 3>"]
      }
    ],
    "education": [
      {
        "degree": "<degree from template>",
        "school": "<school from template>",
        "year": "<year from template>",
        "location": "<location from template>"
      }
    ],
    "skills": ["<selected skills from template + additional relevant skills, max 20 items>"],
    "projects": [
      {
        "title": "<project title from template>",
        "subtitle": "<project subtitle/tech stack from template>",
        "bullets": ["<tailored achievement bullet focusing on keywords - MUST be 1-2 lines maximum, no longer>"]
      }
    ]
  },
  "email": {
    "subject": "<Concise subject line targeting the role, e.g. 'Application for Software Engineer Internship' or 'Application for Junior AI Engineer Role' - MAX 60 characters>",
    "body": "<Professional formal cover email that MUST strictly follow this layout and writing rules:
    
    Dear Hiring Team, (or 'Dear Hiring Manager,', or 'Dear Recruitment Team,')
    
    I am writing to apply for the [Tailored Position Name] position. [Brief introduction mentioning target role and background]
    
    [Brief paragraph explaining why the candidate is a strong fit, highlighting 1-2 key skills or experiences from the tailored resume. Keep it extremely natural, concise, and human-written. Do not use AI-like exaggeration phrases such as 'excited to apply' or 'perfect fit'.]
    
    Thank you for your time and consideration.
    
    Best Regards,
    Haseeb ur Rahman
    +92 303 8607925
    Portfolio: https://mirzahaseeb.me/
    GitHub: https://github.com/mirza1272/
    
    Ensure the email body is between 80 to 180 words total. Use simple, natural human language. No robotic fillers or placeholder brackets.>"
  },
  "skillMatch": {
    "matched": ["<skills from template that match job keywords>"],
    "missing": ["<key skills requested in job description that are NOT in candidate's skills list>"]
  }
}

Rules:
1. Wording must sound human-written, natural, and not AI-generated. Avoid exaggerated claims and preserve existing achievements.
2. Maintain the candidate's core identity (name, email, phone, location, linkedin, github, portfolio, school, company names, dates). Do not invent new jobs or schools.
3. Tailor the summary, skills selection, and experience/project bullets to highlight achievements and keywords that match the job description.
4. Each project bullet/description MUST be exactly 1 to 2 lines maximum. Keep it concise.
5. Email subject line must be under 60 characters.
6. Email body must start with a formal greeting, follow the structure, contain the fixed regards and candidate signature exactly, and be between 80 to 180 words total.
7. Output ONLY valid JSON. Do not write anything else. No explanation, no markdown formatting.`

      const response = await window.puter.ai.chat(prompt)
      const content = typeof response === 'string'
        ? response
        : response?.message?.content?.[0]?.text || response?.text || JSON.stringify(response)

      let parsed
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)
      } catch {
        throw new Error('Failed to parse AI response. Please try again.')
      }

      // Calculate fallback/verification values
      const { calculateATS, extractMatchedSkills } = await import('../../utils/ats')
      if (!parsed.atsScore) {
        parsed.atsScore = calculateATS(
          jobDesc,
          parsed.resume?.skills?.join(', ') || '',
          (parsed.resume?.experience?.map(e => `${e.title} ${e.company} ${e.bullets?.join(' ')}`).join(' ') || '') + ' ' +
          (parsed.resume?.projects?.map(p => `${p.title} ${p.bullets?.join(' ')}`).join(' ') || '')
        )
      }
      if (!parsed.skillMatch) {
        parsed.skillMatch = extractMatchedSkills(jobDesc, parsed.resume?.skills?.join(', ') || '')
      }

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const extractedEmails = jobDesc.match(emailRegex)
      parsed.recipientEmail = extractedEmails && extractedEmails.length > 0 ? extractedEmails[0] : ''

      // 3. Update state
      setData(parsed)
      setEmailSubject(parsed.email?.subject || '')
      setEmailBody(parsed.email?.body || '')
      if (parsed.recipientEmail) {
        setRecipientEmail(parsed.recipientEmail)
      }
      sessionStorage.setItem('agentData', JSON.stringify(parsed))
    } catch (e) {
      setEditError(e.message || 'An error occurred during regeneration.')
    } finally {
      setEditLoading(false)
    }
  }

  // Modifies current tailored details based on user feedback/input
  async function handleEdit() {
    if (!editRequest.trim()) return
    if (typeof window === 'undefined' || !window.puter) {
      setEditError('Puter AI script is not loaded yet. Please try again.')
      return
    }
    setEditLoading(true)
    setEditError('')
    try {
      const prompt = `You are an expert resume writer. The user wants to edit their tailored resume and cover email based on their feedback.

USER CONTEXT (MANDATORY INJECTION):
The applicant is:
- A Computer Science student
- Specializing in Artificial Intelligence and Machine Learning
- Skilled in Python, Deep Learning, and Full-Stack Development
- Actively building real-world projects (including AI Resume Agent, CNN-based classifiers, and web applications)
- Actively applying for internships and junior software/AI roles
- Goal: To get AI/ML Engineer or Software Engineer internships
This context MUST be included implicitly in every email generation task. Do NOT explicitly list this context in emails. Instead, naturally reflect it in tone and content.

CURRENT RESUME DATA:
${JSON.stringify(data.resume, null, 2)}

CURRENT EMAIL:
Subject: ${emailSubject}
Body: ${emailBody}

JOB DESCRIPTION:
${jobDesc}

USER'S EDIT REQUEST:
${editRequest}

Apply the requested changes and respond ONLY with a valid JSON object in this exact format:
{
  "atsScore": <number 0-100, update if the changes affect relevance>,
  "resume": {
    "name": "${data.resume.name}",
    "title": "${data.resume.title || 'Software Engineer'}",
    "email": "${data.resume.email}",
    "phone": "${data.resume.phone || ''}",
    "location": "${data.resume.location || ''}",
    "linkedin": "${data.resume.linkedin || ''}",
    "github": "${data.resume.github || ''}",
    "portfolio": "${data.resume.portfolio || ''}",
    "summary": "<updated tailored summary>",
    "experience": [
      {
        "title": "<job title>",
        "company": "<company>",
        "dates": "<dates>",
        "location": "<location>",
        "bullets": ["<bullet1>", "<bullet2>", "<bullet3>"]
      }
    ],
    "education": [
      {
        "degree": "<degree>",
        "school": "<school>",
        "year": "<year>",
        "location": "<location>"
      }
    ],
    "skills": ["<skill1>", "..."],
    "projects": [
      {
        "title": "<project title>",
        "subtitle": "<project subtitle/tech stack>",
        "bullets": ["<bullet1>"]
      }
    ]
  },
  "email": {
    "subject": "<Updated subject line - MAX 60 characters>",
    "body": "<Updated professional formal cover email following this structure:
    
    Dear Hiring Team, (or 'Dear Hiring Manager,', or 'Dear Recruitment Team,')
    
    I am writing to apply for the [Tailored Position Name] position. [Brief introduction mentioning target role and background]
    
    [Brief paragraph explaining why the candidate is a strong fit, highlighting 1-2 key skills or experiences from the tailored resume. Keep it extremely natural, concise, and human-written. Do not use AI-like exaggeration phrases such as 'excited to apply' or 'perfect fit'.]
    
    Thank you for your time and consideration.
    
    Best Regards,
    Haseeb ur Rahman
    +92 303 8607925
    Portfolio: https://mirzahaseeb.me/
    GitHub: https://github.com/mirza1272/
    
    Ensure the email body is between 80 to 180 words total. Use simple, natural human language. No robotic fillers or placeholder brackets.>"
  },
  "skillMatch": ${JSON.stringify(data.skillMatch)}
}

Rules:
1. Maintain the JSON structure exactly.
2. Apply the edit request carefully. Each project description bullet must remain exactly 1-2 lines maximum.
3. Wording must remain natural, human-written, and professional.
4. The email body must start with a formal greeting, follow the structure, contain the fixed regards and candidate signature exactly, and be between 80 to 180 words total.
5. Output ONLY valid JSON. No markdown, no pre-text or post-text.`

      const response = await window.puter.ai.chat(prompt)
      const content = typeof response === 'string'
        ? response
        : response?.message?.content?.[0]?.text || response?.text || JSON.stringify(response)

      let parsed
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)
      } catch {
        throw new Error('Failed to parse AI response. Please try again.')
      }

      setData(parsed)
      setEmailSubject(parsed.email?.subject || '')
      setEmailBody(parsed.email?.body || '')
      sessionStorage.setItem('agentData', JSON.stringify(parsed))
      setEditMode(false)
      setEditRequest('')
    } catch (e) {
      setEditError(e.message || 'An error occurred during editing.')
    } finally {
      setEditLoading(false)
    }
  }

  // Submits the application email
  async function handleSend() {
    if (!recipientEmail.trim()) {
      setSendStatus({ success: false, message: 'Please specify a recipient email address.' })
      return
    }
    setSendLoading(true)
    setSendStatus(null)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          emailContent: {
            subject: emailSubject,
            body: emailBody
          },
          resumeData: data.resume,
          userName: userInfo?.name || 'Applicant',
          customPDF: customPDF, // Pass the base64 encoded uploaded custom PDF if present
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setSendStatus({ success: true, message: result.message })
    } catch (e) {
      setSendStatus({ success: false, message: e.message })
    } finally {
      setSendLoading(false)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCustomPDF(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function getScoreColor(score) {
    if (score >= 80) return '#16a34a'
    if (score >= 60) return '#d97706'
    return '#dc2626'
  }

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--mid)', fontSize: 14 }}>Loading your results...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const score = data.atsScore || 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Resume Agent</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'DM Mono, monospace' }}>ATS MATCH SCORE</span>
            <div style={{
              padding: '4px 12px',
              borderRadius: 20,
              background: getScoreColor(score),
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'DM Mono, monospace',
            }}>
              {score}/100
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 28 }}>
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {['resume', 'email'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? 'var(--ink)' : 'var(--mid)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                  textTransform: 'capitalize',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {tab === 'resume' ? '📄 Resume' : '✉️ Email Application'}
              </button>
            ))}
          </div>

          {activeTab === 'resume' && (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: '6px 14px', border: '1px solid var(--border)', background: '#fff', borderRadius: 5, fontSize: 12, cursor: 'pointer', color: 'var(--mid)' }}
                >
                  📎 Upload Custom Resume
                </button>
                {customPDF && (
                  <button onClick={() => setCustomPDF(null)} style={{ padding: '6px 14px', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 5, fontSize: 12, cursor: 'pointer', color: '#dc2626' }}>
                    ✕ Remove Upload
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
              </div>

              {customPDF ? (
                <iframe src={customPDF} style={{ width: '100%', height: 700, border: '1px solid var(--border)', borderRadius: 8 }} />
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                  {pdfViewerEl}
                </div>
              )}
            </div>
          )}

          {activeTab === 'email' && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Recipient Email
                  </label>
                  <input
                    type="text"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="e.g. careers@company.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      outline: 'none',
                      color: 'var(--ink)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    placeholder="e.g. Application for Software Engineer Role"
                    maxLength={60}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      outline: 'none',
                      color: 'var(--ink)'
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--mid)', marginTop: 4, display: 'block' }}>
                    {emailSubject.length}/60 characters
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Editable Email Body
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    placeholder="Write your email here..."
                    rows={12}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: 1.6,
                      fontFamily: 'DM Sans, sans-serif',
                      outline: 'none',
                      resize: 'vertical',
                      color: 'var(--ink)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ATS Match Card */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
              ATS Analysis
            </h3>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--mid)' }}>Keywords & Skills Match</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(score) }}>{score}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: getScoreColor(score), borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {data.skillMatch && (
              <div>
                <p style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Matched Skills</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(data.skillMatch.matched || []).slice(0, 8).map((s, i) => (
                    <span key={i} style={{ padding: '3px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 11, color: '#16a34a' }}>{s}</span>
                  ))}
                </div>
                {(data.skillMatch.missing || []).length > 0 && (
                  <>
                    <p style={{ fontSize: 11, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 12 }}>Missing Skills</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(data.skillMatch.missing || []).slice(0, 5).map((s, i) => (
                        <span key={i} style={{ padding: '3px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 11, color: '#dc2626' }}>{s}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Center */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
              Action Center
            </h3>

            <button
              onClick={handleSend}
              disabled={sendLoading || editLoading}
              style={{
                width: '100%',
                padding: '11px',
                background: sendLoading ? 'var(--mid)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 14,
                fontWeight: 600,
                cursor: (sendLoading || editLoading) ? 'not-allowed' : 'pointer',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {sendLoading ? 'Sending Application...' : '🚀 Approve & Send'}
            </button>

            {sendStatus && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: sendStatus.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${sendStatus.success ? '#bbf7d0' : '#fecaca'}`,
                color: sendStatus.success ? '#16a34a' : '#dc2626',
                fontSize: 13,
                marginBottom: 12,
              }}>
                {sendStatus.message}
              </div>
            )}

            <button
              onClick={handleRegenerate}
              disabled={editLoading || sendLoading}
              style={{
                width: '100%',
                padding: '10px',
                background: '#fff',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: (editLoading || sendLoading) ? 'not-allowed' : 'pointer',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              {editLoading ? 'Processing...' : '⚡ Regenerate'}
            </button>

            <button
              onClick={() => setEditMode(!editMode)}
              disabled={editLoading || sendLoading}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                color: 'var(--mid)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              ✏️ Request Changes
            </button>

            {editMode && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={editRequest}
                  onChange={e => setEditRequest(e.target.value)}
                  placeholder="Describe changes... e.g. Make the summary more concise, highlight React skills, change tone..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    color: 'var(--ink)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'DM Sans, sans-serif',
                    lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={handleEdit}
                  disabled={editLoading}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    padding: '9px',
                    background: editLoading ? 'var(--mid)' : 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: editLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editLoading ? 'Applying Changes...' : 'Apply Feedback'}
                </button>
              </div>
            )}

            {editError && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 12 }}>
                {editError}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
