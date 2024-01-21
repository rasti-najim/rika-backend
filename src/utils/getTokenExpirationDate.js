const jwt = require("jsonwebtoken");

function getTokenExpirationDate(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000); // Convert to JavaScript Date
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
}

module.exports = getTokenExpirationDate;
