import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
const debug = require("debug")("app:voice");
import openai from "./openaiClient";
import { chat } from "./chat";

const streamPipeline = promisify(pipeline);

async function voice(
  userId: string,
  base64Audio: string,
  fileName: string,
  app: any = null
) {
  const filePath = path.join("uploads", fileName);
  let buffer = Buffer.from(base64Audio, "base64");

  await fs.promises.writeFile(filePath, buffer);

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
  });
  debug("transcription", transcription);

  const message = { role: "user", content: transcription.text };
  let completion = await chat(
    userId,
    // @ts-ignore
    message,
    new Date().toISOString().replace("T", " ").substring(0, 19)
  );
  debug("completion", completion);

  if (completion && "role" in completion && completion.role === "tool") {
    debug("completion", completion);
    completion = await chat(
      userId,
      completion,
      // new Date().toISOString().replace("T", " ").substring(0, 19)
      new Date()
    );
    debug("completion", completion);
    return Promise.resolve(completion);
  }

  if (completion && "choices" in completion) {
    const assistantMessage = completion.choices[0].message.content;
    debug("assistantMessage", assistantMessage);
    const mp3 = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "nova",
      input: assistantMessage || "",
    });

    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/Jm4ciUZNz6Bxqh2D93Hl/stream",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVEN_LABS_API_KEY || "",
        },
        body: JSON.stringify({
          model_id: "eleven_turbo_v2",
          text: assistantMessage || "",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );
    if (response.ok) {
      const outputPath = path.join("uploads", "output.mp3");

      await streamPipeline(
        // @ts-ignore
        response.body,
        fs.createWriteStream(outputPath)
      );
    } else {
      throw new Error("Failed to convert text to speech");
    }

    const speechFile = path.join("uploads", "speach.mp3");
    // const speechFile = path.join("uploads", "output.mp3");
    console.log(speechFile);
    buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);
    // const base64Speech = buffer.toString("base64");

    const ngrokUrl = app.get("ngrokUrl");
    const audioUrl = `${ngrokUrl}/${speechFile}`;

    return Promise.resolve(audioUrl);
  } else {
    throw new Error("Completion does not have choices");
  }
}

export default voice;
