"use client"

import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
    return (
        <Toaster
            position="bottom-center"
            toastOptions={{
                style: {
                    background: '#18181b', // zinc-900
                    color: '#f4f4f5', // zinc-100
                    border: '1px solid #27272a', // zinc-800
                    borderRadius: '12px',
                },
                success: {
                    iconTheme: {
                        primary: '#16a34a', // green-600
                        secondary: '#fff',
                    },
                },
            }}
        />
    )
}
