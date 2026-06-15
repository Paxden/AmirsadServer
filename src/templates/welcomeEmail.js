const welcomeEmailTemplate = (name) => {
  return `
    <div>
      <h2>Welcome ${name}</h2>

      <p>
        Your account has been successfully verified.
      </p>

      <p>
        You can now access AMIRSAD Gold Trading Platform.
      </p>
    </div>
  `;
};

module.exports = welcomeEmailTemplate;