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
      </head>
      <body>{children}</body>
    </html>
  )
}
