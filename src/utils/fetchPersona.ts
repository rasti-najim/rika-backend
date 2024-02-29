import path from "path";
const debug = require("debug")("app:fetchPersona");
import archivalMemorySearch from "../functions/archival_memory_search";
import { client, pc } from "../db";
import { IncludeEnum } from "chromadb";
import fetchEmbeddingIds from "./fetchEmbeddingIds";

const humanFile = path.join(__dirname, "../personas/human.txt");
const aiFile = path.join(__dirname, "../personas/ai.txt");

/**
 *
 * @param {string} userId - The user ID
 * @param {string} persona - The persona to fetch
 * @returns {Promise<(string | null)[]>} - The persona information
 */
export default async function fetchPersona(
  userId: string,
  persona: string
): Promise<(string | null)[]> {
  const index = pc.index(`${persona}-personas`);

  const collection = await client.getOrCreateCollection({
    name: `${persona}_personas`,
  });

  const results = await collection.get({
    where: { userId: userId },
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
  });

  if (results.documents.length == 0) {
    return [];
  }

  debug(results);
  debug(results.metadatas);

  // const ids = await fetchEmbeddingIds();
  // const pineconeResults = await index.fetch(ids);

  const personaInfo = results.documents;

  // const personaInfo = await archivalMemorySearch(
  //   `Key details about the ${persona} persona`,
  //   openai
  // );

  debug(personaInfo);
  return Promise.resolve(personaInfo);

  // if (personaInfo === "No results found.") {
  //   return;
  // }

  // fs.writeFile(file, personaInfo, (err) => {
  //   if (err) {
  //     console.error("Error writing file:", err);
  //   } else {
  //     console.log("Successfully wrote to file");
  //   }
  // });
}
