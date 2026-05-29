// VAPID keys for Web Push notifications
// Generate your own: npx web-push generate-vapid-keys

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@nidhamhr.com";

export function getVapidKeys() {
  return {
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
    subject: vapidSubject,
  };
}

export function isPushEnabled(): boolean {
  return !!(vapidPublicKey && vapidPrivateKey);
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
