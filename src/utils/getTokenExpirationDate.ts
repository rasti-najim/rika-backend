import jwt from "jsonwebtoken";

function getTokenExpirationDate(token: string) {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload; // Add type assertion
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
