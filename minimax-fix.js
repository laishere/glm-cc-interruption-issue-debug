const express = require("express");
const pino = require("pino");
const pretty = require("pino-pretty");
const { Writable } = require("stream");

const app = express();
const PORT = process.env.PORT || 3000;

const logger = pino(
  pretty({
    colorize: true,
    translateTime: "HH:MM:ss.l",
    ignore: "pid,hostname",
  })
);

const fixedToolResults = new Set();

app.use(express.json());

app.post("/v1/messages", async (req, res) => {
  const startTime = Date.now();

  try {
    const targetUrl = "https://api.minimaxi.com/anthropic/v1/messages";

    const headers = req.headers;
    delete headers["content-length"];

    const body = req.body;
    body.messages = body.messages
      .map((m) => {
        if (
          Array.isArray(m.content) &&
          m.content.length > 1 &&
          m.content.some((part) => part.type === "tool_result")
        ) {
          const toolUseId = m.content.find(
            (part) => part.type === "tool_result"
          ).tool_use_id;
          if (!fixedToolResults.has(toolUseId)) {
            // only log once
            fixedToolResults.add(toolUseId);
            logger.info(
              "Fixed tool_result(%s) messages, parts: %j",
              toolUseId,
              m.content.map((p) => p.type)
            );
          }
          return m.content.map((part) => ({
            role: m.role,
            content: [part],
          }));
        }
        return m;
      })
      .flat();

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    await response.body.pipeTo(Writable.toWeb(res));

    const duration = Date.now() - startTime;
    logger.info(`${response.status} ${duration}ms`);
  } catch (error) {
    if (error.name === "AbortError") {
      logger.warn("Aborted");
      return;
    }
    logger.error(error, "Request failed");
    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
