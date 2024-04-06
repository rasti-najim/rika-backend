import express, { Response } from "express";
import authenticate, { checkJwt } from "../middleware/authenticate";
import { CustomRequest } from "../utils/types/express";
import { retellClient } from "../db";
const debug = require("debug")("app:intialize_voice");

const router = express.Router();

router.post("/", async (req: CustomRequest, res: Response) => {
  // const userId = req.user?.id;
  const auth = req.auth;
  const userId = auth?.payload.sub;
  // const authHeader = req.headers["authorization"];
  // const token = authHeader && authHeader.split(" ")[1];
  const ngrokUrl = req.app.get("ngrokUrl");
  const wssUrl =
    ngrokUrl.replace("https", "wss") + "/llm-websocket?token=" + auth?.token;

  try {
    let agentId;
    const agentsList = await retellClient.listAgents();
    if (
      agentsList.agents &&
      agentsList.agents?.filter((agent) => agent.agentName === "Rika").length >
        0
    ) {
      agentId = agentsList.agents?.filter(
        (agent) => agent.agentName === "Rika"
      )[0].agentId;
    } else {
      const agentResponse = await retellClient.createAgent({
        agentName: "Rika",
        voiceId: "11labs-Kate",
        llmWebsocketUrl: wssUrl,
      });
      agentId = agentResponse.agent?.agentId;
    }

    const response = await retellClient.registerCall({
      agentId: agentId ?? "",
      // @ts-ignore
      audioWebsocketProtocol: "web",
      // @ts-ignore
      audioEncoding: "s16le",
      sampleRate: 24000,
    });

    res.status(200).send({
      agentId: response.callDetail?.agentId,
      callId: response.callDetail?.callId,
      sampleRate: response.callDetail?.sampleRate,
    });
  } catch {
    res.status(500).send("Error in initializing voice");
  }
});

export default router;
