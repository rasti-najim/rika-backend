const jwt = require("jsonwebtoken");
require("dotenv").config();

function genAuthToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_TOKEN, {
    expiresIn: "1h",
  });
}

module.exports = genAuthToken;
