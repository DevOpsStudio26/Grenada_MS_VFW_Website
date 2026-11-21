import { useCallback, useEffect, useState } from "react";

// Signs admins out after a period with no mouse, keyboard, scroll, or touch
// activity, with a warning first. The last-activity time is shared across tabs
// (and survives closing the browser), so coming back hours later signs you out
// and an idle tab never signs out a tab that's in use.
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const WARNING_MS = 2 * 60 * 1000;
const STORAGE_KEY = "vfw-admin-last-activity";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];

function readLastActivity() {
    try {
        return Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
        return 0;
    }
}

// Fallback when localStorage is blocked. Starts at 0 so reopening an old
// session is treated as idle, not as fresh activity.
let memoryLastActivity = 0;

// Call when someone signs in, so an old timestamp doesn't sign them right back out.
export function markAdminActivity() {
    memoryLastActivity = Date.now();
    try {
        localStorage.setItem(STORAGE_KEY, String(memoryLastActivity));
    } catch {
        // Storage blocked (e.g. private mode); the in-memory time still works.
    }
}

const lastActivity = () => Math.max(readLastActivity(), memoryLastActivity);

// Returns the milliseconds left before sign-out while the warning should show
// (otherwise null), and a function to stay signed in.
export function useIdleSignOut(onSignOut) {
    const [remaining, setRemaining] = useState(null);

    useEffect(() => {
        let lastWrite = 0;
        function onActivity() {
            // Writing on every mouse move is wasteful; once every few seconds is plenty.
            if (Date.now() - lastWrite < 5000) return;
            lastWrite = Date.now();
            markAdminActivity();
        }
        // Coming back to a session that's already past the limit signs out right away.
        if (Date.now() - lastActivity() >= IDLE_LIMIT_MS) {
            onSignOut();
            return undefined;
        }

        ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
        const timer = setInterval(() => {
            const left = IDLE_LIMIT_MS - (Date.now() - lastActivity());
            if (left <= 0) {
                onSignOut();
            } else {
                setRemaining(left <= WARNING_MS ? left : null);
            }
        }, 1000);

        return () => {
            ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
            clearInterval(timer);
        };
    }, [onSignOut]);

    const staySignedIn = useCallback(() => {
        markAdminActivity();
        setRemaining(null);
    }, []);

    return { remaining, staySignedIn };
}
