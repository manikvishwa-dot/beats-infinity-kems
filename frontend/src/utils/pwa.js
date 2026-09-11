// Whether the app is currently running as an installed PWA
// (added to home screen) rather than a normal browser tab.
const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

const hasSingerSession = () => {

    try {
        return Boolean(localStorage.getItem("beatsInfinitySinger"));
    }
    catch {
        return false;
    }

};

export { isStandalone, hasSingerSession };
