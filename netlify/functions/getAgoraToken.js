const { RtcTokenBuilder, RtcRole } = require("agora-access-token")
const admin = require("firebase-admin")

// 🔥 Inicializa Firebase Admin apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  })
}

exports.handler = async (event) => {
  try {
    // ===============================
    // AUTH HEADER
    // ===============================
    const authHeader = event.headers.authorization || ""
    const tokenMatch = authHeader.match(/^Bearer (.+)$/)

    if (!tokenMatch) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token ausente" })
      }
    }

    const idToken = tokenMatch[1]

    // ===============================
    // VERIFY FIREBASE TOKEN
    // ===============================
    const decoded = await admin.auth().verifyIdToken(idToken)
    const uid = decoded.uid

    // ===============================
    // BODY
    // ===============================
    const body = JSON.parse(event.body || "{}")
    const channel = body.channel
    const role = body.role

    if (!channel || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Dados inválidos" })
      }
    }

    // ===============================
    // AGORA CONFIG
    // ===============================
    const appId = process.env.AGORA_APP_ID
    const appCertificate = process.env.AGORA_APP_CERTIFICATE

    const agoraRole =
      role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER

    const expirationTimeInSeconds = 60 * 60 // 1h
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpireTime =
      currentTimestamp + expirationTimeInSeconds

    // ===============================
    // TOKEN GENERATION
    // ===============================
    const agoraToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      uid.substring(0, 10), // Agora UID numérico/string curto
      agoraRole,
      privilegeExpireTime
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        token: agoraToken,
        uid
      })
    }
  } catch (error) {
    console.error("Erro token Agora:", error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Erro ao gerar token Agora"
      })
    }
  }
}
