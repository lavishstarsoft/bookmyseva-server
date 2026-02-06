const FrontendUser = require('../models/FrontendUser');
const Otp = require('../models/Otp');
const msg91Service = require('../services/msg91Service');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const logger = require('../services/logger');

// Generate JWT for customer
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: 'customer',
            email: user.email,
            mobile: user.phone || user.mobile // handle both if schema varies
        },
        config.jwt.secret,
        { expiresIn: '30d' } // Long expiration for mobile/consumer apps
    );
};

exports.sendOtp = async (req, res, next) => {
    try {
        const { mobile, isSignup } = req.body;

        logger.info(`[DEBUG_OTP] Request received. Mobile: ${mobile}, isSignup: ${isSignup}, Body: ${JSON.stringify(req.body)}`);

        if (!mobile) {
            return res.status(400).json({ status: 'fail', message: 'Mobile number is required' });
        }

        // Validate Indian mobile number
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(mobile)) {
            return res.status(400).json({ status: 'fail', message: 'Please enter a valid 10-digit Indian mobile number' });
        }

        // Check if user exists
        const user = await FrontendUser.findOne({ phone: mobile });

        if (isSignup) {
            // Registration Flow: Fail if user ALREADY exists
            if (user) {
                return res.status(400).json({ status: 'fail', message: 'User already exists. Please login.' });
            }
        } else {
            // Login Flow: Fail if user DOES NOT exist
            // Default to login flow if isSignup is not explicitly true
            if (!user) {
                logger.info(`[DEBUG_OTP] User not found for mobile ${mobile}. Returning 404.`);
                return res.status(404).json({ status: 'fail', message: 'User not found. Please register first.' });
            }
        }

        // Generate 4-digit OTP locally
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Store OTP in DB (expires in 5 mins)
        // Upsert to replace any existing OTP for this phone
        await Otp.findOneAndUpdate(
            { phone: mobile },
            {
                phone: mobile,
                otp: otp,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
            },
            { upsert: true, new: true }
        );

        // Send OTP
        logger.info(`Generated & Stored OTP for ${mobile}: ${otp}`); // For debugging
        await msg91Service.sendOTP({ mobile, otp });

        res.status(200).json({
            status: 'success',
            message: 'OTP sent successfully',
            mobile,
            debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    } catch (error) {
        logger.error('Send OTP Controller Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send OTP' });
    }
};

exports.verifyOtp = async (req, res, next) => {
    try {
        const { mobile, otp, name, email, isSignup } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({ status: 'fail', message: 'Mobile number and OTP are required' });
        }

        // Verify OTP Locally
        const storedOtp = await Otp.findOne({ phone: mobile });

        if (!storedOtp) {
            return res.status(400).json({ status: 'fail', message: 'OTP expired or not found' });
        }

        if (storedOtp.otp !== otp) {
            return res.status(400).json({ status: 'fail', message: 'Invalid OTP' });
        }

        // Delete OTP after successful verification (prevent replay)
        await Otp.deleteOne({ _id: storedOtp._id });


        // Check if user exists
        // FrontendUser schema has 'email' as unique and required. msg91 flow is mobile first.
        // We need to handle this. If user login via mobile, we might look up by phone.
        // Let's check FrontendUser model again.
        // It has name, email(req, unique), phone.
        // If login by mobile, we search by phone.

        // Note: The schema enforces email. If it's pure mobile login, we might need a dummy email or ask email during signup.

        let user = await FrontendUser.findOne({ phone: mobile });

        if (isSignup) {
            if (user) {
                return res.status(400).json({ status: 'fail', message: 'User already exists with this mobile number' });
            }

            if (!email || !name) {
                return res.status(400).json({ status: 'fail', message: 'Name and Email are required for registration' });
            }

            // Check if email already taken
            const existingEmail = await FrontendUser.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ status: 'fail', message: 'Email already currently in use' });
            }

            user = await FrontendUser.create({
                name,
                email,
                phone: mobile,
                authProvider: 'mobile',
                status: 'Active'
            });

        } else {
            // Login flow
            if (!user) {
                return res.status(404).json({ status: 'fail', message: 'User not found. Please register first.' });
            }
        }

        // Generate Token
        const token = generateToken(user);

        res.status(200).json({
            status: 'success',
            message: isSignup ? 'Registration successful' : 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        logger.error('Verify OTP Controller Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to verify OTP' });
    }
};
