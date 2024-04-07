import Websocket from "ws";
import OpenAI from "openai";
import { CHAT } from "../constants/constants";
import tools from "../function_calls/functions";
import openai from "./openaiClient";
const debug = require("debug")("app:llmClient");
import handleToolCalls, { ToolCall } from "./handleToolCalls";
import { createSystemMessage } from "../functions/core_memory";
import { redisClient } from "../db";
import saveMessages from "../utils/saveMessages";

interface Utterance {
  role: "agent" | "user";
  content: string;
}

export interface RetellRequest {
  response_id?: number;
  transcript: Utterance[];
  interaction_type: "update_only" | "response_required" | "reminder_required";
}

export interface RetellResponse {
  response_id?: number;
  content: string;
  content_complete: boolean;
  end_call: boolean;
}

export interface FunctionCall {
  id: string;
  funcName: string | null;
  arguments: string | null;
  result?: string;
}

type Message = {
  message: OpenAI.Chat.ChatCompletionMessageParam;
  time: Date;
};

class LLMClient {
  private userId: string;
  private lastConversationLength: number;

  constructor(userId: string) {
    this.userId = userId;
    this.lastConversationLength = 0;
  }

  beginMessage(ws: Websocket) {
    const res: RetellResponse = {
      response_id: 0,
      content: "Hey there!",
      content_complete: true,
      end_call: false,
    };
    ws.send(JSON.stringify(res));
  }

  private async conversatoinToMessages(conversation: Utterance[]) {
    let result: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    for (let turn of conversation) {
      result.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      });
    }
    debug("Result", result);

    let newUtternaces: OpenAI.Chat.ChatCompletionMessageParam[] = result.slice(
      this.lastConversationLength
    );
    if (newUtternaces.length > 0) {
      let date = new Date();
      let dateString = date.toISOString().replace("T", " ").substring(0, 19);

      const newMessages: Message[] = newUtternaces.map((utterance) => {
        return {
          message: utterance,
          time: date,
        };
      });

      debug("New Messages", newMessages);
      await saveMessages(this.userId, newMessages);
    }

    this.lastConversationLength = conversation.length;

    return result;
  }

  private async preparePrompt(request: RetellRequest) {
    const transcript = await this.conversatoinToMessages(request.transcript);
    const ttl = 3600; // 1 hour TTL
    let systemMessage: string | null = null;
    systemMessage = await redisClient.get(`system_message_${this.userId}`);
    if (!systemMessage) {
      systemMessage = await createSystemMessage(this.userId);
      await redisClient.set(`system_message_${this.userId}`, systemMessage, {
        EX: ttl,
      });
    }
    debug("User ID", this.userId);
    debug("System Message", systemMessage);
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemMessage,
      },
    ];
    for (const message of transcript) {
      messages.push(message);
    }
    if (request.interaction_type === "reminder_required") {
      messages.push({
        role: "user",
        content: "(Now the human has not responded in a while, you would say:)",
      });
    }

    return messages;
  }

  async chat(request: RetellRequest, ws: Websocket) {
    if (request.interaction_type === "update_only") {
      return;
    }

    console.clear();
    console.log("req", request);

    if (
      request.interaction_type !== "response_required" &&
      request.interaction_type !== "reminder_required"
    ) {
      // process live transcript update if needed
      return;
    }
    const messages = await this.preparePrompt(request);

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: messages,
      model: "gpt-4-0125-preview",
      tools: tools,
      stream: true,
    };

    try {
      const completion = await openai.chat.completions.create(params);

      let funcCall: FunctionCall | null = null;
      let funcArguments = "";

      for await (const chunk of completion) {
        if (chunk.choices.length >= 1) {
          let delta = chunk.choices[0].delta;
          if (!delta) continue;

          if (delta.tool_calls && delta.tool_calls?.length >= 0) {
            const toolCall = delta.tool_calls[0];
            if (toolCall.id) {
              if (funcCall) {
                break;
              } else {
                funcCall = {
                  id: toolCall.id,
                  funcName: toolCall.function?.name || null,
                  arguments: toolCall.function?.arguments || null,
                };
              }
            } else {
              funcArguments += toolCall.function?.arguments || "";
            }
          } else if (delta.content) {
            const res: RetellResponse = {
              response_id: request.response_id,
              content: delta.content,
              content_complete: false,
              end_call: false,
            };
            ws.send(JSON.stringify(res));
          }
        }

        if (funcCall != null) {
          const toolCall: ToolCall = {
            id: funcCall.id,
            function: {
              name: funcCall.funcName ?? "",
              arguments: funcCall.arguments,
            },
          };
          const toolMessage = await handleToolCalls(this.userId, toolCall);
          const res: RetellResponse = {
            response_id: request.response_id,
            // @ts-ignore
            content: toolMessage?.content,
            content_complete: true,
          };
          ws.send(JSON.stringify(res));
        }
      }
    } catch (err) {
      console.error("Error in gpt stream: ", err);
    } finally {
      // Send a content complete no matter if error or not.
      const res: RetellResponse = {
        response_id: request.response_id,
        content: "",
        content_complete: true,
        end_call: false,
      };
      ws.send(JSON.stringify(res));
    }
  }
}

export default LLMClient;
