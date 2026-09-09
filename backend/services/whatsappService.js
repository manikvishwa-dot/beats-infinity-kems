const axios = require("axios");

// ==========================================================
// BEATS INFINITY - WHATSAPP OTP DELIVERY (Meta Cloud API)
// ==========================================================
//
// Free-tier OTP delivery over WhatsApp instead of a paid SMS
// gateway. Requires a Meta Developer app with the WhatsApp
// product added, plus an approved message template with a
// single body placeholder for the code (e.g. "Your Beats
// Infinity verification code is {{1}}. It expires in 5 minutes.").
//
// Required environment variables:
//   WHATSAPP_PHONE_NUMBER_ID   - from the Meta app's WhatsApp setup page
//   WHATSAPP_ACCESS_TOKEN      - a permanent System User access token
//   WHATSAPP_TEMPLATE_NAME     - the approved template's name
//   WHATSAPP_TEMPLATE_LANG     - template language code (default "en_US")
//   WHATSAPP_COUNTRY_CODE      - dialing code with no "+" (default "91")
//   WHATSAPP_API_VERSION       - Graph API version (default "v21.0")
//
// If these aren't set, isWhatsappConfigured() returns false and
// the caller falls back to the existing "Development OTP" path -
// nothing breaks while WhatsApp is still being set up.
// ==========================================================

const isWhatsappConfigured = () => {

    return Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_TEMPLATE_NAME
    );

};


// mobile is expected as a normalized 10-digit Indian number
// (no country code) - the same shape singerController already
// validates everywhere else.
const sendOtpViaWhatsapp = async (mobile, otp) => {

    const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";
    const countryCode = process.env.WHATSAPP_COUNTRY_CODE || "91";
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

    const url = `https://graph.facebook.com/${apiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: `${countryCode}${mobile}`,
        type: "template",
        template: {
            name: process.env.WHATSAPP_TEMPLATE_NAME,
            language: { code: templateLang },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: otp }
                    ]
                }
            ]
        }
    };

    const response = await axios.post(url, payload, {
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        },
        timeout: 10000
    });

    return response.data;

};


module.exports = {
    isWhatsappConfigured,
    sendOtpViaWhatsapp
};
