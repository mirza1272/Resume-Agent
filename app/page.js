'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculateATS, extractMatchedSkills } from '../utils/ats'

export default function Home() {
  const router = useRouter()
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!jobDesc.trim()) return setError('Please paste a job description.')
    setError('')
    setLoading(true)

    // Check if Puter JS SDK is loaded
    if (typeof window === 'undefined' || !window.puter) {
      setError('Puter AI script is loading. Please wait a moment and try again.')
      setLoading(false)
      return
    }

    try {
      // 1. Fetch base resume template from server
      const templateRes = await fetch('/api/template')
      if (!templateRes.ok) {
        throw new Error('Failed to load resume template from root directory.')
      }
      const template = await templateRes.json()

      // Extract recipient email address if present in job description
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const extractedEmails = jobDesc.match(emailRegex)
      const extractedEmail = extractedEmails && extractedEmails.length > 0 ? extractedEmails[0] : ''

      // 2. Prepare the tailor resume prompt
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

      // 3. Call Puter AI client-side
      const response = await window.puter.ai.chat(prompt)
      const content = typeof response === 'string'
        ? response
        : response?.message?.content?.[0]?.text || response?.text || JSON.stringify(response)

      // 4. Parse response
      let parsed
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)
      } catch {
        throw new Error('Failed to parse AI response. Please try again.')
      }

      parsed.recipientEmail = extractedEmail

      // Calculate local fallback/verification values if missing
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

      // 5. Save and navigate
      sessionStorage.setItem('agentData', JSON.stringify(parsed))
      sessionStorage.setItem('jobDesc', jobDesc)
      sessionStorage.setItem('userInfo', JSON.stringify(template))

      // Clear any temporary preview upload states
      sessionStorage.removeItem('uploadedFileName')
      sessionStorage.removeItem('uploadATSAnalysis')

      router.push('/preview')
    } catch (e) {
      setError(e.message || 'An error occurred during resume generation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '20px 40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>R</span>
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>Resume Agent</span>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.2 }}>
            Land the job.<br />
            <span style={{ color: 'var(--accent)' }}>Automate the hustle.</span>
          </h1>
          <p style={{ color: 'var(--mid)', fontSize: 15 }}>Paste a job description → get an ATS-optimized resume, cover email, and one-click send.</p>
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--mid)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Job Description
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
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus { border-color: var(--ink) !important; box-shadow: 0 0 0 3px rgba(15,15,15,0.06); }
      `}</style>
    </div>
  )
}
