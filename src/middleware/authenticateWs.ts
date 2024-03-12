import express, { Request, NextFunction } from "express";
import { WebSocket } from "ws";
import jwt, { Secret } from "jsonwebtoken";
import { CustomRequest } from "../utils/types/express";

if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

const authenticateWs = (
  ws: WebSocket,
  req: CustomRequest,
  next: NextFunction
) => {
  const token = req.query.token;
  if (!token) {
    ws.close(4000, "No token provided");
    return;
  }

  jwt.verify(
    token as string,
    process.env.JWT_TOKEN as Secret,
    (err, decoded) => {
      if (err) {
        ws.close(4001, "Invalid Token");
        return;
      }

      // Attach user info to the request object
      req.user = decoded as { id: string };
      next();
    }
  );
};

export default authenticateWs;
