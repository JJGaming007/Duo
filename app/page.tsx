"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/dashboard')
  }, [router])

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
    </div>
  )
}
