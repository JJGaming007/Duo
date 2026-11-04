import { redirect } from 'next/navigation'

// "/" is also redirected in next.config.ts; this is a fallback.
export default function RootPage() {
    redirect('/dashboard')
}
