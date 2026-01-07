import { RtcTokenBuilder, RtcRole } from "agora-access-token";

export const handler = async (event) => {
  try {
    const { channelName, role } = JSON.parse(event.body);

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Agora credentials missing" }),
      };
    }

    const uid = 0; // OBRIGATÓRIO
    const expireTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    const rtcRole =
      role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      rtcRole,
      privilegeExpireTime
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
