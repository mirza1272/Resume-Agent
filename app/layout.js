import './globals.css'

export const metadata = {
  title: 'Resume Agent',
  description: 'AI-powered resume and job application assistant',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://js.puter.com/v2/"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js"></script>
      </head>
      <body>{children}</body>
    </html>
  )
}
