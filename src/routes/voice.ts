import express, { Response } from "express";
import { Server } from "socket.io";
import multer from "multer";
import fs from "fs";
import openai from "../utils/openaiClient";
import chat from "../utils/chat";
import authenticate from "../middleware/authenticate";
import { CustomRequest } from "../utils/types/express";
const debug = require("debug")("app:voice");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post(
  "/",
  upload.single("file"),
  async (req: CustomRequest, res: Response) => {
    try {
      // console.log("Received file:", req.file?.originalname);
      // const userId = req.user!.id;
      // // @ts-ignore
      // const { message, time } = req.body;

      // const completion = await chat({ userId, message, time });
      // debug("completion", completion);

      // res.json({ completion });
      const { file: base64Audio, fileName } = req.body;

      // Convert Base64 to binary
      const binaryData = Buffer.from(base64Audio, "base64");

      // Save the file
      const filePath = `uploads/${fileName}`;
      await fs.promises.writeFile(filePath, binaryData);

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
      });
      debug("transcription", transcription);

      const message = { role: "user", content: transcription.text };
      const completion = await chat({
        userId: req.user!.id,
        // @ts-ignore
        message: message,
        time: new Date().toISOString(),
      });
      debug("completion", completion);
      res.json({ completion });
    } catch (error) {
      res.sendStatus(500);
    }
  }
);

export default router;
