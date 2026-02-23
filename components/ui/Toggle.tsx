"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
    ({ className, label, ...props }, ref) => {
        return (
            <label className="inline-flex items-center cursor-pointer group">
                <div className="relative">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        ref={ref}
                        {...props}
                    />
                    <div className={cn(
                        "w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:bg-white",
                        className
                    )}></div>
                </div>
                {label && (
                    <span className="ml-3 text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {label}
                    </span>
                )}
            </label>
        )
    }
)
Toggle.displayName = "Toggle"

export { Toggle }
