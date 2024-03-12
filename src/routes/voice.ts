import express, { Response } from "express";
import { Server } from "socket.io";
import multer from "multer";
import fs from "fs";
import { RetellClient } from "retell-sdk";
import openai from "../utils/openaiClient";
import { chat } from "../utils/chat";
import authenticate from "../middleware/authenticate";
import { CustomRequest } from "../utils/types/express";
const debug = require("debug")("app:voice");

const router = express.Router();

const retellClient = new RetellClient({
  apiKey: process.env.RETELL_API_KEY,
});

router.post(
  "intialize_voice",
  authenticate,
  async (req: CustomRequest, res: Response) => {
    try {
      const agentResponse = await retellClient.createAgent({
        agentName: "Rika",
        voiceId: "openai-Nova",
        llmWebsocketUrl: `wss://${req.app.get("ngrokUrl")}/llm-websocket`,
      });

      const response = await retellClient.registerCall({
        agentId: agentResponse.agent?.agentId ?? "",
        // @ts-ignore
        audioWebsocketProtocol: "web",
        // @ts-ignore
        audioEncoding: "s16le",
        sampleRate: 24000,
      });

      res.status(200).send({ agentId: response.callDetail?.agentId });
    } catch {
      res.status(500).send("Error in initializing voice");
    }
  }
);

export default router;
