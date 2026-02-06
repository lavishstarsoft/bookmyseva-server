const { config } = require('../config/env');
const logger = require('./logger');

const MSG91_BASE_URL = "https://control.msg91.com/api/v5";

/**
 * Clean phone number by removing non-digit characters and country code if present
 * @param {string} phoneNumber Phone number to clean
 * @returns {string} Cleaned phone number
 */
function cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    // Remove any non-digit characters
    phoneNumber = phoneNumber.replace(/\D/g, '');
    // Remove country code if present (assuming 91 for India)
    if (phoneNumber.startsWith('91') && phoneNumber.length > 10) {
        phoneNumber = phoneNumber.substring(2);
    }
    return phoneNumber;
}

/**
 * Format phone number for MSG91 by adding country code
 * @param {string} phoneNumber Phone number to format
 * @returns {string} Formatted phone number with country code
 */
function formatPhoneForMSG91(phoneNumber) {
    // Clean the number first
    phoneNumber = cleanPhoneNumber(phoneNumber);
    // Add country code for MSG91 (defaulting to 91 for now)
    return `91${phoneNumber}`;
}

/**
 * Send OTP via MSG91 using flow API
 * @param {Object} params
 * @param {string} params.mobile
 * @param {string} [params.otp]
 * @param {string} [params.template_id]
 * @returns {Promise<any>} Response data
 */
async function sendOTP({ mobile, otp, template_id }) {
    try {
        const formattedMobile = formatPhoneForMSG91(mobile);


        // Use MSG91 Flow API (as in freshcutss)
        // But pass the locally generated OTP in 'var' to ensure correct content
        const url = `${MSG91_BASE_URL}/flow/`;

        const payload = {
            template_id: template_id || config.msg91.templateId,
            sender: config.msg91.senderId,
            short_url: "0",
            mobiles: formattedMobile,
            var: otp || '' // crucial: map OTP to 'var'
        };

        logger.info(`[DEBUG_MSG91] Sending OTP via Flow API. Payload: ${JSON.stringify(payload)}`);

        // logger.info('Sending OTP request to MSG91', { mobile: formattedMobile });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'authkey': config.msg91.authKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();

        logger.info('MSG91 Response:', responseData);

        if (!response.ok) {
            logger.error('MSG91 OTP error', { status: response.status, data: responseData });
            throw new Error(responseData.message || 'Failed to send OTP');
        }

        return responseData;
    } catch (error) {
        logger.error('Error sending OTP:', error);
        throw error;
    }
}

/**
 * Verify OTP via MSG91
 * @param {Object} params
 * @param {string} params.mobile
 * @param {string} params.otp
 * @returns {Promise<any>} Verification result
 */
async function verifyOTP({ mobile, otp }) {
    try {
        const formattedMobile = formatPhoneForMSG91(mobile);

        const response = await fetch(`${MSG91_BASE_URL}/otp/verify`, {
            method: 'POST',
            headers: {
                'authkey': config.msg91.authKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mobile: formattedMobile,
                otp: otp
            })
        });

        return await response.json();
    } catch (error) {
        logger.error('Error verifying OTP:', error);
        throw error;
    }
}

/**
 * Resend OTP via MSG91 using flow API
 * @param {Object} params
 * @param {string} params.mobile
 * @param {string} [params.template_id]
 * @returns {Promise<any>} Response data
 */
async function resendOTP({ mobile, template_id }) {
    // Same as sendOTP basically for flow API usually, but sometimes separate endpoint
    return sendOTP({ mobile, template_id });
}

module.exports = {
    sendOTP,
    verifyOTP,
    resendOTP
};
