require("dotenv").config();
const transporter = require("../utils/mailer");

async function sendTestEmail() {
  try {
    const info = await transporter.sendMail({
      from: `"AMIRSAD Gold Trading" <${process.env.EMAIL_USER}>`,
      to: "paxdenco@gmail.com",
      subject: "Test Email",
      html: `
        <h2>Hello!</h2>
        <p>This is a test email from Node.js.</p>
      `,
    });

    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("Email error:", error);
  }
}

sendTestEmail();