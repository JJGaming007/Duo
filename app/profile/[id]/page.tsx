import { notFound } from 'next/navigation'
import ProfileView from './ProfileView'

export function generateStaticParams() {
    return [{ id: 'user-1' }, { id: 'user-2' }]
}

export const dynamicParams = false

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (id !== 'user-1' && id !== 'user-2') notFound()
    return <ProfileView id={id} />
}
