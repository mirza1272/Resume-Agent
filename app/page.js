'use client'
import { generateEmail } from '../lib/emailTemplates'
import Tesseract from 'tesseract.js'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { calculateATS, extractMatchedSkills } from '../utils/ats'
import AuthButton from '../components/AuthButton'
import SettingsButton from '../components/SettingsButton'

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

  // Resume Upload states
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeDataUrl, setResumeDataUrl] = useState('')
  const [resumeExtractedText, setResumeExtractedText] = useState('')
  const resumeInputRef = useRef(null)

  // Document extractors
  async function extractTextFromPDF(dataUrl) {
    if (typeof window === 'undefined' || !window.pdfjsLib) {
      throw new Error('PDF.js library is loading. Please wait and try again.')
    }
    const pdfjsLib = window.pdfjsLib
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
    const loadingTask = pdfjsLib.getDocument(dataUrl)
    const pdf = await loadingTask.promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const items = content.items.filter(item => item.str?.trim() || item.str === ' ')
      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5]
        if (Math.abs(yDiff) > 4) return yDiff
        return a.transform[4] - b.transform[4]
      })
      let lastY = -1
      const textItems = []
      for (const item of items) {
        const currentY = item.transform[5]
        if (lastY !== -1 && Math.abs(currentY - lastY) > 4) {
          textItems.push('\n')
        } else if (lastY !== -1 && textItems.length > 0 && textItems[textItems.length - 1] !== '\n') {
          const lastStr = textItems[textItems.length - 1]
          if (!lastStr.endsWith(' ') && !item.str.startsWith(' ')) textItems.push(' ')
        }
        textItems.push(item.str)
        lastY = currentY
      }
      text += textItems.join('') + '\n\n'
    }
    return text
  }

  function readDocxFile(file) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.mammoth) return reject(new Error('Mammoth.js library is loading. Please wait.'))
      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        const arrayBuffer = loadEvent.target.result
        window.mammoth.extractRawText({ arrayBuffer })
          .then(result => resolve(result.value))
          .catch(reject)
      }
      reader.onerror = () => reject(new Error('Failed to read file buffer.'))
      reader.readAsArrayBuffer(file)
    })
  }

  function readTxtFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('Failed to read text file.'))
      reader.readAsText(file)
    })
  }

  async function handleResumeUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setResumeFile(file)
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      setResumeDataUrl(ev.target.result)
    }
    reader.readAsDataURL(file)

    try {
      let extractedText = ''
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const dataUrl = await new Promise((resolve, reject) => {
          const rdr = new FileReader()
          rdr.onload = (ev) => resolve(ev.target.result)
          rdr.onerror = () => reject(new Error('Failed to read PDF file.'))
          rdr.readAsDataURL(file)
        })
        extractedText = await extractTextFromPDF(dataUrl)
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        extractedText = await readDocxFile(file)
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        extractedText = await readTxtFile(file)
      } else {
        throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT.')
      }

      if (!extractedText.trim()) throw new Error('Could not extract text from file.')
      setResumeExtractedText(extractedText)
    } catch (err) {
      setError(err.message || 'Error parsing resume file.')
      setResumeFile(null)
      setResumeDataUrl('')
    }
  }

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
    if (!resumeExtractedText.trim()) return setError('Please upload a resume to continue.')
    setError('')
    setLoading(true)

    try {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const extractedEmails = targetText.match(emailRegex)
      const extractedEmail = extractedEmails && extractedEmails.length > 0 ? extractedEmails[0] : ''

      const prompt = `You are an expert ATS evaluator. Your job is to accurately analyze an uploaded resume against a target job description.

UPLOADED RESUME TEXT:
${resumeExtractedText}

TARGET JOB DESCRIPTION:
${targetText}

Respond ONLY with a valid JSON object in this exact format:
{
  "atsScore": <number 0-100. Evaluate Skill Match, Experience Match, Project Relevance, Education Relevance, Missing Keywords, Job-Specific Requirements. Be honest and strict.>,
  "strengths": ["<List 2-3 specific strong points of the resume for this job>"],
  "recommendations": ["<Provide 2-3 specific, actionable recommendations to improve the resume based on the actual job description. Must NOT be generic.>"],
  "skillMatch": {
    "matched": ["<ONLY list specific tools, frameworks, languages, or libraries from the job description that exist in the resume. Max 10 items.>"],
    "missing": ["<ONLY list specific tools, frameworks, languages, or libraries from the job description that are NOT in the resume. Max 6 items. If nothing is missing, return an empty array.>"]
  }
}

Rules:
1. Do NOT invent information. ONLY use the provided uploaded resume text.
2. Output ONLY valid JSON. Do not write anything else.`

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
        parsed.atsScore = calculateATS(targetText, resumeExtractedText, '')
      }
      if (!parsed.skillMatch) {
        parsed.skillMatch = extractMatchedSkills(targetText, resumeExtractedText)
      }

      sessionStorage.setItem('agentData', JSON.stringify(parsed))
      sessionStorage.setItem('jobDesc', targetText)
      sessionStorage.setItem('uploadedFileName', resumeFile?.name || 'Resume.pdf')
      sessionStorage.setItem('customPDF', resumeDataUrl)
      sessionStorage.setItem('customResumeText', resumeExtractedText)

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <SettingsButton />
          <AuthButton />
        </div>
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
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            1. Upload Resume (Required)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => resumeInputRef.current?.click()}
              style={{ padding: '10px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600, color: 'var(--ink)' }}
            >
              📎 Select File
            </button>
            <span style={{ fontSize: 14, color: 'var(--mid)' }}>{resumeFile ? resumeFile.name : 'No file chosen (PDF, DOCX, TXT)'}</span>
            <input type="file" ref={resumeInputRef} onChange={handleResumeUpload} accept=".pdf,.docx,.txt" style={{ display: 'none' }} />
          </div>
        </div>

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
                    Analyzing Resume...
                  </>
                ) : '⚡ Analyze Resume & Generate Email'}
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
