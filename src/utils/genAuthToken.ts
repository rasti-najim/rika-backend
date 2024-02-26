import jwt, { Secret } from "jsonwebtoken";
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

function genAuthToken(userId: string) {
  const jwtToken: Secret | undefined = process.env.JWT_TOKEN;
  if (!jwtToken) {
    throw new Error("JWT_TOKEN is not defined");
  }
  return jwt.sign({ id: userId }, jwtToken, {
    expiresIn: "1h",
  });
}

module.exports = genAuthToken;
