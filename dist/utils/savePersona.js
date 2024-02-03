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
const openai = require("./openaiClient");
function savePersona(userId, content, persona, documentId = null) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = yield client.getOrCreateCollection({
            name: `${persona}_personas`,
        });
        const collectionCount = yield collection.count();
        console.log(collectionCount);
        const embedding = yield openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: content,
        });
        const embeddings = embedding.data[0].embedding;
        let id = uuidv4();
        let date = new Date();
        let dateString = date.toISOString().replace("T", " ").substring(0, 19);
        const results = yield collection.upsert({
            ids: [documentId || id],
            embeddings: embeddings,
            metadatas: [{ userId: userId, timestamp: dateString }],
            documents: [content],
        });
    });
}
module.exports = savePersona;
