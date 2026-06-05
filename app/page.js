'use client'
import { generateEmail } from '../lib/emailTemplates'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { calculateATS, extractMatchedSkills } from '../utils/ats'
import AuthButton from '../components/AuthButton'

export default function Home() {
  const router = useRouter()
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Job image input OCR states
  const imageInputRef = useRef(null)
  const [inputMethod, setInputMethod] = useState('text') // 'text' or 'image'
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrExtractedText, setOcrExtractedText] = useState('')
  const [ocrFile, setOcrFile] = useState('')
  const [confirmStep, setConfirmStep] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Loading overlay component (shows a spinner while tailoring runs)
  function LoadingOverlay() {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          color: 'var(--paper)',
          fontSize: 18,
          fontWeight: 500,
        }}
      >
        <div
          className="spinner"
          style={{
            width: 48,
            height: 48,
            border: '4px solid var(--ink)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 12,
          }}
        />
        <div>Analyzing job description…</div>
      </div>
    )
  }



  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = { target: { files: [file] } }
      handleImageUpload(fakeEvent)
    } else {
      setError('Please upload a valid image file.')
    }
  }

  // Handles job posting screenshot image upload and OCR extraction using Puter vision AI
  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setOcrLoading(true)
    setError('')
    setOcrExtractedText('')
    setOcrFile(file.name)
    setConfirmStep(false)

    try {
      if (typeof window === 'undefined') {
        throw new Error('Browser environment required.')
      }

      // Convert image file to base64 Data URL
      const base64DataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target.result)
        reader.onerror = () => reject(new Error('Failed to read image file.'))
        reader.readAsDataURL(file)
      })

      // ----- NEW: Client‑side OCR using Tesseract.js -----
      // Dynamically import Tesseract only when needed (avoids bundling overhead)
      const { default: Tesseract } = await import('tesseract.js');
      const { data: { text: ocrResult } } = await Tesseract.recognize(
        base64DataUrl,
        'eng',
        { logger: m => console.log(m) }
      );
      const extractedText = ocrResult.trim();

      if (!extractedText) {
        throw new Error('Could not extract text from the image. Please try a cleaner screenshot.');
      }

      setOcrExtractedText(extractedText);
      setConfirmStep(true);
      // ---------------------------------------------------

    } catch (err) {
      setError(err.message || 'An error occurred during OCR text extraction.')
      setOcrFile('')
    } finally {
      setOcrLoading(false)
    }
  }

  // Completes the confirmation step and runs the normal tailoring flow
  function handleOcrContinue() {
    setConfirmStep(false)
    setJobDesc(ocrExtractedText)
    setTimeout(() => {
      runTailoringWithText(ocrExtractedText)
    }, 0)
  }

  function handleCancelOcr() {
    setOcrFile('')
    setOcrExtractedText('')
    setConfirmStep(false)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  // Core tailoring flow that can take a manual text param or use current state
  async function runTailoringWithText(customText) {
    const targetText = customText || jobDesc
    if (!targetText.trim()) return setError('Please paste a job description.')
    setError('')
    setLoading(true)

    try {
      const templateRes = await fetch('/api/template')
      if (!templateRes.ok) {
        throw new Error('Failed to load resume template from root directory.')
      }
      const template = await templateRes.json()

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const extractedEmails = targetText.match(emailRegex)
      const extractedEmail = extractedEmails && extractedEmails.length > 0 ? extractedEmails[0] : ''

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
${targetText}

Respond ONLY with a valid JSON object in this exact format:
{
  "atsScore": <number 0-100. Use this STRICT rubric — do NOT inflate:
    - Count how many SPECIFIC tech skills/tools from the job description are present in the resume
    - 90-100: Resume covers 90%+ of required tech skills + direct role experience match
    - 75-89: Covers 70-89% of required skills, mostly relevant experience
    - 60-74: Covers 50-69% of skills, partial experience match
    - 40-59: Covers 30-49% of skills, indirect relevance
    - Below 40: Covers less than 30% of specific requirements
    Be honest and strict. A student resume applying for a senior role should NOT score above 70.
    Only hard skills, tools, frameworks, and languages count — NOT soft skills or general experience phrases.>,
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
  "skillMatch": {
    "matched": ["<ONLY list specific tools, frameworks, languages, or libraries from the job description that exist in the resume. Do NOT include soft skills, experience levels, or generic words. Max 10 items.>"],
    "missing": ["<ONLY list specific tools, frameworks, languages, or libraries from the job description that are NOT in the resume. Each item must be a named technology — NOT a vague phrase like 'production experience'. Max 6 items. If nothing is missing, return an empty array.>"]
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

      parsed.recipientEmail = extractedEmail

      // ── Deterministic email engine (no AI generation) ──
      parsed.email = generateEmail(targetText)

      if (!parsed.atsScore) {
        parsed.atsScore = calculateATS(
          targetText,
          parsed.resume?.skills?.join(', ') || '',
          (parsed.resume?.experience?.map(e => `${e.title} ${e.company} ${e.bullets?.join(' ')}`).join(' ') || '') + ' ' +
          (parsed.resume?.projects?.map(p => `${p.title} ${p.bullets?.join(' ')}`).join(' ') || '')
        )
      }
      if (!parsed.skillMatch) {
        parsed.skillMatch = extractMatchedSkills(targetText, parsed.resume?.skills?.join(', ') || '')
      }

      sessionStorage.setItem('agentData', JSON.stringify(parsed))
      sessionStorage.setItem('jobDesc', targetText)
      sessionStorage.setItem('userInfo', JSON.stringify(template))

      sessionStorage.removeItem('uploadedFileName')
      sessionStorage.removeItem('uploadATSAnalysis')

      router.push('/preview')
    } catch (e) {
      setError(e.message || 'An error occurred during resume generation.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    await runTailoringWithText(jobDesc)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>R</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>Resume Agent</span>
        </div>
        <AuthButton />
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.2 }}>
            Land the job.<br />
            <span style={{ color: 'var(--accent)' }}>Automate the hustle.</span>
          </h1>
          <p style={{ color: 'var(--mid)', fontSize: 15 }}>Paste job text or upload an image to get an ATS-optimized resume, cover email, and quick-send.</p>
        </div>

        {/* Tab Selection Selector */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          <button
            onClick={() => { setInputMethod('text'); setError(''); }}
            disabled={loading || ocrLoading}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: inputMethod === 'text' ? '2px solid var(--accent)' : '2px solid transparent',
              color: inputMethod === 'text' ? 'var(--ink)' : 'var(--mid)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (loading || ocrLoading) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (loading || ocrLoading) ? 0.6 : 1,
            }}
          >
            📝 Paste Job Text
          </button>
          <button
            onClick={() => { setInputMethod('image'); setError(''); }}
            disabled={loading || ocrLoading}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: inputMethod === 'image' ? '2px solid var(--accent)' : '2px solid transparent',
              color: inputMethod === 'image' ? 'var(--ink)' : 'var(--mid)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (loading || ocrLoading) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (loading || ocrLoading) ? 0.6 : 1,
            }}
          >
            📷 Upload Job Image
          </button>
        </div>

        {/* Input Methods Body */}
        {inputMethod === 'text' ? (
          <div>
            <label style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Job Description Text
            </label>
            <textarea
              value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
              placeholder="Paste the full job description here — title, requirements, responsibilities, company info..."
              rows={14}
              style={{
                width: '100%',
                padding: '16px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: '#fff',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--ink)',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            />

            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleGenerate}
                disabled={loading}
                style={{
                  padding: '12px 32px',
                  background: loading ? 'var(--mid)' : 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background-color 0.2s ease',
                }}
              >
                {loading ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Generating Tailored Resume...
                  </>
                ) : '⚡ Tailor My Resume & Email'}
              </button>
            </div>
          </div>
        ) : (
          /* Image Flow */
          <div>
            {!confirmStep ? (
              <div>
                <label style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Job Posting Image
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !ocrLoading && imageInputRef.current?.click()}
                  style={{
                    border: isDragging ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                    borderRadius: '12px',
                    padding: '64px 24px',
                    textAlign: 'center',
                    background: isDragging ? 'rgba(200, 67, 26, 0.04)' : '#fff',
                    cursor: ocrLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  {ocrLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(200, 67, 26, 0.15)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <div style={{ position: 'absolute', width: '12px', height: '12px', background: 'var(--accent)', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600 }}>Analyzing Image...</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--mid)' }}>Extracting job posting text with Puter AI</p>
                      </div>
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                        animation: 'scan 2.5s ease-in-out infinite',
                        boxShadow: '0 0 8px var(--accent)',
                        zIndex: 10,
                      }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div className="upload-icon-container" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '28px' }}>📷</span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Upload job posting image</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--mid)' }}>
                        Drag and drop your screenshot here, or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>browse files</span>
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--mid)', fontFamily: 'DM Mono, monospace', marginTop: '12px' }}>
                        Supports PNG, JPG, JPEG
                      </span>
                    </div>
                  )}
                </div>

                {error && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
                    {error}
                  </div>
                )}
              </div>
            ) : (
              /* Image OCR Confirmation Step */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block' }}>
                      Extracted Job Description
                    </label>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--mid)' }}>
                      Review and edit the extracted details before generating the tailored application.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', background: 'var(--surface)', color: 'var(--ink)', padding: '6px 12px', borderRadius: '12px', fontWeight: 500, fontFamily: 'DM Mono, monospace' }}>
                      📄 {ocrFile}
                    </span>
                  </div>
                </div>

                <textarea
                  value={ocrExtractedText}
                  onChange={e => setOcrExtractedText(e.target.value)}
                  placeholder="Extracted job description text..."
                  rows={14}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: '#fff',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--ink)',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                />

                {error && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <button
                    onClick={handleCancelOcr}
                    disabled={loading}
                    style={{
                      padding: '12px 24px',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      color: 'var(--ink)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    ✕ Try Another Image
                  </button>

                  <button
                    onClick={handleOcrContinue}
                    disabled={loading || !ocrExtractedText.trim()}
                    style={{
                      padding: '12px 32px',
                      background: loading ? 'var(--mid)' : 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: (loading || !ocrExtractedText.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    {loading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Generating Tailored Resume...
                      </>
                    ) : '⚡ Continue & Tailor Resume'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        textarea:focus { border-color: var(--ink) !important; box-shadow: 0 0 0 3px rgba(15,15,15,0.06); }
        .upload-icon-container {
          transition: transform 0.2s ease, background-color 0.2s ease;
        }
        div:hover > .upload-icon-container {
          transform: translateY(-2px);
          background-color: var(--border) !important;
        }
        @media (max-width: 600px) {
          .home-card {
            width: 100% !important;
            padding: 24px 16px !important;
            border-radius: 12px !important;
          }
          .home-root {
            padding: 16px !important;
            align-items: flex-start !important;
          }
          .home-title {
            font-size: 26px !important;
          }
          .home-subtitle {
            font-size: 13px !important;
          }
        }
      ` }} />

      {loading && <LoadingOverlay />}
    </div>
  )
}
