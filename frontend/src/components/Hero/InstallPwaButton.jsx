import { useEffect, useState } from "react";

import { Button, Popover, Box, Typography } from "@mui/material";
import GetAppRoundedIcon from "@mui/icons-material/GetAppRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";

import "./InstallPwaButton.css";

const isIos = () =>
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

// Shows an "Install App" pill at the top of the hero so both
// Android/desktop (real install prompt) and iOS (Safari has no
// programmatic prompt - only "Add to Home Screen" instructions)
// visitors can add Beats Infinity to their home screen. Hides
// itself once already installed/running standalone.
function InstallPwaButton() {

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [installed, setInstalled] = useState(isStandalone());
    const [anchorEl, setAnchorEl] = useState(null);

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

    const ios = isIos();

    if (!deferredPrompt && !ios) {

        // Browser doesn't support install prompts (or already
        // dismissed this session) and isn't iOS Safari either -
        // nothing useful to show.
        return null;

    }

    const handleClick = async event => {

        if (ios) {

            setAnchorEl(event.currentTarget);
            return;

        }

        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {

            setDeferredPrompt(null);

        }

    };

    return (

        <>
            <Button
                onClick={handleClick}
                startIcon={<GetAppRoundedIcon />}
                className="hero-install-btn"
                size="small"
            >
                Install App
            </Button>

            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Box className="ios-install-help">

                    <Typography variant="body2">
                        Tap <IosShareRoundedIcon fontSize="inherit" className="ios-share-icon" /> <strong>Share</strong> below, then choose <strong>"Add to Home Screen"</strong>.
                    </Typography>

                </Box>
            </Popover>
        </>

    );

}

export default InstallPwaButton;
