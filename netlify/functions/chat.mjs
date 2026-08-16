// chat.mjs
// Версия без AI API.
// Работает через поиск по базе знаний.
// Позже AI можно будет подключить отдельным слоем.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// НАСТРОЙКИ
// --------------------------------------------------

const PORT = process.env.PORT || 8888;

// Папка с базой знаний
const KNOWLEDGE_DIR = path.join(__dirname, "knowledge");

// --------------------------------------------------
// ЗАГРУЗКА БАЗЫ ЗНАНИЙ
// --------------------------------------------------

let knowledgeBase = [];

function loadKnowledgeBase() {
  knowledgeBase = [];

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log("Папка knowledge не найдена.");
    return;
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR);

  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);

    if (!fs.statSync(filePath).isFile()) continue;

    try {
      const ext = path.extname(file).toLowerCase();

      // Поддержка JSON
      if (ext === ".json") {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        if (Array.isArray(data)) {
          knowledgeBase.push(...data);
        } else if (Array.isArray(data.items)) {
          knowledgeBase.push(...data.items);
        }

        continue;
      }

      // Поддержка обычных TXT/MD файлов
      if (ext === ".txt" || ext === ".md") {
        const text = fs.readFileSync(filePath, "utf8");

        knowledgeBase.push({
          question: file,
          answer: text
        });
      }
    } catch (error) {
      console.error(`Ошибка загрузки ${file}:`, error.message);
    }
  }

  console.log(`База знаний загружена: ${knowledgeBase.length} записей`);
}

// --------------------------------------------------
// НОРМАЛИЗАЦИЯ ТЕКСТА
// --------------------------------------------------

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------
// РАЗБИВАЕМ ТЕКСТ НА СЛОВА
// --------------------------------------------------

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter(word => word.length > 2);
}

// --------------------------------------------------
// ПРОСТОЙ ПОИСК ПО БАЗЕ
// --------------------------------------------------

function calculateScore(query, item) {
  const queryWords = tokenize(query);

  const sourceText = normalizeText(
    `${item.question || ""} ${item.title || ""} ${item.content || ""} ${item.answer || ""}`
  );

  const sourceWords = new Set(tokenize(sourceText));

  if (!queryWords.length) {
    return 0;
  }

  let matches = 0;

  for (const word of queryWords) {
    if (sourceWords.has(word)) {
      matches++;
    }
  }

  // Дополнительный бонус за точное вхождение фразы
  const normalizedQuery = normalizeText(query);

  let phraseBonus = 0;

  if (
    normalizedQuery.length > 3 &&
    sourceText.includes(normalizedQuery)
  ) {
    phraseBonus = 5;
  }

  return matches / queryWords.length + phraseBonus;
}

// --------------------------------------------------
// ПОИСК
// --------------------------------------------------

function searchKnowledge(query) {
  if (!query || !query.trim()) {
    return [];
  }

  const results = knowledgeBase
    .map(item => ({
      item,
      score: calculateScore(query, item)
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);

  return results.slice(0, 5);
}

// --------------------------------------------------
// ФОРМИРОВАНИЕ ОТВЕТА
// --------------------------------------------------

function getAnswer(query) {
  const results = searchKnowledge(query);

  if (!results.length) {
    return {
      found: false,
      answer:
        "Я пока не нашёл информацию по этому вопросу в базе знаний.",
      results: []
    };
  }

  const best = results[0];

  const answer =
    best.item.answer ||
    best.item.content ||
    best.item.text ||
    best.item.description;

  if (!answer) {
    return {
      found: false,
      answer:
        "Я нашёл подходящую информацию, но у этой записи нет готового ответа.",
      results
    };
  }

  return {
    found: true,
    answer,
    results: results.map(result => ({
      question: result.item.question || result.item.title || "",
      score: Number(result.score.toFixed(3))
    }))
  };
}

// --------------------------------------------------
// HTTP SERVER
// --------------------------------------------------

async function startServer() {
  loadKnowledgeBase();

  const http = await import("http");

  const server = http.createServer((req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    // OPTIONS
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ------------------------------------------------
    // HEALTH CHECK
    // ------------------------------------------------

    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8"
      });

      res.end(
        JSON.stringify({
          ok: true,
          service: "knowledge-base",
          ai: false,
          knowledgeItems: knowledgeBase.length
        })
      );

      return;
    }

    // ------------------------------------------------
    // GET /health
    // ------------------------------------------------

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8"
      });

      res.end(
        JSON.stringify({
          ok: true,
          ai: false,
          knowledgeItems: knowledgeBase.length
        })
      );

      return;
    }

    // ------------------------------------------------
    // POST /chat
    // ------------------------------------------------

    if (req.method === "POST" && req.url === "/chat") {
      let body = "";

      req.on("data", chunk => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const data = JSON.parse(body);

          const message =
            data.message ||
            data.text ||
            data.query ||
            "";

          if (!message.trim()) {
            res.writeHead(400, {
              "Content-Type":
                "application/json; charset=utf-8"
            });

            res.end(
              JSON.stringify({
                ok: false,
                error: "Пустой запрос"
              })
            );

            return;
          }

          const result = getAnswer(message);

          res.writeHead(200, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          res.end(
            JSON.stringify({
              ok: true,
              ai: false,
              query: message,
              ...result
            })
          );
        } catch (error) {
          console.error("Ошибка обработки запроса:", error);

          res.writeHead(500, {
            "Content-Type":
              "application/json; charset=utf-8"
          });

          res.end(
            JSON.stringify({
              ok: false,
              error: "Ошибка сервера"
            })
          );
        }
      });

      return;
    }

    // ------------------------------------------------
    // 404
    // ------------------------------------------------

    res.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8"
    });

    res.end(
      JSON.stringify({
        ok: false,
        error: "Маршрут не найден"
      })
    );
  });

  server.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log("Единая база знаний ИИ");
    console.log("Режим: БЕЗ AI");
    console.log(`Порт: ${PORT}`);
    console.log(`Записей в базе: ${knowledgeBase.length}`);
    console.log("=================================");
    console.log("");
  });
}

startServer();
