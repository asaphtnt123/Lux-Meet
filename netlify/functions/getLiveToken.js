const { AccessToken } = require('livekit-server-sdk')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  )

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    const { liveId, role } = body

    if (!liveId || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Dados inválidos' })
      }
    }

    const authHeader = event.headers.authorization || ''
    const idToken = authHeader.replace('Bearer ', '')

    if (!idToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Token ausente' })
      }
    }

    const decoded = await admin.auth().verifyIdToken(idToken)

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: decoded.uid
      }
    )

    at.addGrant({
      room: liveId,
      roomJoin: true,
      canPublish: role === 'host',
      canSubscribe: true
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        token: at.toJwt(),
        url: process.env.LIVEKIT_URL
      })
    }

  } catch (err) {
    console.error('❌ TOKEN ERROR:', err)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Erro ao gerar token'
      })
    }
  }
}
