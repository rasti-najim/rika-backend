import jwt, { Secret } from "jsonwebtoken";
import { Socket } from "socket.io";
import { CustomSocket } from "../utils/types/socket";

const authenticateSocket = (socket: CustomSocket, next: Function) => {
  const token = socket.handshake.query.token; // Get token from handshake query

  if (!token) {
    return next(new Error("No token provided"));
  }

  if (Array.isArray(token)) {
    return next(new Error("Multiple tokens provided"));
  }

  jwt.verify(token, process.env.JWT_TOKEN as Secret, (err, user) => {
    if (err) {
      return next(new Error("Token is not valid or has expired"));
    }
    socket.user = user; // Attach the user to the socket for future use
    next();
  });
};

export default authenticateSocket;
