const fs = require("fs");

// UPDATE THIS
const ccRequestPath = "requests/req-2025-08-25T08-32-01-903Z.md";
const ccRequestText = fs.readFileSync(ccRequestPath, "utf-8");
const ccRequest = JSON.parse(ccRequestText.split("```json")[1].split("```")[0]);

const transformedBody = {
  model: "glm-4.5",
  messages: [
    ccRequest.system.map((message) => ({
      role: "system",
      content: message.text,
    })),
    ccRequest.messages
      .map((message) => {
        // Handle different message types
        if (message.role === "user") {
          return {
            role: "user",
            content: Array.isArray(message.content)
              ? message.content.map((item) => item.text).join("\n")
              : message.content,
          };
        } else if (message.role === "assistant") {
          const transformedMessage = {
            role: "assistant",
            content: Array.isArray(message.content)
              ? message.content
                  .filter((item) => item.type === "text")
                  .map((item) => item.text)
                  .join("\n")
              : message.content,
          };

          // Handle tool calls
          const toolUses = Array.isArray(message.content)
            ? message.content.filter((item) => item.type === "tool_use")
            : [];

          if (toolUses.length > 0) {
            transformedMessage.tool_calls = toolUses.map((toolUse) => ({
              id: toolUse.id,
              type: "function",
              function: {
                name: toolUse.name,
                arguments: JSON.stringify(toolUse.input),
              },
            }));
          }

          return transformedMessage;
        } else if (
          message.role === "user" &&
          Array.isArray(message.content) &&
          message.content.some((item) => item.type === "tool_result")
        ) {
          // Handle tool results - convert to tool message
          const toolResults = message.content.filter(
            (item) => item.type === "tool_result"
          );
          const textContent = message.content.filter(
            (item) => item.type === "text"
          );

          return toolResults
            .map((toolResult) => ({
              role: "tool",
              content: toolResult.content,
              tool_call_id: toolResult.tool_use_id,
            }))
            .concat(
              textContent.length > 0
                ? [
                    {
                      role: "user",
                      content: textContent.map((item) => item.text).join("\n"),
                    },
                  ]
                : []
            );
        } else {
          throw new Error(
            `Unknown message role or content type: ${JSON.stringify(message)}`
          );
        }
      })
      .flat(),
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

async function testAnthropicAPI() {
  const url = "https://open.bigmodel.cn/api/anthropic/v1/messages";
  const { headers, ...body } = ccRequest;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Anthropic API Response:");
  console.log("-----------------------------------\n");
  console.log(text);
  console.log("-----------------------------------\n");
}

async function testOfficialAPI() {
  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: ccRequest.headers.authorization,
    },
    body: JSON.stringify(transformedBody),
  });
  const text = await res.text();
  console.log("Official API Response:");
  console.log("-----------------------------------\n");
  console.log(text);
  console.log("-----------------------------------\n");
}

async function main() {
  await testAnthropicAPI();
  await testOfficialAPI();
}

main();
