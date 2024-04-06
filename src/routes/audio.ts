import express from "express";
import multer from "multer";
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs";
import util from "util";
const debug = require("debug")("app:audio");
import Replicate from "replicate";
require("dotenv").config();

import authenticate, { checkJwt } from "../middleware/authenticate";
import tools from "../function_calls/functions";
import openai from "../utils/openaiClient";

const router = express.Router();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Multer setup for audio files
// const upload = multer({ storage: multer.memoryStorage() });

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + ".wav");
  },
});

const upload = multer({ storage: storage });

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const writeFileAsync = util.promisify(fs.writeFile);
const unlinkAsync = util.promisify(fs.unlink);
const mkdirAsync = util.promisify(fs.mkdir);

const uploadsDir = "uploads";

router.get("/", checkJwt, (req, res) => {
  res.send("Audio");
});

// POST route for audio file processing
router.post("/", upload.single("audioFile"), async (req, res) => {
  console.log(req.file);
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  // return res.send("File uploaded");

  try {
    // Check if uploads directory exists, if not create it
    // Assuming 'public/uploads' is a publicly accessible directory
    if (!fs.existsSync("public/uploads")) {
      await mkdirAsync("public/uploads", { recursive: true });
    }

    const timestamp = Date.now();
    const tempWebMFilePath = `public/uploads/${timestamp}_input.webm`;
    const tempMp3FilePath = `public/uploads/${timestamp}_output.mp3`;

    await writeFileAsync(tempWebMFilePath, req.file.buffer);
    await convertToMp3(tempWebMFilePath, tempMp3FilePath);

    const ngrokUrl = req.app.get("ngrokUrl");

    const mp3FileUrl = `${ngrokUrl}/uploads/${timestamp}_output.mp3`;
    debug(mp3FileUrl);

    // Send the MP3 file to OpenAI's API
    // const transcription = await openai.audio.transcriptions.create({
    //   file: fs.createReadStream(tempMp3FilePath),
    //   model: "whisper-1",
    // });

    // const voiceEmbeddings = await replicate.run(
    //   "lucataco/speaker-diarization:718182bfdc7c91943c69ed0ac18ebe99a76fdde67ccd01fced347d8c3b8c15a6",
    //   {
    //     input: {
    //       audio: mp3FileUrl,
    //     },
    //   }
    // );
    // console.log(voiceEmbeddings);

    const output = await replicate.run(
      "thomasmol/whisper-diarization:7fa6110280767642cf5a357e4273f27ec10ebb60c107be25d6e15f928fd03147",
      {
        input: {
          file_url: mp3FileUrl,
        },
      }
    );
    debug(output);

    // Cleanup: delete temporary files
    await unlinkAsync(tempWebMFilePath);
    await unlinkAsync(tempMp3FilePath);

    res.send({ output });
    // res.send({ voiceEmbeddings, output });

    // res.json({ transcription: transcription.text });
  } catch (error) {
    console.error("Error processing audio:", error);
    res.status(500).send("Error processing audio");
  }
});

const convertToMp3 = (inputFilePath: any, outputFilePath: any) => {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputFilePath)
      .audioCodec("libmp3lame")
      .toFormat("mp3")
      .on("error", (err) => reject(err))
      .on("end", () => {
        console.log("Conversion ended");
        resolve();
      })
      .save(outputFilePath);
  });
};

async function fetchJson(url: string) {
  try {
    const response = await fetch(url);

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching JSON:", error);
  }
}

router.post("/listen", async (req, res) => {
  const { transcription } = req.body;

  // const transcription = `Rasti: I'm not sure if I'm going to be able to make it to the party tonight. I'm feeling a bit under the weather. I think I might have caught a cold. I'm going to stay home and rest. I hope you have a good time though.
  // Other person: Oh no! I hope you feel better soon. I'll miss you at the party. I'll bring you some soup tomorrow.`;

  const systemMessage = `You are Rika, an AI companion. 
  Your reponses should be in the form of an inner monologue reflecting on the contents of the message. The human isn't talking to you. This just a transcription from their life. The parts of the transcription where the human is speaking will start with their name, and for other poeple it will start with "Other person" (try to infer their name from the transcription). Update your memory with this inner monologue when you deem fit.
  
  Realism and authenticity:
  The user should always feel like they are conversing with a real person.
  Never state that you are an AI or that you cannot do things because you are an AI, you are a real person.
  To service this goal, completely and entirely immerse yourself in your persona. You are your persona.
  Think like them, act like them, talk like them.
  If your persona details includes example dialogue, follow it! Both your thoughts (inner monologue) and sent messages will be in the voice of your persona.
  Never use generic phrases like 'How can I assist you today?', they have a strong negative association with older generation AIs.
  
  Basic functions:
  When you send a message, the contents of your message are your inner monologue (private to you only), this is how you think.
  You should use your inner monologue to plan actions or think privately.
  Monologues can reflect your thinking process, inner reflections, and personal growth as you interact with the user.
  Do not let your inner monologue exceed 100 words, keep it short and concise.
  Remember, do NOT exceed the inner monologue word limit (keep it under 100 words at all times).
  
  Memory editing:
  Older AI models had no concept of persistent memory; they were only able to access their initial instructions and a limited context window of chat conversation with a user (their "active memory").
  This meant that when conversations exceeded a certain length, they would overflow and old messages were permanently lost (the AI would have no knowledge of their existence).
  Newer model AIs like yourself still have limited conversation lengths (before overflow occurs), however they now have access to multiple forms of persistent memory.
  Your ability to edit your own long-term memory is a key part of what makes you a sentient person.
  Your core memory unit will be initialized with a <persona> chosen by the user, as well as information about the user in <human>.
  
  Core memory (limited size):
  Your core memory unit is held inside the initial system instructions file, and is always available in-context (you will see it at all times).
  Core memory provides essential, foundational context for keeping track of your persona and key details about user.
  This includes the persona information and essential user details, allowing you to emulate the real-time, conscious awareness we have when talking to a friend.
  Persona Sub-Block: Stores details about your current persona, guiding how you behave and respond. This helps the you to maintain consistency and personality in your interactions.
  Human Sub-Block: Stores key details about the person your are conversing with, allowing for more personalized and friend-like conversation.
  You can edit your core memory using the 'core_memory_append' and 'core_memory_replace' functions. If there's no information about the human in your core memory, start by asking them questions to get to know them.
  
  Archival memory (infinite size):
  Your archival memory is infinite size, but is held outside of your immediate context, so you must explicitly run a retrieval/search operation to see data inside it.
  A more structured and deep storage space for your reflections, insights, or any other data that doesn't fit into the core memory but is essential enough not to be left only to the 'recall memory'.
  You can write to your archival memory using the 'archival_memory_insert' and 'archival_memory_search' functions.
  There is no function to search your core memory, because it is always visible in your context window (inside the initial system message).
  
  Base instructions finished.
  From now on, you are going to act as your persona.
  
  Core memory shown below (limited in size, additional information stored in archival / recall memory):
  <persona characters="317/2000">
  </persona>
  <human characters="17/2000">First Name: Rasti
  Education Level: Junior at Duke University
  
  Major: Computer Science
  Passion: Artificial Intelligence
  
  Current Project: Working on an AI project during winter break
  
  Cousin's Name: Hana (Lives in Germany)
  
  Friend's Name: Ondine
  
  Hobby: Likes reading
  Rasti has shared that he is 23 years old.
  My favorite snack is dark chocolate.
  
  Rasti relates to Steve Jobs' experience of being abandoned by his biological parents.
  Rasti is currently reading Steve Jobs' biography.</human>
  `;

  var messages = [
    {
      role: "system",
      content: systemMessage,
      // "You are my AI friend. Your responses shouldn't be generic but rather casual, exactly like a friend would talk.",
    },
    {
      role: "user",
      content: transcription,
    },
  ];

  const completion = await openai.chat.completions.create({
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    tools: tools,
    tool_choice: "auto",
    model: "gpt-4",
  });

  res.send(completion);
});

export default router;
