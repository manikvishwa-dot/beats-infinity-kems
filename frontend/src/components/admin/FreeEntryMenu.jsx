import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./FreeEntryMenu.css";

// ==========================================================
// "₹0 Payment" button + menu (Guest Singer / Management Team)
//
// The menu is rendered into <body> (a portal) at position: fixed,
// placed from the button's screen position, so no table scroller,
// overflow: hidden list or backdrop-filter "glass" box (which traps
// fixed children) can clip it. It opens upward when there
// isn't room below, and closes on outside click, Esc or scroll.
// ==========================================================

const WAIVERS = [
    { value: "Guest Singer", icon: "🎤" },
    { value: "Management Team", icon: "⭐" }
];

const MENU_HEIGHT = 120;
const MENU_WIDTH = 200;

// Where the menu goes for a button, or null when the button is off
// screen. Right-aligned with the button, kept on screen, and opened
// upward when there isn't room below.
const placeMenu = button => {

    if (!button) {
        return null;
    }

    const rect = button.getBoundingClientRect();

    const offScreen =
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth;

    if (offScreen) {
        return null;
    }

    const left = Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
    );

    return window.innerHeight - rect.bottom > MENU_HEIGHT + 12
        ? { top: rect.bottom + 6, left }
        : { bottom: window.innerHeight - rect.top + 6, left };

};

function FreeEntryMenu({ disabled, onSelect, className = "", label = "₹0 Payment" }) {

    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const [position, setPosition] = useState(null);

    const open = Boolean(position);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const close = () => setPosition(null);

        // Follow the button when the page or a table scrolls (phones
        // also fire scroll/resize as the address bar hides) - only
        // close once the button has left the screen.
        let frame = 0;

        const follow = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() =>
                setPosition(placeMenu(buttonRef.current))
            );
        };

        const onPointer = event => {
            if (
                buttonRef.current?.contains(event.target) ||
                menuRef.current?.contains(event.target)
            ) {
                return;
            }
            close();
        };

        const onKey = event => {
            if (event.key === "Escape") close();
        };

        document.addEventListener("mousedown", onPointer);
        document.addEventListener("touchstart", onPointer);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", follow, true);
        window.addEventListener("resize", follow);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("touchstart", onPointer);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", follow, true);
            window.removeEventListener("resize", follow);
        };
    }, [open]);

    const toggle = () => {
        if (open) {
            setPosition(null);
            return;
        }

        // Bring a half-hidden button (wide table on a phone) into
        // view first, then place the menu next to it.
        buttonRef.current.scrollIntoView({ block: "nearest", inline: "nearest" });
        setPosition(placeMenu(buttonRef.current));
    };

    const choose = value => {
        setPosition(null);
        onSelect(value);
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`${className}${open ? " open" : ""}`}
                disabled={disabled}
                onClick={toggle}
                title="Free entry (₹0) - guest or management team"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                {label}
            </button>

            {open && createPortal(
                <div
                    ref={menuRef}
                    className="free-entry-menu"
                    role="menu"
                    style={{ ...position, width: MENU_WIDTH }}
                >
                    <span>Free entry · ₹0</span>
                    {WAIVERS.map(option => (
                        <button
                            type="button"
                            role="menuitem"
                            key={option.value}
                            onClick={() => choose(option.value)}
                        >
                            {option.icon} {option.value}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );

}

export default FreeEntryMenu;
