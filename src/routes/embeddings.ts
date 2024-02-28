import express from "express";
import { client, pc } from "../db";
import openai from "../utils/openaiClient";
import savePersona from "../utils/savePersona";
import { v4 as uuidv4 } from "uuid";
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

const router = express.Router();

router.get("/", async (req, res) => {
  const collections = await client.listCollections();
  res.send(collections);
});

router.get("/:name", async (req, res) => {
  const collection = await client.getCollection({ name: req.params.name });
  const response = await collection.get();
  res.send(response);
});

router.post("/personas", async (req, res) => {
  const { userId, content, name } = req.body;
  await savePersona(userId, content, name);
  res.sendStatus(200);
});

router.post("/upsert", async (req, res) => {
  try {
    const { userId, content, indexName } = req.body;
    const index = pc.index(indexName);
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: content,
    });

    const embeddings = embedding.data[0].embedding;
    let id = uuidv4();
    let date = new Date();
    let dateString = date.toISOString().replace("T", " ").substring(0, 19);
    await index.upsert([
      {
        id: id,
        values: embeddings,
        metadata: { userId: userId, text: content, timestamp: dateString },
      },
    ]);
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

router.delete("/:name", async (req, res) => {
  await client.deleteCollection({ name: req.params.name });
  res.sendStatus(200);
});

export default router;
