import { client } from "../db";
import openai from "./openaiClient";
import { IncludeEnum, Metadata } from "chromadb";

async function getMostRecentThoughts(userId: string, topK: number = 3) {
  const collection = await client.getOrCreateCollection({
    name: "archival_memory",
    // embeddingFunction: embedder,
  });

  const collectionCount = await collection.count();
  console.log(collectionCount);

  const results = await collection.get({
    where: { userId: userId },
    limit: topK,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
  });
}
