This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Google sign-in

Each person signs in with their Google account. Their Gmail is linked to their
Duo profile (`users.email`) and every message, prayer log, photo and setting
they save is tied to that profile. The server reads who is signed in from a
signed session cookie, never from IDs sent by the browser.

Environment variables:

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client (Google Cloud Console → APIs & Services → Credentials → *Web application*) |
| `AUTH_SECRET` | Long random string used to sign sessions (`openssl rand -base64 32`) |
| `DUO_USER_1_EMAIL` | Jibin's Gmail (comma-separate to allow more than one) |
| `DUO_USER_2_EMAIL` | Achsah's Gmail |
| `AUTH_URL` | Optional. Public URL (e.g. `https://duo.example.com`) if it differs from the request host |

In the OAuth client, add `https://<your-domain>/api/auth/callback/google` (and
`http://localhost:3000/api/auth/callback/google` for local dev) as an
authorized redirect URI. Any Google account not listed above is refused.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
