const verifyEmailTemplate = (name, verificationUrl) => {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Welcome ${name}</h2>

      <p>
        Thank you for registering with AMIRSAD Gold Trading.
      </p>

      <p>
        Please verify your email address by clicking the button below.
      </p>

      <a
        href="${verificationUrl}"
        style="
          background:#D4AF37;
          color:white;
          padding:12px 24px;
          text-decoration:none;
          border-radius:5px;
          display:inline-block;
        "
      >
        Verify Email
      </a>

      <p>
        If you didn't create an account, please ignore this email.
      </p>
    </div>
  `;
};

module.exports = verifyEmailTemplate;