export type DuoUser = 'user-1' | 'user-2'

export const PARTNER_A_NAME = "Jibin"
export const PARTNER_B_NAME = "Achsah"

export const getUserName = (id: DuoUser | string) => {
    return id === 'user-1' ? PARTNER_A_NAME : PARTNER_B_NAME
}
