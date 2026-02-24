"use client"

import { useState, useEffect } from 'react'
import { DuoUser } from './constants'

export function useIdentity() {
    const [currentId, setCurrentId] = useState<DuoUser | null>(null)

    useEffect(() => {
        const stored = localStorage.getItem('codetrack-user-id') as DuoUser
        if (stored) {
            setCurrentId(stored)
        } else {
            // Default to user-1 if none set
            localStorage.setItem('codetrack-user-id', 'user-1')
            setCurrentId('user-1')
        }
    }, [])

    const switchUser = (id: DuoUser) => {
        localStorage.setItem('codetrack-user-id', id)
        setCurrentId(id)
        window.location.reload() // Reload to refresh all data context
    }

    return { currentId, switchUser, isLoading: currentId === null }
}
