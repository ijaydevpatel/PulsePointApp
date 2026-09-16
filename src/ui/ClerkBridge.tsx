/**
 * Browser warm-up for the OAuth round trip.
 *
 * Android can keep a Custom Tab warm so tapping "Continue with Google" opens
 * instantly instead of cold-starting a browser process. Without it there is a
 * visible stall between the tap and anything appearing, which reads as the
 * button not having worked — and people tap again.
 *
 * Session shaping lives in App.tsx, where Clerk's hooks already are.
 */
import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';

export function useWarmUpBrowser(): void {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}
