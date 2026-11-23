// ==========================================================
// BEATS INFINITY - AUTO-UPDATE THE SITE AFTER A NEW DEPLOY
// ==========================================================
//
// Before: a new version downloaded in the background but the
// open page never refreshed - singers had to reload twice, and
// a home-screen app resumed from the background never checked.
//
// Now:
//   - checks for a new version on open, every 30 minutes, and
//     whenever the site comes back to the screen
//   - refreshes itself, but never in the middle of something:
//       * found within 10s of opening -> refresh now (nothing
//         typed yet)
//       * found later -> wait until the singer switches away
//         (other app / tab) and refresh then, so it's fresh
//         when they come back
// ==========================================================

import { registerSW } from "virtual:pwa-register";

const CHECK_EVERY_MS = 30 * 60 * 1000;
const SAFE_TO_RELOAD_MS = 10 * 1000;

const startPwaAutoUpdate = () => {

    let updatePending = false;

    const reload = () => window.location.reload();

    registerSW({

        immediate: true,

        // The new version is active - refresh at a safe moment
        onNeedReload() {

            if (
                document.visibilityState === "hidden" ||
                performance.now() < SAFE_TO_RELOAD_MS
            ) {
                reload();
                return;
            }

            // Someone is using the page - wait until they leave it
            updatePending = true;

        },

        onRegisteredSW(swUrl, registration) {

            if (!registration) return;

            const check = () => {
                // Skip while offline - the check would just fail
                if (navigator.onLine === false) return;
                registration.update().catch(() => {});
            };

            setInterval(check, CHECK_EVERY_MS);

            document.addEventListener("visibilitychange", () => {

                if (document.visibilityState === "hidden") {
                    if (updatePending) reload();
                    return;
                }

                // Back on screen (e.g. home-screen app resumed)
                check();

            });

        }

    });

};

export default startPwaAutoUpdate;
