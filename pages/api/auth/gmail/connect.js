export default function handler(req, res) {
  const token = req.query.token
  if (!token) return res.status(400).end()

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: token,
  })

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
