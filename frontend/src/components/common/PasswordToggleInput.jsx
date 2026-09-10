import { useState } from "react";

import { FaEye, FaEyeSlash } from "react-icons/fa";

import "./PasswordToggleInput.css";

// Drop-in wrapper for a masked input (PIN, OTP, admin password) that
// adds a show/hide eye-icon toggle. `hiddenType` is the type used
// while masked (default "password"); `visibleType` is the type used
// once toggled to show (default "text"). All other props (value,
// onChange, maxLength, inputMode, placeholder, className, ...) pass
// straight through to the underlying <input>.
function PasswordToggleInput({
    hiddenType = "password",
    visibleType = "text",
    className = "",
    ...inputProps
}) {

    const [visible, setVisible] = useState(false);

    return (

        <div className="password-toggle-wrap">

            <input

                {...inputProps}

                type={visible ? visibleType : hiddenType}

                className={
                    className
                        ? `${className} password-toggle-input`
                        : "password-toggle-input"
                }

            />

            <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setVisible(current => !current)}
                tabIndex={-1}
                aria-label={visible ? "Hide" : "Show"}
            >

                {visible ? <FaEyeSlash /> : <FaEye />}

            </button>

        </div>

    );

}

export default PasswordToggleInput;
