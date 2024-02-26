import express, { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export interface CustomRequest extends Request {
  user?: {
    id: string;
  };
}

// declare module "express-serve-static-core" {
//   interface Request {
//     user?: JwtPayload | string;
//   }
// }
