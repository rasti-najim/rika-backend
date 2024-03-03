import fs from "fs";
import path from "path";
const debug = require("debug")("app:voice");
import openai from "./openaiClient";
import chat from "./chat";

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
    completion = await chat(
      userId,
      completion,
      new Date().toISOString().replace("T", " ").substring(0, 19)
    );
    debug("completion", completion);
  }

  if (completion && "choices" in completion) {
    const assistantMessage = completion.choices[0].message.content;
    debug("assistantMessage", assistantMessage);
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: assistantMessage || "",
    });

    const speechFile = path.join("uploads", "speach.mp3");
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
