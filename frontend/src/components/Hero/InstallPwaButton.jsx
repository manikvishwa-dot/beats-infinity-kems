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

// Shows an "Install App" pill at the top of the hero, always
// visible for easy access, so both Android/desktop (real install
// prompt when the browser has one ready) and iOS (Safari never
// offers a programmatic prompt) visitors can add Beats Infinity
// to their home screen. Hides itself once already installed.
function InstallPwaButton() {

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [installed, setInstalled] = useState(isStandalone());
    const [anchorEl, setAnchorEl] = useState(null);
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

    const ios = isIos();

    const handleClick = async event => {

        if (deferredPrompt) {

            deferredPrompt.prompt();

            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === "accepted") {

                setDeferredPrompt(null);

            }

            return;

        }

        if (ios) {

            setHelpMessage(
                "share"
            );

        }
        else {

            setHelpMessage(
                "menu"
            );

        }

        setAnchorEl(event.currentTarget);

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

                    {helpMessage === "share" ? (

                        <Typography variant="body2">
                            Tap <IosShareRoundedIcon fontSize="inherit" className="ios-share-icon" /> <strong>Share</strong> below, then choose <strong>"Add to Home Screen"</strong>.
                        </Typography>

                    ) : (

                        <Typography variant="body2">
                            Look for an <strong>install</strong> icon in your browser's address bar, or open your browser's menu and choose <strong>"Install app"</strong> / <strong>"Add to Home screen"</strong>.
                        </Typography>

                    )}

                </Box>
            </Popover>
        </>

    );

}

export default InstallPwaButton;
