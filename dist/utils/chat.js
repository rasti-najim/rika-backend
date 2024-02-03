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
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const { encoding_for_model } = require("tiktoken");
const debug = require("debug")("app:chat");
require("dotenv").config();
const tools = require("../function_calls/functions");
const { client } = require("../db");
const { redisClient } = require("../db");
const openai = require("./openaiClient");
const { updateSystemMessage, createSystemMessage, } = require("../functions/core_memory");
const saveMessages = require("../utils/save_messages");
const loadMessages = require("../utils/load_messages");
const isPaired = require("../utils/isPaired");
const validateMessages = require("./validateMessages");
const handleToolCalls = require("./handleToolCalls");
function chat(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userId, message, time } = data;
        const listKey = `messages_${userId}`;
        const ttl = 3600; // TTL in seconds, for example, 1 hour
        let systemMessage;
        systemMessage = yield redisClient.get(`system_message_${userId}`);
        if (!systemMessage) {
            systemMessage = yield createSystemMessage(userId);
            yield redisClient.set(`system_message_${userId}`, systemMessage, {
                EX: 3600,
            });
        }
        console.log("User ID", userId);
        console.log("System Message", systemMessage);
        // Load previous messages
        let prevMessages = yield loadAndPreparePreviousMessages(userId, listKey, ttl);
        // Prepare new messages array
        let messages = [{ role: "system", content: systemMessage }];
        if (prevMessages.length)
            messages = [...messages, ...prevMessages];
        messages.push(message);
        // let prevMessages = [];
        // let originalLength = 0;
        // if (!listExists) {
        //   prevMessages = await loadMessages(userId);
        //   debug("Previous messages from the databse", prevMessages);
        //   if (prevMessages.length > 0) {
        //     const messageStrings = prevMessages.map((msg) => JSON.stringify(msg));
        //     await redisClient.rPush(`messages_${userId}`, ...messageStrings);
        //     // Set TTL for the list if it's being created
        //     if (!listExists) {
        //       await redisClient.expire(listKey, ttl);
        //     }
        //   }
        // } else {
        //   prevMessages = (
        //     await redisClient.lRange(`messages_${userId}`, -10, -1)
        //   ).reverse();
        //   debug("Previous messages from Redis", prevMessages);
        //   prevMessages = prevMessages.map((item) => JSON.parse(item));
        // }
        // if (prevMessages.length > 0) {
        //   debug("previous messages", prevMessages);
        //   messages = [messages[0], ...prevMessages, messages[1]];
        //   originalLength = messages.length;
        //   validateMessages(messages); // Assume this function cleans the messages
        //   // Check if messages were modified
        //   if (messages.length !== originalLength) {
        //     // Update Redis list only if modifications were made
        //     // Delete the old list in Redis
        //     await redisClient.del(`messages_${userId}`);
        //     // Repopulate Redis with the cleaned messages
        //     const messageStrings = messages
        //       .slice(1)
        //       .map((msg) => JSON.stringify(msg));
        //     await redisClient.rPush(`messages_${userId}`, ...messageStrings);
        //     // Set TTL for the list if it's being created
        //     if (!listExists) {
        //       await redisClient.expire(listKey, ttl);
        //     }
        //   }
        // } else {
        //   messages = [messages[0], messages[1]];
        // }
        // Validate and possibly update messages in Redis
        yield validateAndUpdateMessages(userId, messages, listKey, ttl);
        debug("Messages", messages);
        const completion = yield openai.chat.completions.create({
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            model: "gpt-4-1106-preview",
        });
        console.log(completion.choices[0]);
        messages.push(completion.choices[0].message);
        let date = new Date();
        let dateString = date.toISOString().replace("T", " ").substring(0, 19);
        // Check the number of messages in the Redis list
        // const listLength = await redisClient.lLen(`messages_${userId}`);
        // // If the list has 10 or more messages, remove the oldest one
        // if (listLength >= 10) {
        //   let oldestMessage = JSON.parse(
        //     await redisClient.lIndex(`messages_${userId}`, 0)
        //   );
        //   // Check if removing the oldest message breaks a pair
        //   if (oldestMessage.role === "assistant") {
        //     let secondOldestMessage = JSON.parse(
        //       await redisClient.lIndex(`messages_${userId}`, 1)
        //     );
        //     if (
        //       secondOldestMessage.role === "tool" &&
        //       oldestMessage.tool_calls[0].id === secondOldestMessage.tool_call_id
        //     ) {
        //       // Remove the pair
        //       await redisClient.lPop(`messages_${userId}`);
        //     }
        //   }
        //   // Remove the oldest message
        //   await redisClient.lPop(`messages_${userId}`);
        // }
        const newMessages = [
            { message: message, time: time },
            { message: completion.choices[0].message, time: dateString },
        ];
        yield saveNewMessages(userId, newMessages, listKey, ttl);
        // Simplify the loop for pushing new messages to Redis
        // listExists = await redisClient.exists(`messages_${userId}`);
        // const messageStrings = newMessages.map((msg) => JSON.stringify(msg.message));
        // debug("Message Strings", messageStrings);
        // await redisClient.rPush(`messages_${userId}`, ...messageStrings);
        // Optionally, if you want to ensure that the list never exceeds 10 messages,
        // you can use LTRIM here as a safety measure
        // await redisClient.lTrim(`messages_${userId}`, -10, -1);
        // Set TTL for the list if it's being created
        // if (!listExists) {
        //   await redisClient.expire(listKey, ttl);
        // }
        // await saveMessages(userId, newMessages);
        // await saveMessages(newMessages, messagesFile);
        const useTools = completion.choices[0].finish_reason === "tool_calls";
        if (useTools) {
            const toolMessage = yield handleToolCalls(userId, completion);
            //   res.send(toolMessage);
            return toolMessage;
        }
        return completion;
    });
}
function loadAndPreparePreviousMessages(userId, listKey, ttl) {
    return __awaiter(this, void 0, void 0, function* () {
        const listExists = yield redisClient.exists(listKey);
        let prevMessages = [];
        let originalLength = 0;
        if (!listExists) {
            prevMessages = yield loadMessages(userId);
            debug("Previous messages from the databse", prevMessages);
            if (prevMessages.length) {
                const messageStrings = prevMessages.map((msg) => JSON.stringify(msg));
                for (let message of messageStrings) {
                    yield redisClient.rPush(`messages_${userId}`, message);
                }
                // Set TTL for the list if it's being created
                yield redisClient.expire(listKey, ttl);
            }
        }
        else {
            prevMessages = (yield redisClient.lRange(`messages_${userId}`, -10, -1))
                .reverse()
                .map((item) => JSON.parse(item));
            debug("Previous messages from Redis", prevMessages);
        }
        return prevMessages;
    });
}
function validateAndUpdateMessages(messages, listKey, ttl) {
    return __awaiter(this, void 0, void 0, function* () {
        const originalLength = messages.length;
        validateMessages(messages); // Assuming this function modifies 'messages' array
        if (messages.length !== originalLength) {
            yield redisClient.del(listKey);
            const messageStrings = messages
                .slice(1, -1)
                .map((msg) => JSON.stringify(msg));
            for (let message of messageStrings) {
                yield redisClient.rPush(listKey, message);
            }
            yield redisClient.expire(listKey, ttl);
        }
    });
}
function saveNewMessages(userId, newMessages, listKey, ttl) {
    return __awaiter(this, void 0, void 0, function* () {
        const listExists = yield redisClient.exists(listKey);
        const messageStrings = newMessages.map((msg) => JSON.stringify(msg.message));
        debug("Message Strings", messageStrings);
        for (let message of messageStrings) {
            yield redisClient.rPush(listKey, message);
        }
        if (!listExists) {
            yield redisClient.expire(listKey, ttl);
        }
        yield saveMessages(userId, newMessages);
    });
}
module.exports = chat;
