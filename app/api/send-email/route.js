import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import React from 'react'

const el = React.createElement

export async function POST(req) {
  try {
    const { to, emailContent, resumeData, userName, customPDF } = await req.json()

    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      return NextResponse.json({
        success: false,
        error: 'Email not configured. Add GMAIL_USER and GMAIL_PASS to .env'
      }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    })

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7;">
  ${(emailContent?.body || '').split('\n').map(p => p.trim() ? `<p style="margin: 0 0 14px;">${p}</p>` : '<br/>').join('')}
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="font-size: 13px; color: #666;">Resume attached as PDF</p>
</body>
</html>`

    let pdfBuffer
    if (customPDF) {
      // Decode user-uploaded custom PDF data URI
      const base64Data = customPDF.split(';base64,').pop()
      pdfBuffer = Buffer.from(base64Data, 'base64')
    } else {
      // Generate the PDF buffer dynamically using @react-pdf/renderer
      pdfBuffer = await generatePDFBuffer(resumeData)
    }

    await transporter.sendMail({
      from: `"${userName}" <${process.env.GMAIL_USER}>`,
      to,
      subject: emailContent?.subject || `Application from ${userName}`,
      html: htmlBody,
      text: emailContent?.body || '',
      attachments: [
        {
          filename: `${(userName || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }
      ]
    })

    return NextResponse.json({ success: true, message: `Email sent successfully to ${to}` })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function generatePDFBuffer(r) {
  if (!r) throw new Error('No resume data provided')

  const { pdf, Document, Page, Text, View, StyleSheet, Link, Svg, Path } = require('@react-pdf/renderer')

  // Auto-scaling logic to enforce single-page constraint
  const totalItems = (r.experience?.length || 0) + (r.education?.length || 0) + (r.projects?.length || 0)
  const totalBullets = (r.experience?.reduce((acc, exp) => acc + (exp.bullets?.length || 0), 0) || 0) +
    (r.projects?.reduce((acc, p) => acc + (p.bullets?.length || 0), 0) || 0)

  let baseFontSize = 9.5
  let titleFontSize = 20
  let subTitleFontSize = 13
  let sectionTitleFontSize = 11
  let contactFontSize = 8.5
  let entryTitleFontSize = 9.5

  let pagePaddingTop = 30
  let pagePaddingBottom = 30
  let pagePaddingHorizontal = 40

  let headerMarginBottom = 10
  let sectionMarginTop = 10
  let sectionMarginBottom = 4
  let entryMarginBottom = 6
  let bulletMarginBottom = 2
  let lineSpacing = 1.35

  if (totalItems >= 8 || totalBullets >= 12) {
    baseFontSize = 8.5
    titleFontSize = 16
    subTitleFontSize = 11
    sectionTitleFontSize = 9.5
    contactFontSize = 8
    entryTitleFontSize = 8.5
    pagePaddingTop = 22
    pagePaddingBottom = 22
    pagePaddingHorizontal = 32
    headerMarginBottom = 6
    sectionMarginTop = 7
    sectionMarginBottom = 3
    entryMarginBottom = 4
    bulletMarginBottom = 1.5
    lineSpacing = 1.2
  }

  if (totalItems >= 10 || totalBullets >= 18) {
    baseFontSize = 7.5
    titleFontSize = 14
    subTitleFontSize = 10
    sectionTitleFontSize = 8.5
    contactFontSize = 7.5
    entryTitleFontSize = 7.5
    pagePaddingTop = 16
    pagePaddingBottom = 16
    pagePaddingHorizontal = 24
    headerMarginBottom = 4
    sectionMarginTop = 4
    sectionMarginBottom = 1
    entryMarginBottom = 2
    bulletMarginBottom = 1
    lineSpacing = 1.1
  }

  const styles = StyleSheet.create({
    page: {
      paddingTop: pagePaddingTop,
      paddingBottom: pagePaddingBottom,
      paddingHorizontal: pagePaddingHorizontal,
      fontFamily: 'Helvetica',
      fontSize: baseFontSize,
      color: '#2d3748',
    },
    header: {
      marginBottom: headerMarginBottom,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 4,
    },
    name: {
      fontSize: titleFontSize,
      fontFamily: 'Helvetica-Bold',
      color: '#2c3e50',
    },
    title: {
      fontSize: subTitleFontSize,
      fontFamily: 'Helvetica',
      color: '#7f8c8d',
    },
    contactRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 12,
      rowGap: 4,
      borderBottom: '1pt solid #cbd5e0',
      paddingBottom: 6,
      marginBottom: 4,
    },
    contactGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    contactItem: {
      fontSize: contactFontSize,
      color: '#4a5568',
      textDecoration: 'none',
    },
    sectionTitle: {
      fontSize: sectionTitleFontSize,
      fontFamily: 'Helvetica-Bold',
      color: '#2c3e50',
      marginTop: sectionMarginTop,
      marginBottom: sectionMarginBottom,
      borderBottom: '1pt solid #2c3e50',
      paddingBottom: 1.5,
    },
    summary: {
      fontSize: baseFontSize,
      lineHeight: lineSpacing,
      color: '#2d3748',
      textAlign: 'justify',
    },
    entryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 1,
      marginTop: 2,
    },
    entryLeft: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      maxWidth: '70%',
    },
    entryTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: entryTitleFontSize,
      color: '#2d3748',
    },
    entryCompany: {
      fontFamily: 'Helvetica-Oblique',
      fontSize: entryTitleFontSize,
      color: '#4a5568',
      marginLeft: 3,
    },
    entryRight: {
      alignItems: 'flex-end',
      maxWidth: '30%',
    },
    entryDate: {
      fontSize: baseFontSize - 0.5,
      color: '#4a5568',
      fontFamily: 'Helvetica-Bold',
    },
    entryLoc: {
      fontSize: baseFontSize - 1,
      color: '#718096',
      marginTop: 0.5,
    },
    bullet: {
      flexDirection: 'row',
      marginBottom: bulletMarginBottom,
      paddingLeft: 8,
      marginTop: 1,
    },
    bulletDot: {
      fontSize: baseFontSize,
      marginRight: 4,
      color: '#2d3748',
    },
    bulletText: {
      fontSize: baseFontSize - 0.5,
      lineHeight: lineSpacing,
      color: '#2d3748',
      flex: 1,
    },
    skillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 3,
      marginTop: 2,
    },
    skillItem: {
      width: '25%',
      fontSize: baseFontSize - 0.5,
      color: '#2d3748',
      paddingLeft: 8,
    },
  })

  // Vector SVG Icons in pure JS React elements
  const PhoneIcon = () => el(Svg, { width: 8, height: 8, viewBox: '0 0 24 24' },
    el(Path, { fill: '#4a5568', d: 'M6.62 10.79c1.44 2.82 3.76 5.14 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z' })
  )

  const EmailIcon = () => el(Svg, { width: 8, height: 8, viewBox: '0 0 24 24' },
    el(Path, { fill: '#4a5568', d: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' })
  )

  const LocationIcon = () => el(Svg, { width: 8, height: 8, viewBox: '0 0 24 24' },
    el(Path, { fill: '#4a5568', d: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' })
  )

  const LinkedInIcon = () => el(Svg, { width: 8, height: 8, viewBox: '0 0 24 24' },
    el(Path, { fill: '#4a5568', d: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z' })
  )

  const GitHubIcon = () => el(Svg, { width: 8, height: 8, viewBox: '0 0 24 24' },
    el(Path, { fill: '#4a5568', d: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' })
  )

  const PortfolioIcon = () => el(Svg, { width: 8, height: 8, viewBox: '0 0 24 24' },
    el(Path, { fill: '#4a5568', d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' })
  )

  const doc = el(Document, {},
    el(Page, { size: 'A4', style: styles.page },
      el(View, { style: styles.header },
        el(View, { style: styles.nameRow },
          el(Text, { style: styles.name }, r.name),
          r.title ? el(Text, { style: styles.title }, r.title) : null
        ),
        el(View, { style: styles.contactRow },
          r.phone ? el(View, { style: styles.contactGroup },
            el(PhoneIcon),
            el(Text, { style: styles.contactItem }, r.phone)
          ) : null,
          r.email ? el(View, { style: styles.contactGroup },
            el(EmailIcon),
            el(Link, { src: `mailto:${r.email}`, style: styles.contactItem }, 'Email')
          ) : null,
          r.location ? el(View, { style: styles.contactGroup },
            el(LocationIcon),
            el(Text, { style: styles.contactItem }, r.location)
          ) : null,
          r.linkedin ? el(View, { style: styles.contactGroup },
            el(LinkedInIcon),
            el(Link, { src: r.linkedin.startsWith('http') ? r.linkedin : `https://${r.linkedin}`, style: styles.contactItem }, 'LinkedIn')
          ) : null,
          r.github ? el(View, { style: styles.contactGroup },
            el(GitHubIcon),
            el(Link, { src: r.github.startsWith('http') ? r.github : `https://${r.github}`, style: styles.contactItem }, 'GitHub')
          ) : null,
          r.portfolio ? el(View, { style: styles.contactGroup },
            el(PortfolioIcon),
            el(Link, { src: r.portfolio.startsWith('http') ? r.portfolio : `https://${r.portfolio}`, style: styles.contactItem }, 'Portfolio')
          ) : null
        )
      ),

      r.summary ? el(View, {},
        el(Text, { style: styles.sectionTitle }, 'Profile'),
        el(Text, { style: styles.summary }, r.summary)
      ) : null,

      (r.experience && r.experience.length > 0) ? el(View, {},
        el(Text, { style: styles.sectionTitle }, 'Employment History'),
        r.experience.map((exp, i) => el(View, { key: i, style: { marginBottom: entryMarginBottom } },
          el(View, { style: styles.entryRow },
            el(View, { style: styles.entryLeft },
              el(Text, { style: styles.entryTitle }, exp.title),
              exp.company ? el(Text, { style: styles.entryCompany }, `, ${exp.company}`) : null
            ),
            el(View, { style: styles.entryRight },
              el(Text, { style: styles.entryDate }, exp.dates),
              exp.location ? el(Text, { style: styles.entryLoc }, exp.location) : null
            )
          ),
          (exp.bullets || []).map((b, bi) => el(View, { key: bi, style: styles.bullet },
            el(Text, { style: styles.bulletDot }, '•'),
            el(Text, { style: styles.bulletText }, b)
          ))
        ))
      ) : null,

      (r.education && r.education.length > 0) ? el(View, {},
        el(Text, { style: styles.sectionTitle }, 'Education'),
        r.education.map((edu, i) => el(View, { key: i, style: { marginBottom: entryMarginBottom } },
          el(View, { style: styles.entryRow },
            el(View, { style: styles.entryLeft },
              el(Text, { style: styles.entryTitle }, edu.degree),
              edu.school ? el(Text, { style: styles.entryCompany }, `, ${edu.school}`) : null
            ),
            el(View, { style: styles.entryRight },
              el(Text, { style: styles.entryDate }, edu.year),
              edu.location ? el(Text, { style: styles.entryLoc }, edu.location) : null
            )
          )
        ))
      ) : null,

      (r.skills && r.skills.length > 0) ? el(View, {},
        el(Text, { style: styles.sectionTitle }, 'Skills'),
        el(View, { style: styles.skillsContainer },
          r.skills.map((s, i) => el(View, { key: i, style: styles.skillItem },
            el(Text, {}, `• ${s}`)
          ))
        )
      ) : null,

      (r.projects && r.projects.length > 0) ? el(View, {},
        el(Text, { style: styles.sectionTitle }, 'Projects'),
        r.projects.map((proj, i) => el(View, { key: i, style: { marginBottom: entryMarginBottom } },
          el(View, { style: styles.entryRow },
            el(View, { style: styles.entryLeft },
              el(Text, { style: styles.entryTitle }, proj.title),
              proj.subtitle ? el(Text, { style: styles.entryCompany }, `, ${proj.subtitle}`) : null
            )
          ),
          (proj.bullets || []).map((b, bi) => el(View, { key: bi, style: styles.bullet },
            el(Text, { style: styles.bulletDot }, '•'),
            el(Text, { style: styles.bulletText }, b)
          ))
        ))
      ) : null
    )
  )

  const pdfInstance = pdf(doc)
  const buffer = await pdfInstance.toBuffer()
  return buffer
}
