# Anthropic API DEBUG & WORKAROUND

A simple project to debug and a workaround for the GLM Anthropic API endpoint issue https://github.com/zai-org/GLM-4.5/issues/57(fixed)

**Updated(11/3/2025)**:
Add workaround for Minimax at ./minimax-fix.js.
To run it:

```sh
npm i
npm run minimax
```

## Workaround

The workaround proxy server is implemented at ./server-fix.js.
It transforms all the problematic `tool_result` messages to the well-supported format.

### How to use:

1. Clone this repository
2. Run `npm install`
3. Run the fix server and your CC:

```sh
npm run fix
ANTHROPIC_BASE_URL=http://localhost:3000 claude
```

## Steps to reproduce and debug:

### 1. Run the server

```sh
npm install
npm start
```

### 2. Run the Claude Code

```sh
ANTHROPIC_BASE_URL=http://localhost:3000 claude
```

### 3. Play with the CC:

- user: write a simple text to a.txt
- cc: `<output and ask for permission>`
- user: `<reject>`
- user: write it to b.txt instead
- cc: `<output and ask for permission>`

### 4. Check the recorded requests under `requests/`

You should see the agent still wants to write to `a.txt` NOT `b.txt` by checking the last request.md file.

## Compare the results of official API endpoint and Anthropic API endpoint

Copy the relative path of the step 4. request.md file, update the api.js

```js
const ccRequestPath = "requests/req-xxx.md";
```

Run it via `node api.js`

## My Conclusion:

The official Anthropic API implementation seems to ignore the following user message content pieces after the tool result content:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "content": "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.",
      "is_error": true,
      "tool_use_id": "call_421hc6d81hl"
    },
    {
      "type": "text",
      "text": "[Request interrupted by user for tool use]"
    },
    {
      "type": "text",
      "text": "changed my mind, let's write it to b.txt",
      "cache_control": {
        "type": "ephemeral"
      }
    }
  ]
}
```

The `tool_result` message contains multiple content pieces, but after running the api.js test for multiple times, the API has two behavior：

- the agent still tries to write to a.txt
- the agent realizes the user rejected it, but the agent is not able to pick up the b.txt at all.

**Based on the above, it's highly likely that the Anthropic to official API transformation is not correctly implemented content with multiple pieces (at least for the `tool_result`)**
