const nodemailer = require("nodemailer");

/**
 * Send email utility
 * Supports both HTML and text templates
 */
const sendEmail = async (options) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Prepare email content
    let htmlContent = "";
    let textContent = "";

    if (options.template === "emailVerification") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4a261; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #e76f51; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AMIRSAD Gold Platform</h1>
            </div>
            <div class="content">
              <h2>Welcome ${options.data.name}!</h2>
              <p>Thank you for registering with AMIRSAD Gold Trading Management Platform.</p>
              <p>Please verify your email address to complete your registration and start using our services.</p>
              <div style="text-align: center;">
                <a href="${options.data.url}" class="button">Verify Email Address</a>
              </div>
              <p>Or copy and paste this link in your browser:</p>
              <p><small>${options.data.url}</small></p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account with us, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} AMIRSAD ENERGY CONSULT. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      textContent = `Welcome ${options.data.name}!\n\nThank you for registering with AMIRSAD Gold Platform.\n\nPlease verify your email by clicking this link: ${options.data.url}\n\nThis link will expire in 24 hours.`;
    } else if (options.template === "passwordReset") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4a261; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background-color: #e76f51; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { color: #d9534f; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello ${options.data.name},</p>
              <p>We received a request to reset your password for your AMIRSAD Gold Platform account.</p>
              <div style="text-align: center;">
                <a href="${options.data.url}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link:</p>
              <p><small>${options.data.url}</small></p>
              <p>This link will expire in 1 hour.</p>
              <p class="warning">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} AMIRSAD ENERGY CONSULT</p>
            </div>
          </div>
        </body>
        </html>
      `;
      textContent = `Password Reset Request\n\nClick this link to reset your password: ${options.data.url}\n\nThis link expires in 1 hour.`;
    } else {
      // Custom email
      htmlContent = options.html || `<p>${options.message}</p>`;
      textContent = options.text || options.message;
    }

    // Mail options
    const mailOptions = {
      from: `"AMIRSAD Gold Platform" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: textContent,
      html: htmlContent,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = sendEmail;
