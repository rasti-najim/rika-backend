import { v4 as uuidv4 } from "uuid";
import { client, pc } from "../db";
import openai from "../utils/openaiClient";
import { OpenAIEmbeddingFunction } from "chromadb";
import { MemoryMetadata } from "../models/archival_memory.model";
require("dotenv").config();

/**
 * Adds content to archival memory. This function is designed to handle any Unicode content, including emojis.
 *
 * @param {string} userId - The user ID of the user who is adding content to memory.
 * @param {string} content - The content to be written to the memory.
 * @return {Promise<null>} - The function does not produce a response.
 */
async function archivalMemoryInsert(
  userId: string,
  content: string
): Promise<null> {
  console.log("archivalMemoryInsert called.");
  try {
    // const embedder = new OpenAIEmbeddingFunction({
    //   openai_api_key: process.env.OPENAI_API_KEY,
    // });

    const index = pc.index<MemoryMetadata>("archival-memory");

    const collection = await client.getOrCreateCollection({
      name: "archival_memory",
      // embeddingFunction: embedder,
    });

    console.log(collection);

    // Implementation for adding content to archival memory goes here.
    // This could be a database write operation, a file system write, or any other form of data storage.
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: content,
    });

    const embeddings = embedding.data[0].embedding;

    let id = uuidv4();
    let date = new Date();
    let dateString = date.toISOString().replace("T", " ").substring(0, 19);

    await collection.add({
      ids: [id],
      embeddings: embeddings,
      metadatas: [{ userId: userId, timestamp: dateString }],
      documents: [content],
    });

    await index.upsert([
      {
        id: id,
        values: embeddings,
        metadata: { userId: userId, text: content, timestamp: dateString },
      },
    ]);

    console.log(embedding.data[0].embedding.length);

    // const embedding = [-0.027631069, -0.0067949733];

    // Example: console.log("Content added to memory:", content);
    // Replace the above line with actual implementation.

    return null; // The function returns null as it does not produce a response.
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

export default archivalMemoryInsert;
