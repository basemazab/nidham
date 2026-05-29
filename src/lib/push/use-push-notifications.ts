"use client";

import { useEffect, useState, useCallback } from "react";
import { savePushSubscription, removePushSubscription } from "@/lib/notifications";
import { urlBase64ToUint8Array } from "@/lib/push/config";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    navigator.serviceWorker.ready.then((reg) => {
      setSwRegistration(reg);
      reg.pushManager.getSubscription().then((sub) => {
        setSubscription(sub);
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!swRegistration) return;
    setError(null);

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Push notifications not configured");
      return;
    }

    try {
      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      setSubscription(sub);
      setIsSubscribed(true);

      await savePushSubscription(JSON.stringify(sub.toJSON()));
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Permission denied")
          ? "تم رفض الإذن"
          : "فشل في الاشتراك بالإشعارات",
      );
    }
  }, [swRegistration]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);
      await removePushSubscription();
    } catch (err) {
      setError("فشل في إلغاء الاشتراك");
    }
  }, [subscription]);

  return {
    isSupported,
    isSubscribed,
    subscription,
    error,
    subscribe,
    unsubscribe,
  };
}
