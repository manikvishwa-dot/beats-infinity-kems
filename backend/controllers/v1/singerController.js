const { supabase } = require("../../config/supabase");
const bcrypt = require("bcryptjs");
const { isWhatsappConfigured, sendOtpViaWhatsapp } = require("../../services/whatsappService");

// ==========================================================
// BEATS INFINITY - SINGER CONTROLLER
// ==========================================================
//
// FLOW:
//
// FIRST-TIME REGISTRATION
//
// Mobile
//   ↓
// Send 6-digit OTP
//   ↓
// Verify OTP
//   ↓
// Singer creates 4-digit PIN
//   ↓
// Singer profile created
//
// EXISTING SINGER
//
// Mobile
//   ↓
// Login with 4-digit PIN
//
// FORGOT PIN
//
// Mobile
//   ↓
// Send different 6-digit OTP
//   ↓
// Verify OTP
//   ↓
// Create new 4-digit PIN
//
// ==========================================================


// ==========================================================
// HELPERS
// ==========================================================

// ----------------------------------------------------------
// NORMALIZE MOBILE NUMBER
// ----------------------------------------------------------

const normalizeMobile = (mobile) => {

    if (!mobile) {
        return "";
    }

    return String(mobile)
        .replace(/\D/g, "")
        .slice(-10);

};


// ----------------------------------------------------------
// VALIDATE MOBILE
// ----------------------------------------------------------

const isValidMobile = (mobile) => {

    return /^\d{10}$/.test(mobile);

};


// ----------------------------------------------------------
// VALIDATE 4 DIGIT PIN
// ----------------------------------------------------------

const isValidPin = (pin) => {

    return /^\d{4}$/.test(
        String(pin || "")
    );

};


// ----------------------------------------------------------
// GENERATE 6 DIGIT OTP
// ----------------------------------------------------------

const generateOTP = () => {

    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();

};


// ==========================================================
// GET SINGER BY MOBILE
//
// GET
// /api/v1/singers/check?mobile=9876543210
// ==========================================================

const getSingerByMobile = async (req, res) => {

    try {

        const mobile =
            normalizeMobile(
                req.query.mobile
            );


        console.log(
            "🔎 Checking singer mobile:",
            mobile
        );


        // --------------------------------------------------
        // VALIDATE MOBILE
        // --------------------------------------------------

        if (!isValidMobile(mobile)) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid 10-digit mobile number is required."

            });

        }


        // --------------------------------------------------
        // FIND SINGER
        // --------------------------------------------------

        const {
            data,
            error
        } = await supabase

            .from("singers")

            .select(
                "id,mobile_number,date_of_birth,singer_name,gender,created_at,updated_at"
            )

            .eq(
                "mobile_number",
                mobile
            )

            .maybeSingle();


        if (error) {

            console.error(
                "❌ Singer Lookup Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to check singer.",

                error:
                    error.message

            });

        }


        // --------------------------------------------------
        // RETURN RESULT
        // --------------------------------------------------

        return res.status(200).json({

            success: true,

            exists:
                !!data,

            singer:
                data || null

        });

    }

    catch (error) {

        console.error(
            "❌ Get Singer By Mobile Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// SEND OTP
//
// POST
// /api/v1/singers/send-otp
//
// BODY:
//
// {
//     "mobile": "9876543210",
//     "purpose": "registration"
// }
//
// OR
//
// {
//     "mobile": "9876543210",
//     "purpose": "reset_pin"
// }
//
// ==========================================================

const sendOTP = async (req, res) => {

    try {

        const mobile =
            normalizeMobile(
                req.body.mobile
            );


        const purpose =
            String(
                req.body.purpose ||
                "registration"
            ).trim();


        console.log(
            "📱 OTP requested:",
            {
                mobile,
                purpose
            }
        );


        // --------------------------------------------------
        // VALIDATE MOBILE
        // --------------------------------------------------

        if (!isValidMobile(mobile)) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid 10-digit mobile number is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE PURPOSE
        // --------------------------------------------------

        if (
            ![
                "registration",
                "reset_pin"
            ].includes(purpose)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid OTP purpose."

            });

        }


        // ==================================================
        // REGISTRATION OTP
        // ==================================================

        if (
            purpose === "registration"
        ) {

            const {
                data: existingSinger,
                error: existingError
            } = await supabase

                .from("singers")

                .select(
                    "id,mobile_number"
                )

                .eq(
                    "mobile_number",
                    mobile
                )

                .maybeSingle();


            if (existingError) {

                console.error(
                    "❌ Registration Singer Lookup Error:",
                    existingError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to check singer.",

                    error:
                        existingError.message

                });

            }


            if (existingSinger) {

                return res.status(409).json({

                    success: false,

                    exists: true,

                    message:
                        "Singer already registered. Please login with your PIN."

                });

            }

        }


        // ==================================================
        // RESET PIN OTP
        // ==================================================

        if (
            purpose === "reset_pin"
        ) {

            const {
                data: existingSinger,
                error: existingError
            } = await supabase

                .from("singers")

                .select(
                    "id,mobile_number,singer_name"
                )

                .eq(
                    "mobile_number",
                    mobile
                )

                .maybeSingle();


            if (existingError) {

                console.error(
                    "❌ Reset PIN Singer Lookup Error:",
                    existingError
                );


                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to verify singer.",

                    error:
                        existingError.message

                });

            }


            if (!existingSinger) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Singer is not registered."

                });

            }

        }


        // ==================================================
        // GENERATE OTP
        // ==================================================

        const otp =
            generateOTP();


        // --------------------------------------------------
        // OTP EXPIRY - 5 MINUTES
        // --------------------------------------------------

        const expiresAt =
            new Date(
                Date.now() +
                (5 * 60 * 1000)
            ).toISOString();


        console.log(
            "🔐 DEVELOPMENT OTP:",
            otp
        );


        // ==================================================
        // OPTIONAL CLEANUP
        //
        // Mark previous unverified OTPs as expired by
        // deleting them for this mobile + purpose.
        // ==================================================

        const {
            error: deleteError
        } = await supabase

            .from("singer_otps")

            .delete()

            .eq(
                "mobile_number",
                mobile
            )

            .eq(
                "purpose",
                purpose
            )

            .is(
                "verified_at",
                null
            );


        if (deleteError) {

            console.warn(
                "⚠️ Previous OTP cleanup warning:",
                deleteError.message
            );

        }


        // ==================================================
        // INSERT OTP DIRECTLY INTO DATABASE
        //
        // IMPORTANT:
        // Your table uses "otp", NOT "otp_code".
        // ==================================================

        const {
            data: otpRecord,
            error: otpError
        } = await supabase

            .from("singer_otps")

            .insert({

                mobile_number:
                    mobile,

                otp:
                    otp,

                purpose:
                    purpose,

                expires_at:
                    expiresAt

            })

            .select(
                "id,mobile_number,otp,purpose,expires_at,verified_at,created_at"
            )

            .single();


        if (otpError) {

            console.error(
                "❌ OTP Database Insert Error:",
                otpError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to generate OTP.",

                error:
                    otpError.message

            });

        }


        console.log(
            "✅ OTP created:",
            otpRecord.id
        );


        // ==================================================
        // DELIVER OTP OVER WHATSAPP (Meta Cloud API)
        //
        // Falls back to the "Development OTP" response below
        // whenever WhatsApp isn't configured yet, or a send
        // attempt fails - registration/reset-pin never gets
        // blocked by a delivery problem while this is being
        // set up.
        // ==================================================

        let deliveredViaWhatsapp = false;

        if (isWhatsappConfigured()) {

            try {

                await sendOtpViaWhatsapp(mobile, otp);

                deliveredViaWhatsapp = true;

                console.log(
                    "✅ OTP sent via WhatsApp to:",
                    mobile
                );

            }
            catch (whatsappError) {

                console.error(
                    "❌ WhatsApp OTP send failed, falling back to Development OTP:",
                    whatsappError.response?.data || whatsappError.message
                );

            }

        }


        return res.status(200).json({

            success: true,

            message:
                deliveredViaWhatsapp
                    ? "OTP sent via WhatsApp."
                    : "OTP generated successfully.",

            mobile,

            purpose,

            expiresAt,

            // Only present when WhatsApp delivery isn't configured
            // or a send attempt failed - never sent alongside a
            // real, successfully-delivered OTP.
            ...(deliveredViaWhatsapp ? {} : { otp })

        });

    }

    catch (error) {

        console.error(
            "❌ Send OTP Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to generate OTP.",

            error:
                error.message

        });

    }

};


// ==========================================================
// VERIFY OTP
//
// POST
// /api/v1/singers/verify-otp
//
// BODY:
//
// {
//     "mobile": "9876543210",
//     "otp": "123456",
//     "purpose": "registration"
// }
//
// ==========================================================

const verifyOTP = async (req, res) => {

    try {

        const mobile =
            normalizeMobile(
                req.body.mobile
            );


        const otp =
            String(
                req.body.otp || ""
            ).trim();


        const purpose =
            String(
                req.body.purpose ||
                "registration"
            ).trim();


        console.log(
            "🔍 Verifying OTP:",
            {
                mobile,
                purpose
            }
        );


        // --------------------------------------------------
        // VALIDATE MOBILE
        // --------------------------------------------------

        if (!isValidMobile(mobile)) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid 10-digit mobile number is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE OTP
        // --------------------------------------------------

        if (
            !/^\d{6}$/.test(otp)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "A valid 6-digit OTP is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE PURPOSE
        // --------------------------------------------------

        if (
            ![
                "registration",
                "reset_pin"
            ].includes(purpose)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid OTP purpose."

            });

        }


        // ==================================================
        // GET LATEST UNVERIFIED OTP
        // ==================================================

        const {
            data: otpRecord,
            error: otpError
        } = await supabase

            .from("singer_otps")

            .select(
                "id,mobile_number,otp,purpose,expires_at,verified_at,created_at"
            )

            .eq(
                "mobile_number",
                mobile
            )

            .eq(
                "purpose",
                purpose
            )

            .is(
                "verified_at",
                null
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            )

            .limit(1)

            .maybeSingle();


        if (otpError) {

            console.error(
                "❌ OTP Lookup Error:",
                otpError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify OTP.",

                error:
                    otpError.message

            });

        }


        // --------------------------------------------------
        // OTP NOT FOUND
        // --------------------------------------------------

        if (!otpRecord) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP not found. Please request a new OTP."

            });

        }


        // ==================================================
        // CHECK EXPIRY
        // ==================================================

        const expiryTime =
            new Date(
                otpRecord.expires_at
            ).getTime();


        if (
            Date.now() >
            expiryTime
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP has expired. Please request a new OTP."

            });

        }


        // ==================================================
        // CHECK OTP
        // ==================================================

        if (
            String(otpRecord.otp) !==
            String(otp)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid OTP."

            });

        }


        // ==================================================
        // MARK OTP VERIFIED
        // ==================================================

        const {
            data: verifiedRecord,
            error: updateError
        } = await supabase

            .from("singer_otps")

            .update({

                verified_at:
                    new Date().toISOString()

            })

            .eq(
                "id",
                otpRecord.id
            )

            .select(
                "id,mobile_number,purpose,expires_at,verified_at"
            )

            .single();


        if (updateError) {

            console.error(
                "❌ OTP Verification Update Error:",
                updateError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to complete OTP verification.",

                error:
                    updateError.message

            });

        }


        console.log(
            "✅ OTP verified:",
            mobile
        );


        return res.status(200).json({

            success: true,

            verified: true,

            message:
                "OTP verified successfully.",

            mobile,

            purpose,

            verifiedAt:
                verifiedRecord.verified_at

        });

    }

    catch (error) {

        console.error(
            "❌ Verify OTP Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to verify OTP.",

            error:
                error.message

        });

    }

};


// ==========================================================
// CREATE FIRST-TIME SINGER
//
// POST
// /api/v1/singers
//
// BODY:
//
// {
//     "mobile": "9876543210",
//     "singer_name": "Test Singer",
//     "gender": "Male",
//     "date_of_birth": "1990-01-15",
//     "pin": "1234"
// }
//
// OTP MUST BE VERIFIED FIRST.
// ==========================================================

const createSinger = async (req, res) => {

    try {

        const {
            mobile,
            singer_name,
            gender,
            date_of_birth,
            pin
        } = req.body;


        const mobileNumber =
            normalizeMobile(mobile);


        console.log(
            "📝 New Singer Registration:",
            mobileNumber
        );


        // --------------------------------------------------
        // VALIDATE MOBILE
        // --------------------------------------------------

        if (
            !isValidMobile(
                mobileNumber
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid 10-digit mobile number is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE NAME
        // --------------------------------------------------

        if (
            !singer_name ||
            !String(
                singer_name
            ).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Singer name is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE GENDER
        // --------------------------------------------------

        if (
            !gender ||
            !String(
                gender
            ).trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Gender is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE DOB
        // --------------------------------------------------

        if (!date_of_birth) {

            return res.status(400).json({

                success: false,

                message:
                    "Date of birth is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE PIN
        // --------------------------------------------------

        if (
            !isValidPin(pin)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "PIN must contain exactly 4 digits."

            });

        }


        // ==================================================
        // CHECK VERIFIED REGISTRATION OTP
        // ==================================================

        const {
            data: verifiedOTP,
            error: otpError
        } = await supabase

            .from("singer_otps")

            .select(
                "id,mobile_number,purpose,expires_at,verified_at"
            )

            .eq(
                "mobile_number",
                mobileNumber
            )

            .eq(
                "purpose",
                "registration"
            )

            .not(
                "verified_at",
                "is",
                null
            )

            .order(
                "verified_at",
                {
                    ascending: false
                }
            )

            .limit(1)

            .maybeSingle();


        if (otpError) {

            console.error(
                "❌ Registration OTP Check Error:",
                otpError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify registration OTP.",

                error:
                    otpError.message

            });

        }


        if (!verifiedOTP) {

            return res.status(403).json({

                success: false,

                message:
                    "Please verify the OTP before creating your singer profile."

            });

        }


        // --------------------------------------------------
        // CHECK OTP EXPIRY
        // --------------------------------------------------

        if (
            Date.now() >
            new Date(
                verifiedOTP.expires_at
            ).getTime()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "OTP verification has expired. Please request a new OTP."

            });

        }


        // ==================================================
        // CHECK EXISTING SINGER
        // ==================================================

        const {
            data: existingSinger,
            error: existingError
        } = await supabase

            .from("singers")

            .select(
                "id,mobile_number"
            )

            .eq(
                "mobile_number",
                mobileNumber
            )

            .maybeSingle();


        if (existingError) {

            console.error(
                "❌ Existing Singer Check Error:",
                existingError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify singer registration.",

                error:
                    existingError.message

            });

        }


        if (existingSinger) {

            return res.status(409).json({

                success: false,

                exists: true,

                message:
                    "Singer is already registered with this mobile number."

            });

        }


        // ==================================================
        // HASH PIN
        // ==================================================

        const pinHash =
            await bcrypt.hash(
                String(pin),
                10
            );


        // ==================================================
        // CREATE SINGER
        // ==================================================

        const singerData = {

            mobile_number:
                mobileNumber,

            singer_name:
                String(
                    singer_name
                ).trim(),

            gender:
                String(
                    gender
                ).trim(),

            date_of_birth:
                date_of_birth,

            pin_hash:
                pinHash

        };


        const {
            data,
            error
        } = await supabase

            .from("singers")

            .insert([
                singerData
            ])

            .select(
                "id,mobile_number,date_of_birth,singer_name,gender,created_at,updated_at"
            )

            .single();


        if (error) {

            console.error(
                "❌ Create Singer Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to create singer.",

                error:
                    error.message

            });

        }


        console.log(
            "✅ Singer registered:",
            data.id
        );


        return res.status(201).json({

            success: true,

            message:
                "Singer registered successfully.",

            singer:
                data

        });

    }

    catch (error) {

        console.error(
            "❌ Create Singer Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// LOGIN WITH PIN
//
// POST
// /api/v1/singers/login
//
// BODY:
//
// {
//     "mobile": "9876543210",
//     "pin": "1234"
// }
//
// ==========================================================

const loginWithPin = async (req, res) => {

    try {

        const {
            mobile,
            pin
        } = req.body;


        const mobileNumber =
            normalizeMobile(mobile);


        // --------------------------------------------------
        // VALIDATE MOBILE
        // --------------------------------------------------

        if (
            !isValidMobile(
                mobileNumber
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid 10-digit mobile number is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE PIN
        // --------------------------------------------------

        if (
            !isValidPin(pin)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "PIN must contain exactly 4 digits."

            });

        }


        console.log(
            "🔐 Singer PIN login:",
            mobileNumber
        );


        // ==================================================
        // FIND SINGER
        // ==================================================

        const {
            data,
            error
        } = await supabase

            .from("singers")

            .select("*")

            .eq(
                "mobile_number",
                mobileNumber
            )

            .maybeSingle();


        if (error) {

            console.error(
                "❌ Singer Login Lookup Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to login.",

                error:
                    error.message

            });

        }


        // --------------------------------------------------
        // NOT FOUND
        // --------------------------------------------------

        if (!data) {

            return res.status(404).json({

                success: false,

                message:
                    "Singer not registered. Please complete first-time registration.",

                requiresRegistration:
                    true

            });

        }


        // ==================================================
        // VERIFY PIN
        // ==================================================

        const pinMatches =
            await bcrypt.compare(
                String(pin),
                data.pin_hash
            );


        if (!pinMatches) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid PIN."

            });

        }


        // ==================================================
        // REMOVE SENSITIVE INFORMATION
        // ==================================================

        delete data.pin_hash;


        console.log(
            "✅ Singer login successful:",
            data.singer_name
        );


        return res.status(200).json({

            success: true,

            message:
                "Login successful.",

            singer:
                data

        });

    }

    catch (error) {

        console.error(
            "❌ Singer Login Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// RESET FORGOTTEN PIN
//
// POST
// /api/v1/singers/reset-pin
//
// BODY:
//
// {
//     "mobile": "9876543210",
//     "new_pin": "5678"
// }
//
// OTP MUST BE VERIFIED FIRST.
// ==========================================================

const resetPin = async (req, res) => {

    try {

        const {
            mobile,
            new_pin
        } = req.body;


        const mobileNumber =
            normalizeMobile(mobile);


        // --------------------------------------------------
        // VALIDATE MOBILE
        // --------------------------------------------------

        if (
            !isValidMobile(
                mobileNumber
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid 10-digit mobile number is required."

            });

        }


        // --------------------------------------------------
        // VALIDATE NEW PIN
        // --------------------------------------------------

        if (
            !isValidPin(new_pin)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "New PIN must contain exactly 4 digits."

            });

        }


        // ==================================================
        // FIND SINGER
        // ==================================================

        const {
            data: singer,
            error: singerError
        } = await supabase

            .from("singers")

            .select(
                "id,mobile_number,singer_name"
            )

            .eq(
                "mobile_number",
                mobileNumber
            )

            .maybeSingle();


        if (singerError) {

            console.error(
                "❌ Reset PIN Singer Lookup Error:",
                singerError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify singer.",

                error:
                    singerError.message

            });

        }


        if (!singer) {

            return res.status(404).json({

                success: false,

                message:
                    "Singer not found."

            });

        }


        // ==================================================
        // CHECK VERIFIED RESET OTP
        // ==================================================

        const {
            data: verifiedOTP,
            error: otpError
        } = await supabase

            .from("singer_otps")

            .select(
                "id,mobile_number,purpose,expires_at,verified_at"
            )

            .eq(
                "mobile_number",
                mobileNumber
            )

            .eq(
                "purpose",
                "reset_pin"
            )

            .not(
                "verified_at",
                "is",
                null
            )

            .order(
                "verified_at",
                {
                    ascending: false
                }
            )

            .limit(1)

            .maybeSingle();


        if (otpError) {

            console.error(
                "❌ Reset PIN OTP Lookup Error:",
                otpError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify reset OTP.",

                error:
                    otpError.message

            });

        }


        if (!verifiedOTP) {

            return res.status(403).json({

                success: false,

                message:
                    "Please verify the OTP before resetting your PIN."

            });

        }


        // --------------------------------------------------
        // CHECK OTP EXPIRY
        // --------------------------------------------------

        if (
            Date.now() >
            new Date(
                verifiedOTP.expires_at
            ).getTime()
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "OTP verification has expired. Please request a new OTP."

            });

        }


        // ==================================================
        // HASH NEW PIN
        // ==================================================

        const newPinHash =
            await bcrypt.hash(
                String(new_pin),
                10
            );


        // ==================================================
        // UPDATE PIN
        // ==================================================

        const {
            data: updatedSinger,
            error: updateError
        } = await supabase

            .from("singers")

            .update({

                pin_hash:
                    newPinHash,

                updated_at:
                    new Date().toISOString()

            })

            .eq(
                "id",
                singer.id
            )

            .select(
                "id,mobile_number,date_of_birth,singer_name,gender,created_at,updated_at"
            )

            .single();


        if (updateError) {

            console.error(
                "❌ Reset PIN Update Error:",
                updateError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to reset PIN.",

                error:
                    updateError.message

            });

        }


        // ==================================================
        // SUCCESS
        // ==================================================

        console.log(
            "✅ Singer PIN reset:",
            singer.singer_name
        );


        return res.status(200).json({

            success: true,

            message:
                "PIN reset successfully.",

            singer:
                updatedSinger

        });

    }

    catch (error) {

        console.error(
            "❌ Reset PIN Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// UPDATE SINGER PROFILE
//
// PUT
// /api/v1/singers/:id
//
// ==========================================================

const updateSingerProfile = async (req, res) => {

    try {

        const {
            id
        } = req.params;


        // --------------------------------------------------
        // VALIDATE ID
        // --------------------------------------------------

        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Singer ID is required."

            });

        }


        // --------------------------------------------------
        // ALLOWED FIELDS
        // --------------------------------------------------

        const allowedFields = [

            "singer_name",

            "gender",

            "date_of_birth"

        ];


        const updateData = {};


        allowedFields.forEach(
            (field) => {

                if (
                    req.body[field] !==
                    undefined
                ) {

                    updateData[field] =
                        req.body[field];

                }

            }
        );


        // --------------------------------------------------
        // CHECK UPDATE DATA
        // --------------------------------------------------

        if (
            Object.keys(
                updateData
            ).length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "No valid profile fields were provided."

            });

        }


        updateData.updated_at =
            new Date().toISOString();


        // ==================================================
        // UPDATE
        // ==================================================

        const {
            data,
            error
        } = await supabase

            .from("singers")

            .update(
                updateData
            )

            .eq(
                "id",
                id
            )

            .select(
                "id,mobile_number,date_of_birth,singer_name,gender,created_at,updated_at"
            )

            .single();


        if (error) {

            console.error(
                "❌ Update Singer Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to update singer profile.",

                error:
                    error.message

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Singer profile updated successfully.",

            singer:
                data

        });

    }

    catch (error) {

        console.error(
            "❌ Update Singer Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// EXPORT
// ==========================================================

module.exports = {

    getSingerByMobile,

    sendOTP,

    verifyOTP,

    createSinger,

    loginWithPin,

    resetPin,

    updateSingerProfile

};