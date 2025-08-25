const express = require("express");
const pino = require("pino");
const pretty = require("pino-pretty");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const logger = pino(
  pretty({
    colorize: true,
    translateTime: "HH:MM:ss.l",
    ignore: "pid,hostname",
  })
);

app.use(express.json());

const requestsDir = path.join(__dirname, "requests");
if (!fs.existsSync(requestsDir)) {
  fs.mkdirSync(requestsDir, { recursive: true });
}

async function logRequestResponse(requestData, responseData) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `req-${timestamp}.md`;
  const filepath = path.join(requestsDir, filename);

  const resData = responseData.data;
  delete responseData.data;

  const content = `# Request Log - ${new Date().toISOString()}

## Request
\`\`\`json
${JSON.stringify(requestData, null, 2)}
\`\`\`

## Response
\`\`\`json
${JSON.stringify(responseData, null, 2)}
\`\`\`

**Data:**
\`\`\`
${resData}
\`\`\`

`;

  fs.writeFileSync(filepath, content);
  logger.info(`Request logged to ${filename}`);
}

app.post("/v1/messages", async (req, res) => {
  const startTime = Date.now();
  logger.info("Incoming request to /v1/messages");

  try {
    const requestData = {
      ...req.body,
      headers: req.headers,
    };

    const targetUrl = "https://open.bigmodel.cn/api/anthropic/v1/messages";

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseData = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        responseData += chunk;
        res.write(chunk);
      }

      await logRequestResponse(requestData, {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
      });

      const duration = Date.now() - startTime;
      logger.info(`Request completed in ${duration}ms`);
      res.end();
    } catch (error) {
      logger.error("Stream error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (error) {
    logger.error("Request failed:", error.message);

    await logRequestResponse(req.body, {
      error: error.message,
      status: 500,
    });

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Anthropic API Proxy Server",
    endpoints: ["/v1/messages"],
    version: "1.0.0",
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
