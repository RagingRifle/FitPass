const express = require('express');
const { z } = require('zod');
const { registerUser, authUser, verifyOTP, checkUserAndSendOTP, updateProfile, uploadProfileImage } = require('../controllers/authController');
const { authLimiter, otpVerifyLimiter } = require('../middleware/rateLimiters');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { profileImageUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  gymName: z.string().min(1, 'Gym name must be at least 1 character').optional(),
}).refine(data => data.phone || data.gymName, {
  message: "Either phone (for members) or gymName (for gym admins) must be provided",
  path: ["phone", "gymName"],
});

const loginSchema = z.object({
  email: z.string().min(1, 'Email address or phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

const checkUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  otp: z.union([z.string(), z.number()])
    .transform(val => String(val).trim())
    .refine(val => /^\d{6}$/.test(val), 'OTP must be a 6-digit number'),
});

// Tight per-IP rate limits on the auth surface (brute-force protection):
//   - login + check-user + register: 5 / 15 min (authLimiter)
//   - verify-otp: 5 / 10 min (otpVerifyLimiter) -- the critical OTP brute-force fix
router.post('/register', authLimiter, validate({ body: registerSchema }), registerUser);
router.post('/login', authLimiter, validate({ body: loginSchema }), authUser);
router.post('/check-user', authLimiter, validate({ body: checkUserSchema }), checkUserAndSendOTP);
router.post('/verify-otp', otpVerifyLimiter, validate({ body: verifyOtpSchema }), verifyOTP);
router.put('/profile', protect, updateProfile);
router.put('/profile/image', protect, profileImageUpload.single('profileImage'), uploadProfileImage);

module.exports = router;

