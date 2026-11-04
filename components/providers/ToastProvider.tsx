"use client"

import { Toaster } from 'react-hot-toast'

// Quiet, text-only toasts: no animated check/cross icons, no emoji.
export default function ToastProvider() {
    return (
        <Toaster
            position="top-center"
            gutter={8}
            containerStyle={{ top: 'max(10px, env(safe-area-inset-top))', left: 12, right: 12 }}
            toastOptions={{
                duration: 2200,
                style: {
                    background: 'rgba(38, 38, 41, 0.96)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '9px 14px',
                    fontSize: '15px',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    maxWidth: '360px',
                    boxShadow: '0 6px 24px rgba(0,0,0,.45)',
                    backdropFilter: 'blur(12px)',
                },
                success: { icon: null },
                error: { icon: null, duration: 3500, style: { color: '#ffb4a8' } },
                loading: { icon: null },
            }}
        />
    )
}
