const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
const fs = require("fs");
const util = require("util");
require("dotenv").config();

const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Define your routes here
const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Multer setup for audio files
const upload = multer({ storage: multer.memoryStorage() });

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const writeFileAsync = util.promisify(fs.writeFile);
const unlinkAsync = util.promisify(fs.unlink);
const mkdirAsync = util.promisify(fs.mkdir);

const uploadsDir = "uploads";

router.get("/", authenticate, (req, res) => {
  res.send("Audio");
});

// POST route for audio file processing
router.post("/", upload.single("audioFile"), async (req, res) => {
  console.log(req.file);
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  try {
    // Check if uploads directory exists, if not create it
    if (!fs.existsSync(uploadsDir)) {
      await mkdirAsync(uploadsDir);
    }

    // Temporary file paths
    const tempWebMFilePath = `uploads/${Date.now()}_input.webm`;
    const tempMp3FilePath = `uploads/${Date.now()}_output.mp3`;

    // Write the buffer (WebM file) to a file
    await writeFileAsync(tempWebMFilePath, req.file.buffer);

    // Convert WebM to MP3
    await convertToMp3(tempWebMFilePath, tempMp3FilePath);

    // Send the MP3 file to OpenAI's API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempMp3FilePath),
      model: "whisper-1",
    });

    // Cleanup: delete temporary files
    await unlinkAsync(tempWebMFilePath);
    await unlinkAsync(tempMp3FilePath);

    res.json({ transcription: transcription.text });
  } catch (error) {
    console.error("Error processing audio:", error);
    res.status(500).send("Error processing audio");
  }
});

const convertToMp3 = (inputFilePath, outputFilePath) => {
  return new Promise((resolve, reject) => {
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

module.exports = router;
