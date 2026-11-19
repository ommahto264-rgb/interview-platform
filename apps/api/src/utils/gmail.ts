function readConfig() {
  const {
    GMAIL_CLIENT_ID: clientId,
    GMAIL_CLIENT_SECRET: clientSecret,
    GMAIL_REFRESH_TOKEN: refreshToken,
    GMAIL_SENDER_EMAIL: sender,
  } = process.env

  if (!clientId || !clientSecret || !refreshToken || !sender) {
    return null
  }

  return { clientId, clientSecret, refreshToken, sender }
}

export function gmailConfigured() {
  return readConfig() !== null
}

function mailbox(value: string) {
  // Allow one plain email address in each header.
  if (
    /[\r\n]/.test(value) ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(value)
  ) {
    throw new Error('Invalid email address')
  }

  return value
}

export async function sendVerificationEmail(email: string, code: string) {
  const config = readConfig()
  if (!config) throw new Error('Gmail is not configured')

  const formattedCode = code.match(/.{1,4}/g)?.join('-') ?? code
  const message = [
    `From: ${mailbox(config.sender)}`,
    `To: ${mailbox(email)}`,
    'Subject: Verify your Interview Platform email',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    `Your verification code is ${formattedCode}.`,
    'It expires in 15 minutes. Enter it in the account that requested it.',
  ].join('\r\n')

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!tokenResponse.ok) {
    console.warn('Gmail authorization failed:', tokenResponse.status)
    throw new Error('Gmail authorization failed')
  }

  const { access_token } = await tokenResponse.json()
  if (typeof access_token !== 'string' || !access_token) {
    throw new Error('Google did not return an access token')
  }

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: Buffer.from(message).toString('base64url'),
      }),
      signal: AbortSignal.timeout(10000),
    },
  )

  if (!response.ok) {
    console.warn('Gmail send failed:', response.status)
    throw new Error('Gmail could not send the verification email')
  }
}