const nodemailer = require('nodemailer');
const logger = require('../lib/logger');
const env = require('../config/env');

const buildOTPEmailHTML = (otpCode, subject) => {
  const isLogin = subject.toLowerCase().includes('login');
  const heading = isLogin ? 'Verify your login' : 'Verify your email address';
  const bodyText = isLogin
    ? "You requested to log in to your FitPrime account. Use the code below to verify it's you. This code is valid for the next <strong>10 minutes</strong>."
    : "You're so close to starting your FitPrime journey! Use the verification code below to confirm your email address and activate your account. This code is valid for the next <strong>10 minutes</strong>.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${heading}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header Logo -->
          <tr>
            <td align="center" style="padding: 36px 40px 28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#FF7A00; width:40px; height:40px; border-radius:50%; text-align:center; vertical-align:middle;">
                    <span style="font-size:20px; line-height:40px;">⚡</span>
                  </td>
                  <td style="padding-left:10px; vertical-align:middle;">
                    <span style="font-size:22px; font-weight:800; color:#111111; letter-spacing:-0.5px;">FitPrime</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Banner -->
          <tr>
            <td align="center" style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #FF7A00 0%, #FF9F40 100%); border-radius: 12px; padding: 36px 24px;">
                    <div style="background:rgba(255,255,255,0.15); width:64px; height:64px; border-radius:50%; display:inline-block; line-height:64px; text-align:center; font-size:32px; margin-bottom:12px;">🔐</div>
                    <div style="font-size:36px; font-weight:800; color:#ffffff; letter-spacing:10px; font-family:monospace; background:rgba(0,0,0,0.15); padding:14px 28px; border-radius:8px; display:inline-block; margin-top:8px;">${otpCode}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td align="center" style="padding: 0 40px 32px;">
              <h1 style="font-size:26px; font-weight:800; color:#111111; margin:0 0 16px; letter-spacing:-0.5px; text-align:center;">${heading}</h1>
              <p style="font-size:15px; color:#555555; line-height:1.7; margin:0; text-align:center;">${bodyText}</p>
            </td>
          </tr>

          <!-- OTP Info Box -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#FFF5EB; border-radius:10px; padding:16px 20px; border-left:4px solid #FF7A00;">
                    <p style="margin:0; font-size:13px; color:#FF7A00; font-weight:600;">⏱ Expires in 10 minutes</p>
                    <p style="margin:6px 0 0; font-size:13px; color:#888888;">If you didn't request this, you can safely ignore this email. Your account remains secure.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border:none; border-top:1px solid #eeeeee; margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 40px 36px;">
              <p style="font-size:12px; color:#aaaaaa; margin:0 0 8px; line-height:1.6;">
                If you have any questions, email us at
                <a href="mailto:support@fitprime.in" style="color:#FF7A00; text-decoration:none; font-weight:600;">support@fitprime.in</a>
              </p>
              <p style="font-size:12px; color:#cccccc; margin:0;">
                © 2025 FitPrime. All rights reserved.<br/>
                <span style="font-size:11px;">Gym Management Platform</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const sendEmail = async (options) => {
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');

  // Extract OTP from message for the template
  const otpMatch = options.message && options.message.match(/\b\d{6}\b/);
  const otpCode = otpMatch ? otpMatch[0] : '------';

  const htmlBody = options.html || buildOTPEmailHTML(otpCode, options.subject);

  // Without real SMTP credentials there is nowhere to actually deliver the
  // email. In development that's a deliberate console fallback so the OTP
  // flow is still testable; in production, fail loudly instead of silently
  // "succeeding" while leaking the OTP to logs.
  if (!emailUser || emailUser === 'test@example.com' || emailUser.includes('your_email')) {
    if (!env.isProduction) {
      logger.debug({ email: options.email, subject: options.subject, otp: otpCode }, '[DEVELOPMENT] Email not sent — no SMTP credentials configured');
      return;
    }
    throw new Error('Email is not configured (missing SMTP credentials) in production.');
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    connectionTimeout: 3000,
    socketTimeout: 4000,
    greetingTimeout: 3000,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const mailOptions = {
    from: `${process.env.FROM_NAME || 'FitPrime'} <${process.env.FROM_EMAIL || emailUser}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: htmlBody,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    logger.error({ err: error, email: options.email }, 'SMTP send error');
    // Callers such as registration rely on delivery success before reporting
    // that verification can continue. Let them handle failures (registration
    // removes the newly-created unverified account so the user can retry).
    throw error;
  }
};

module.exports = sendEmail;
