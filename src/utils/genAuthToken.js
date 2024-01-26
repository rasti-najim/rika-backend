const jwt = require("jsonwebtoken");
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

function genAuthToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_TOKEN, {
    expiresIn: "1h",
  });
}

module.exports = genAuthToken;
