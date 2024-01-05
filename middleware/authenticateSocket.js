const jwt = require("jsonwebtoken");

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.query.token; // Get token from handshake query

  if (!token) {
    return next(new Error("No token provided"));
  }

  jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
    if (err) {
      return next(new Error("Token is not valid or has expired"));
    }
    socket.user = user; // Attach the user to the socket for future use
    next();
  });
};

module.exports = authenticateSocket;
