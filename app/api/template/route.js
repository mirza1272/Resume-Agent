import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'resume-template.json')
    const fileData = fs.readFileSync(filePath, 'utf8')
    const template = JSON.parse(fileData)
    return NextResponse.json(template)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load resume template: ' + e.message }, { status: 500 })
  }
}
