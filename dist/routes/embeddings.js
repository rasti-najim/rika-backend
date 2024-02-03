var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require("express");
const { client } = require("../db");
const savePersona = require("../utils/savePersona");
if (process.env.NODE_ENV === "production") {
    require("dotenv").config({ path: "/etc/app.env" });
}
else {
    require("dotenv").config();
}
const router = express.Router();
router.get("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
    const collections = yield client.listCollections();
    res.send(collections);
}));
router.get("/:name", (req, res) => __awaiter(this, void 0, void 0, function* () {
    const collection = yield client.getCollection({ name: req.params.name });
    const response = yield collection.get();
    res.send(response);
}));
router.post("/personas", (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { userId, content, name } = req.body;
    yield savePersona(userId, content, name);
    res.sendStatus(200);
}));
router.delete("/:name", (req, res) => __awaiter(this, void 0, void 0, function* () {
    yield client.deleteCollection({ name: req.params.name });
    res.sendStatus(200);
}));
module.exports = router;
