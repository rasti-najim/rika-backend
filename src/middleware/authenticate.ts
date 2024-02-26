import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { CustomRequest } from "../utils/types/express";

if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

const authenticate = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).send("No token provided"); // Or any appropriate message
  }

  jwt.verify(token, process.env.JWT_TOKEN as Secret, (err, user) => {
    if (err) {
      return res.status(403).send("Token is not valid or has expired"); // Or any appropriate message
    }
    console.log(user);
    req.user = user as { id: string };
    next();
  });
};
export default authenticate;
