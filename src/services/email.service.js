const transporter = require("../config/mail");
const verifyEmailTemplate = require("../templates/verifyEmail");
const welcomeEmailTemplate = require("../templates/welcomeEmail");

class EmailService {
  async sendVerificationEmail(user, token) {
    const verificationUrl =
      `${process.env.CLIENT_URL}/verify-email/${token}`;

    await transporter.sendMail({
      from: `"AMIRSAD Gold Trading" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Verify Your Email",
      html: verifyEmailTemplate(
        user.fullName,
        verificationUrl
      ),
    });
  }

  async sendWelcomeEmail(user) {
    await transporter.sendMail({
      from: `"AMIRSAD Gold Trading" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Welcome to AMIRSAD",
      html: welcomeEmailTemplate(user.fullName),
    });
  }
}

module.exports = new EmailService();