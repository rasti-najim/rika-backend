import express, { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export interface CustomRequest extends Request {
  auth?: {
    header: any;
    payload: JwtPayload;
    token: string;
  };
  user?: {
    id: string;
  };
}

// declare module "express-serve-static-core" {
//   interface Request {
//     user?: JwtPayload | string;
//   }
// }
