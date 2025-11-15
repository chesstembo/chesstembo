// src/lib/firebaseAnalytics.ts
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getApps, getApp } from "firebase/app";

export async function initAnalytics() {
  const apps = getApps();
  if (!apps.length) return; // Firebase not initialized yet

  const app = getApp();
  const supported = await isSupported();
  if (supported) getAnalytics(app);
}

export const logAnalyticsEvent = async (
  eventName: string,
  eventParams?: Record<string, unknown>
) => {
  if (window.location.hostname === "localhost") return;

  const supported = await isSupported();
  if (!supported) return;

  const app = getApp();
  const analytics = getAnalytics(app);
  logEvent(analytics, eventName, eventParams);
};
