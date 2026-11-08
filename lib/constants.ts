export type DuoUser = 'user-1' | 'user-2'

export const PARTNER_A_NAME = "Jibin"
export const PARTNER_B_NAME = "Achsah"

// Gmail each person signs in with (Google login). DUO_USER_1_EMAIL /
// DUO_USER_2_EMAIL env vars override these when set.
export const PARTNER_A_EMAIL = "jibinjosejo29@gmail.com"
export const PARTNER_B_EMAIL = ""

export const getUserName = (id: DuoUser | string) => {
    return id === 'user-1' ? PARTNER_A_NAME : PARTNER_B_NAME
}
