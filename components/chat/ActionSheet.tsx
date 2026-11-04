"use client"

import { useState } from 'react'
import { Copy, CornerUpLeft, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REACTION_EMOJIS } from '@/lib/moods'
import { dayLabel, timeLabel } from '@/lib/dates'
import type { ChatMessage } from '@/lib/types'

type Props = {
    m: ChatMessage
    mine: boolean
    myReaction?: string
    canEdit: boolean
    onClose: () => void
    onReact: (emoji: string) => void
    onReply: () => void
    onCopy: () => void
    onEdit: () => void
    onDeleteForMe: () => void
    onDeleteForEveryone: () => void
}

const at = (iso: string) => `${dayLabel(iso)} at ${timeLabel(iso)}`

export function ActionSheet({ m, mine, myReaction, canEdit, onClose, onReact, onReply, onCopy, onEdit, onDeleteForMe, onDeleteForEveryone }: Props) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const live = !m.pending && !m.failed && !m.deleted

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-t-2xl bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {confirmDelete ? (
                    <>
                        <p className="px-2 pb-3 pt-1 text-center text-[14px] text-muted">Delete message?</p>
                        <div className="overflow-hidden rounded-xl bg-surface-2 [&>*+*]:border-t [&>*+*]:border-line">
                            {mine && !m.deleted && !m.pending && !m.failed && (
                                <SheetItem icon={<Trash2 className="h-5 w-5" />} label="Delete for everyone" danger onClick={onDeleteForEveryone} />
                            )}
                            <SheetItem icon={<EyeOff className="h-5 w-5" />} label="Delete for me" danger onClick={onDeleteForMe} />
                        </div>
                        <button onClick={onClose} className="mt-2 w-full rounded-xl bg-surface-2 py-3 text-[16px] font-semibold">
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <div className="mb-3 flex items-center gap-3 px-2 pt-1">
                            {m.image && (
                                // eslint-disable-next-line @next/next/no-img-element -- thumbnail
                                <img src={m.image.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                            )}
                            <p className="line-clamp-3 text-[14px] text-muted">
                                {m.deleted ? 'Deleted message' : m.content || (m.image ? 'Photo' : m.audio ? 'Voice message' : '')}
                            </p>
                        </div>

                        {live && (
                            <div className="mb-3 flex justify-between rounded-xl bg-surface-2 p-1.5">
                                {REACTION_EMOJIS.map((e) => (
                                    <button
                                        key={e}
                                        onClick={() => onReact(e)}
                                        className={cn('flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-line', myReaction === e && 'bg-line')}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="overflow-hidden rounded-xl bg-surface-2 [&>*+*]:border-t [&>*+*]:border-line">
                            {live && <SheetItem icon={<CornerUpLeft className="h-5 w-5" />} label="Reply" onClick={onReply} />}
                            {live && m.content && <SheetItem icon={<Copy className="h-5 w-5" />} label="Copy" onClick={onCopy} />}
                            {canEdit && <SheetItem icon={<Pencil className="h-5 w-5" />} label="Edit" onClick={onEdit} />}
                            <SheetItem icon={<Trash2 className="h-5 w-5" />} label="Delete" danger onClick={() => setConfirmDelete(true)} />
                        </div>

                        {/* Message info: like WhatsApp's "Info" */}
                        {mine && live && (
                            <div className="mt-3 space-y-1 px-2 text-[13px] text-muted">
                                <p className="flex justify-between"><span>Sent</span><span>{at(m.createdAt)}</span></p>
                                <p className="flex justify-between"><span>Delivered</span><span>{m.deliveredAt ? at(m.deliveredAt) : '—'}</span></p>
                                <p className="flex justify-between"><span>Read</span><span>{m.readAt ? at(m.readAt) : '—'}</span></p>
                                {m.editedAt && <p className="flex justify-between"><span>Edited</span><span>{at(m.editedAt)}</span></p>}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

function SheetItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={cn('flex w-full items-center gap-3 px-4 py-3 text-left text-[16px] active:bg-line', danger ? 'text-[#ff453a]' : 'text-white')}
        >
            {icon}
            {label}
        </button>
    )
}
