const express = require("express");
const { client } = require("../db");
const savePersona = require("../utils/savePersona");
require("dotenv").config();

const router = express.Router();

router.get("/", async (req, res) => {
  const collections = await client.listCollections();
  res.send(collections);
});

router.get("/:name", async (req, res) => {
  const collection = await client.getCollection({ name: req.params.name });
  const response = await collection.get();
  res.send(response);
});

router.post("/personas", async (req, res) => {
  const { userId, content, name } = req.body;
  await savePersona(userId, content, name);
  res.sendStatus(200);
});

router.delete("/:name", async (req, res) => {
  await client.deleteCollection({ name: req.params.name });
  res.sendStatus(200);
});

module.exports = router;
