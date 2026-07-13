import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Content Reconciliation',
  description:
    'Track environment-specific field values and reconcile them after content transfers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
