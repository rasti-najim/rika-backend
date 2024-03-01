import express, { Response } from "express";
import { Server } from "socket.io";
import chat from "../utils/chat";
import authenticate from "../middleware/authenticate";
import { CustomRequest } from "../utils/types/express";
const debug = require("debug")("app:voice");

const router = express.Router();

router.post("/", authenticate, async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    // @ts-ignore
    const { message, time } = req.body;

    const completion = await chat({ userId, message, time });
    debug("completion", completion);

    res.json({ completion });
  } catch (error) {
    res.sendStatus(500);
  }
});
