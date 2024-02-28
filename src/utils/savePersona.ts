import { v4 as uuidv4 } from "uuid";
import { client, pc } from "../db";
import openai from "./openaiClient";
import { Metadata } from "../models/archival_memory.model";

/**
 * Saves a persona to the database.
 *
 * @param {string} userId - The user ID of the user who is adding content to memory.
 * @param {string} content - The content to be written to the memory.
 * @param {string} persona - The persona to save the content to.
 * @param {string|null} [documentId=null] - The ID of the document to update. If null, a new document is created.
 */
async function savePersona(
  userId: string,
  content: string,
  persona: string,
  documentId: string | null = null
) {
  const index = pc.index<Metadata>(`${persona}_personas`);

  const collection = await client.getOrCreateCollection({
    name: `${persona}_personas`,
  });

  const collectionCount = await collection.count();
  console.log(collectionCount);

  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: content,
  });

  const embeddings = embedding.data[0].embedding;
  let id = uuidv4();
  let date = new Date();
  let dateString = date.toISOString().replace("T", " ").substring(0, 19);

  const results = await collection.upsert({
    ids: [documentId || id],
    embeddings: embeddings,
    metadatas: [{ userId: userId, timestamp: dateString }],
    documents: [content],
  });

  await index.upsert([
    {
      id: documentId || id,
      values: embeddings,
      metadata: { userId: userId, text: content, timestamp: dateString },
    },
  ]);
}

export default savePersona;
