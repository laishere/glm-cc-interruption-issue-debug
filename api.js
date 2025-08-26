const fs = require("fs");

// UPDATE THIS
const ccRequestPath = "requests/req-2025-08-25T08-32-01-903Z.md";
const ccRequestText = fs.readFileSync(ccRequestPath, "utf-8");
const ccRequest = JSON.parse(ccRequestText.split("```json")[1].split("```")[0]);

/*

## CC Request

**Messages:**

type Text = {
  type: "text";
  text: string;
}

type ToolUse = {
  type: "tool_use";
  id: string;
  name: string;
  input: any;
}

type ToolResult = {
  type: "tool_result";
  content: string;
  is_error: boolean;
  tool_use_id: string;
}

type UserMessage = {
  role: "user";
  content: string | (Text | ToolResult)[];
}

type AssistantMessage = {
  role: "assistant";
  content: string | (Text | ToolUse)[];
}

body.messages: (UserMessage | AssistantMessage)[];

**System Messages:**

body.system: Text[];

**Tools**

type Tool = {
  name: string;
  description: string;
  input_schema: any;
}

body.tools: Tool[];

*/

async function testAnthropicAPI() {
  const url = "https://open.bigmodel.cn/api/anthropic/v1/messages";
  const { headers, ...body } = ccRequest;
  delete headers['content-length'];
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Anthropic API Response:");
  console.log("-----------------------------------");
  console.log(text);
  console.log("-----------------------------------\n");
}

async function testOfficialAPI() {
  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const body = {
    model: "glm-4.5",
    messages: [
      ccRequest.system.map((message) => ({
        role: "system",
        content: message.text,
      })),
      ccRequest.messages
        .map((message) => {
          if (Array.isArray(message.content)) {
            return message.content.map((part) => ({
              role: message.role,
              content: part,
            }));
          }
          return message;
        })
        .flat()
        .map((message) => {
          // message.content is text or object
          const c = message.content;
          if (typeof c === "string") {
            return {
              role: message.role,
              content: c,
            };
          }
          switch (c.type) {
            case "text":
              return {
                role: message.role,
                content: c.text,
              };
            case "tool_use":
              return {
                role: message.role,
                tool_calls: [
                  {
                    id: c.id,
                    type: "function",
                    function: {
                      name: c.name,
                      arguments: JSON.stringify(c.input),
                    },
                  },
                ],
              };
            case "tool_result":
              return {
                role: "tool",
                content: c.content,
                tool_call_id: c.tool_use_id,
              };
            default:
              throw new Error(`Unknown content type: ${c.type}`);
          }
        }),
    ].flat(),

    ...(ccRequest.tools && {
      tools: ccRequest.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })),
    }),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: ccRequest.headers.authorization,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Official API Response:");
  console.log("Context:");
  console.log(JSON.stringify(body.messages, null, 2));
  console.log("-----------------------------------");
  console.log(text);
  console.log("-----------------------------------\n");
}

async function main() {
  await testAnthropicAPI();
  await testOfficialAPI();
}

main();
