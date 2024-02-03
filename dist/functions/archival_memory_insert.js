var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { v4: uuidv4 } = require("uuid");
const { client } = require("../db");
const openai = require("../utils/openaiClient");
const { OpenAIEmbeddingFunction } = require("chromadb");
require("dotenv").config();
/**
 * Adds content to archival memory. This function is designed to handle any Unicode content, including emojis.
 *
 * @param {string} userId - The user ID of the user who is adding content to memory.
 * @param {string} content - The content to be written to the memory.
 * @return {null} - This function does not produce a response.
 */
function archivalMemoryInsert(userId, content) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("archivalMemoryInsert called.");
        // const embedder = new OpenAIEmbeddingFunction({
        //   openai_api_key: process.env.OPENAI_API_KEY,
        // });
        const collection = yield client.getOrCreateCollection({
            name: "archival_memory",
            // embeddingFunction: embedder,
        });
        console.log(collection);
        // Implementation for adding content to archival memory goes here.
        // This could be a database write operation, a file system write, or any other form of data storage.
        const embedding = yield openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: content,
        });
        const embeddings = embedding.data[0].embedding;
        let id = uuidv4();
        let date = new Date();
        let dateString = date.toISOString().replace("T", " ").substring(0, 19);
        yield collection.add({
            ids: [id],
            embeddings: embeddings,
            metadatas: [{ userId: userId, timestamp: dateString }],
            documents: [content],
        });
        console.log(embedding.data[0].embedding.length);
        // const embedding = [-0.027631069, -0.0067949733];
        // Example: console.log("Content added to memory:", content);
        // Replace the above line with actual implementation.
        return null; // The function returns null as it does not produce a response.
    });
}
module.exports = archivalMemoryInsert;
