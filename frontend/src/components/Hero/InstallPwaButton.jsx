import { useEffect, useState } from "react";

import { Button } from "@mui/material";
import GetAppRoundedIcon from "@mui/icons-material/GetAppRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";

import "./InstallPwaButton.css";

// iPadOS (13+) reports itself as a Mac desktop Safari in the user
// agent string - the only reliable way to still detect a real
// iPad is "Mac platform, but with touch support" (a real Mac has
// maxTouchPoints === 0).
const isIos = () => {

    const ua = window.navigator.userAgent;

    if (/iphone|ipad|ipod/i.test(ua)) {

        return true;

    }

    return (
        window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1
    );

};

const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

// Shows an "Install App" pill at the top of the hero, always
// visible for easy access, so both Android/desktop (real install
// prompt when the browser has one ready) and iOS (Safari never
// offers a programmatic prompt) visitors can add Beats Infinity
// to their home screen. Hides itself once already installed.
//
// The help text is a plain CSS-positioned box, not a portal-based
// popover - deliberately, so there is no anchor/measurement logic
// that could silently fail to render on any given mobile browser.
function InstallPwaButton() {

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [installed, setInstalled] = useState(isStandalone());
    const [showHelp, setShowHelp] = useState(false);
    const [helpMessage, setHelpMessage] = useState("");

    useEffect(() => {

        const handleBeforeInstallPrompt = event => {

            event.preventDefault();
            setDeferredPrompt(event);

        };

        const handleAppInstalled = () => {

            setInstalled(true);
            setDeferredPrompt(null);

        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {

            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);

        };

    }, []);

    if (installed) {

        return null;

    }

    const handleClick = async () => {

        if (deferredPrompt) {

            deferredPrompt.prompt();

            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === "accepted") {

                setDeferredPrompt(null);

            }

            return;

        }

        setHelpMessage(
            isIos() ? "share" : "menu"
        );

        setShowHelp(current => !current);

    };

    return (

        <div className="hero-install-wrap">

            <Button
                onClick={handleClick}
                startIcon={<GetAppRoundedIcon />}
                className="hero-install-btn"
                size="small"
            >
                Install App
            </Button>

            {showHelp && (

                <div className="hero-install-help">

                    {helpMessage === "share" ? (

                        <span>
                            Tap <IosShareRoundedIcon fontSize="inherit" className="ios-share-icon" /> <strong>Share</strong> below, then choose <strong>"Add to Home Screen"</strong>.
                        </span>

                    ) : (

                        <span>
                            Look for an <strong>install</strong> icon in your browser's address bar, or open your browser's menu and choose <strong>"Install app"</strong> / <strong>"Add to Home screen"</strong>.
                        </span>

                    )}

                    <button
                        type="button"
                        className="hero-install-help-close"
                        onClick={() => setShowHelp(false)}
                        aria-label="Close"
                    >
                        ✕
                    </button>

                </div>

            )}

        </div>

    );

}

export default InstallPwaButton;
