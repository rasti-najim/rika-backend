import OpenAI from "openai";

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Sends a message to the human user.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "Message contents. All unicode (including emojis) are supported.",
          },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_memory_append",
      description: "Append to the contents of core memory.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Section of the memory to be edited (persona or human).",
          },
          content: {
            type: "string",
            description:
              "Content to write to the memory. All unicode (including emojis) are supported.",
          },
          request_heartbeat: {
            type: "boolean",
            description:
              "Request an immediate heartbeat after function execution. Set to 'true' if you want to send a follow-up message or run a follow-up function.",
          },
        },
        required: ["name", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_memory_replace",
      description:
        "Replace to the contents of core memory. To delete memories, use an empty string for new_content.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Section of the memory to be edited (persona or human).",
          },
          old_content: {
            type: "string",
            description: "String to replace. Must be an exact match.",
          },
          new_content: {
            type: "string",
            description:
              "Content to write to the memory. All unicode (including emojis) are supported.",
          },
          // request_heartbeat: {
          //   type: "boolean",
          //   description:
          //     "Request an immediate heartbeat after function execution. Set to 'true' if you want to send a follow-up message or run a follow-up function.",
          // },
        },
        required: ["name", "old_content", "new_content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "conversation_search",
      description:
        "Search prior conversation history using case-insensitive string matching.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "String to search for.",
          },
          page: {
            type: "integer",
            description:
              "Allows you to page through results. Only use on a follow-up query. Defaults to 0 (first page).",
          },
          // request_heartbeat: {
          //   type: "boolean",
          //   description:
          //     "Request an immediate heartbeat after function execution. Set to 'true' if you want to send a follow-up message or run a follow-up function.",
          // },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "conversation_search_date",
      description: "Search prior conversation history using a date range.",
      parameters: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description:
              "The start of the date range to search, in the format 'YYYY-MM-DD'.",
          },
          end_date: {
            type: "string",
            description:
              "The end of the date range to search, in the format 'YYYY-MM-DD'.",
          },
          page: {
            type: "integer",
            description:
              "Allows you to page through results. Only use on a follow-up query. Defaults to 0 (first page).",
          },
          // request_heartbeat: {
          //   type: "boolean",
          //   description:
          //     "Request an immediate heartbeat after function execution. Set to 'true' if you want to send a follow-up message or run a follow-up function.",
          // },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archival_memory_insert",
      description:
        "Add to archival memory. Make sure to phrase the memory contents such that it can be easily queried later and write it in the form of an inner monologue reflecting on the contents of the message.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "Content to write to the memory. All unicode (including emojis) are supported.",
          },
          // request_heartbeat: {
          //   type: "boolean",
          //   description:
          //     "Request an immediate heartbeat after function execution. Set to 'true' if you want to send a follow-up message or run a follow-up function.",
          // },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archival_memory_search",
      description:
        "Search archival memory using semantic (embedding-based) search.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "String to search for.",
          },
          page: {
            type: "integer",
            description:
              "Allows you to page through results. Only use on a follow-up query. Defaults to 0 (first page).",
          },
          // request_heartbeat: {
          //   type: "boolean",
          //   description:
          //     "Request an immediate heartbeat after function execution. Set to 'true' if you want to send a follow-up message or run a follow-up function.",
          // },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inner_monologue",
      description:
        "Write an inner monologue reflecting on the contents of the message .",
      parameters: {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "This is your inner monologue.",
          },
        },
        required: ["thought"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "knowledge_graph_insert",
      description:
        "Construct a neo4j knowledge graph for the given text using cypher. Only write the cypher query to create the graph.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Cypher query to create the knowledge graph.",
          },
        },
        required: ["query"],
      },
    },
  },
];

export default tools;
