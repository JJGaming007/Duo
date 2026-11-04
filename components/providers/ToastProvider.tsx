"use client"

import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
    return (
        <Toaster
            position="top-center"
            toastOptions={{
                style: {
                    background: '#232326',
                    color: '#fff',
                    border: 'none',
                    fontSize: '15px',
                    boxShadow: '0 8px 30px rgba(0,0,0,.5)',
                    borderRadius: '12px',
                },
                success: {
                    iconTheme: {
                        primary: '#e8735a',
                        secondary: '#fff',
                    },
                },
            }}
        />
    )
}
