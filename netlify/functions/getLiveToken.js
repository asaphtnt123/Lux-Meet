const { AccessToken } = require('livekit-server-sdk')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  })
}

exports.handler = async (event) => {
  try {
    const { liveId, role } = JSON.parse(event.body || '{}')

    const authHeader = event.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return { statusCode: 401, body: 'Token ausente' }
    }

    const decoded = await admin.auth().verifyIdToken(token)
    const uid = decoded.uid

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: uid
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
    console.error(err)
    return {
      statusCode: 500,
      body: 'Erro ao gerar token'
    }
  }
}
