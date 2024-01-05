const fs = require("fs");
const path = require("path");
const archivalMemorySearch = require("../functions/archival_memory_search");
const { client } = require("../db");

const humanFile = path.join(__dirname, "../personas/human.txt");
const aiFile = path.join(__dirname, "../personas/ai.txt");

async function fetchPersona(userId, persona) {
  const collection = await client.getOrCreateCollection({
    name: `${persona}_personas`,
  });

  const results = await collection.get({
    where: { userId: userId },
    include: ["documents", "metadatas"],
  });

  if (results.documents.length == 0) {
    return;
  }

  console.log(results);
  console.log(results.metadatas[0]);

  const personaInfo = results.documents[0];

  // const personaInfo = await archivalMemorySearch(
  //   `Key details about the ${persona} persona`,
  //   openai
  // );

  console.log(personaInfo);
  return personaInfo;

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

module.exports = fetchPersona;
