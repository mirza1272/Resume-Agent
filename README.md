# Resume Agent

AI-powered resume and job application assistant. Paste a job description → get an ATS-optimized resume, tailored cover email, and one-click send.

## Features

- ATS Score (0–100) with keyword analysis
- AI-generated 1-page resume (PDF)
- Professional cover email
- Live PDF preview
- Edit & approval workflow
- Upload custom resume (overrides AI)
- Send email via Gmail SMTP after approval

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Puter AI (no API key required)
- @react-pdf/renderer
- Nodemailer (Gmail SMTP)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your Gmail credentials
npm run dev
```

## Gmail SMTP Setup

1. Enable 2FA on your Gmail account
2. Go to Google Account → Security → App Passwords
3. Create a new App Password for "Mail"
4. Add to `.env`:
   ```
   GMAIL_USER=your.email@gmail.com
   GMAIL_PASS=your_16_char_app_password
   ```

## Usage

1. Configure your base resume in `resume-template.json` in the project root.
2. Open http://localhost:3000
3. Paste the target job description and click **Tailor My Resume & Email**.
4. Review the tailored resume, ATS score, and cover email on the preview page.
5. Optionally request edits using the client-side edit request tool.
6. Approve and send the application email.

## Puter AI Browser Requirements

Because Puter AI runs client-side in the browser, it requires browser permissions to perform tasks:

1. **Pop-up Permission**:
   - Clicking **Tailor My Resume & Email** initiates a pop-up window from Puter requesting permission to run.
   - Ensure your browser does not block pop-ups for `http://localhost:3000`. If blocked, look for the pop-up blocker icon in your browser's address bar and select **Always allow pop-ups from http://localhost:3000**.
   - Sign in or create a free Puter account in the pop-up window to authorize the connection.
2. **Script Blocking Extensions**:
   - Disable any extension (like ad-blockers or security shields) that might prevent `https://js.puter.com/v2/` from loading or executing.

## Deploy to Vercel

```bash
npx vercel
# Add env vars in Vercel dashboard
```
