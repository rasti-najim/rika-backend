const { v4: uuidv4 } = require("uuid");
const { client } = require("../db");
const { openai } = require("./chat");

async function savePersona(userId, content, persona, documentId = null) {
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
}

module.exports = savePersona;
