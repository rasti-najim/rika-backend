var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require("fs");
const path = require("path");
const debug = require("debug")("app:fetchPersona");
const archivalMemorySearch = require("../functions/archival_memory_search");
const { client } = require("../db");
const humanFile = path.join(__dirname, "../personas/human.txt");
const aiFile = path.join(__dirname, "../personas/ai.txt");
function fetchPersona(userId, persona) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = yield client.getOrCreateCollection({
            name: `${persona}_personas`,
        });
        const results = yield collection.get({
            where: { userId: userId },
            include: ["documents", "metadatas"],
        });
        if (results.documents.length == 0) {
            return [];
        }
        debug(results);
        debug(results.metadatas);
        const personaInfo = results.documents;
        // const personaInfo = await archivalMemorySearch(
        //   `Key details about the ${persona} persona`,
        //   openai
        // );
        debug(personaInfo);
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
    });
}
module.exports = fetchPersona;
