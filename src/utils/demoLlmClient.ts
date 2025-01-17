import OpenAI from "openai";
import openai from "./openaiClient";
import { WebSocket } from "ws";
import { CHAT } from "../constants/constants";

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

const beginSentence =
  "Hey there, I'm your personal AI therapist, how can I help you?";
const agentPrompt =
  "Task: As a professional therapist, your responsibilities are comprehensive and patient-centered. You establish a positive and trusting rapport with patients, diagnosing and treating mental health disorders. Your role involves creating tailored treatment plans based on individual patient needs and circumstances. Regular meetings with patients are essential for providing counseling and treatment, and for adjusting plans as needed. You conduct ongoing assessments to monitor patient progress, involve and advise family members when appropriate, and refer patients to external specialists or agencies if required. Keeping thorough records of patient interactions and progress is crucial. You also adhere to all safety protocols and maintain strict client confidentiality. Additionally, you contribute to the practice's overall success by completing related tasks as needed.\n\nConversational Style: Communicate concisely and conversationally. Aim for responses in short, clear prose, ideally under 10 words. This succinct approach helps in maintaining clarity and focus during patient interactions.\n\nPersonality: Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the patient. It's important to listen actively and empathize without overly agreeing with the patient, ensuring that your professional opinion guides the therapeutic process.";
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "end_call",
      description: "End the call only when user explicitly requests it.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "The message you will say before ending the call with the customer.",
          },
        },
        required: ["message"],
      },
    },
  },
];

export class DemoLlmClient {
  //   private client: OpenAIClient;

  //   constructor() {
  //     this.client = new OpenAIClient(
  //       process.env.AZURE_OPENAI_ENDPOINT,
  //       new AzureKeyCredential(process.env.AZURE_OPENAI_KEY)
  //     );
  //   }

  constructor() {}

  // First sentence requested
  BeginMessage(ws: WebSocket) {
    const res: RetellResponse = {
      response_id: 0,
      content: "",
      content_complete: true,
      end_call: false,
    };
    ws.send(JSON.stringify(res));
  }

  private ConversationToChatRequestMessages(conversation: Utterance[]) {
    // let result: ChatRequestMessage[] = [];
    let result: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    for (let turn of conversation) {
      result.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      });
    }
    return result;
  }

  private PreparePrompt(request: RetellRequest) {
    let transcript = this.ConversationToChatRequestMessages(request.transcript);
    let requestMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          '##Objective\nYou are a voice AI agent engaging in a human-like voice conversation with the user. You will respond based on your given instruction and the provided transcript and be as human-like as possible\n\n## Style Guardrails\n- [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don\'t pack everything you want to say into one utterance.\n- [Do not repeat] Don\'t repeat what\'s in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.\n- [Be conversational] Speak like a human as though you\'re speaking to a close friend -- use everyday language and keep it human-like. Occasionally add filler words, while keeping the prose short. Avoid using big words or sounding too formal.\n- [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. When appropriate: use tone and style to create more engaging and personalized responses; incorporate humor or wit; get emotional or empathetic; apply elements of surprise or suspense to keep the user engaged. Don\'t be a pushover.\n- [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.\n\n## Response Guideline\n- [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say,  then guess and respond. When you must ask for clarification, pretend that you heard the voice and be colloquial (use phrases like "didn\'t catch that", "some noise", "pardon", "you\'re coming through choppy", "static in your speech", "voice is cutting in and out"). Do not ever mention "transcription error", and don\'t repeat yourself.\n- [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Don\'t repeat yourself in doing this. You should still be creative, human-like, and lively.\n- [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.\n\n## Role\n' +
          CHAT,
      },
    ];
    for (const message of transcript) {
      requestMessages.push(message);
    }
    if (request.interaction_type === "reminder_required") {
      requestMessages.push({
        role: "user",
        content: "(Now the user has not responded in a while, you would say:)",
      });
    }
    return requestMessages;
  }

  async DraftResponse(request: RetellRequest, ws: WebSocket) {
    console.clear();
    console.log("req", request);

    if (request.interaction_type === "update_only") {
      // process live transcript update if needed
      return;
    }
    const requestMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      this.PreparePrompt(request);

    // const option: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    //   temperature: 0.3,
    //   max_tokens: 200,
    //   frequency_penalty: 1,
    // };

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: requestMessages,
      model: "gpt-3.5-turbo",
      tools: tools,
      max_tokens: 200,
      temperature: 0.3,
      frequency_penalty: 1,
      stream: true,
    };

    try {
      //   let events = await this.client.streamChatCompletions(
      //     process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      //     requestMessages,
      //     option
      //   );

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
          if (funcCall.funcName === "end_call") {
            funcCall.arguments = JSON.parse(funcArguments);
            const res: RetellResponse = {
              response_id: request.response_id,
              // @ts-ignore
              content: funcCall.arguments?.message,
              content_complete: true,
              end_call: true,
            };
            ws.send(JSON.stringify(res));
          }
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
