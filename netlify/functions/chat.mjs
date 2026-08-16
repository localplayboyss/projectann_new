import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// --------------------------------------------------
// Поиск knowledge.json
// --------------------------------------------------

function findKnowledgeFile() {
  const possiblePaths = [
    path.join(__dirname, "../../knowledge/knowledge.json"),
    path.join(process.cwd(), "knowledge/knowledge.json"),
    path.join(process.cwd(), "/knowledge/knowledge.json")
  ];

  for (const filePath of possiblePaths) {
    console.log("Проверяю:", filePath);

    if (fs.existsSync(filePath)) {
      console.log("БАЗА НАЙДЕНА:", filePath);
      return filePath;
    }
  }

  console.log("knowledge.json НЕ НАЙДЕН");

  return null;
}

// --------------------------------------------------
// Загрузка базы
// --------------------------------------------------

function loadKnowledge() {
  const filePath = findKnowledgeFile();

  if (!filePath) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");

    console.log("Размер базы:", raw.length);

    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    return [];

  } catch (error) {
    console.error("Ошибка JSON:", error);
    return [];
  }
}

// --------------------------------------------------
// Нормализация
// --------------------------------------------------

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------
// Планеты
// --------------------------------------------------

const planets = [
  "луна",
  "солнце",
  "марс",
  "меркурий",
  "венера",
  "юпитер",
  "сатурн"
];

// --------------------------------------------------
// Знаки
// --------------------------------------------------

const signs = [
  "овен",
  "телец",
  "близнецы",
  "рак",
  "лев",
  "дева",
  "весы",
  "скорпион",
  "стрелец",
  "козерог",
  "водолей",
  "рыбы"
];

// --------------------------------------------------
// Поиск ответа
// --------------------------------------------------

function findAnswer(message, knowledge) {

  const query = normalize(message);

  console.log("QUERY:", query);
  console.log("KNOWLEDGE:", knowledge);

  const planet = planets.find(
    p => query.includes(p)
  );

  const sign = signs.find(
    s => query.includes(s)
  );

  console.log("PLANET:", planet);
  console.log("SIGN:", sign);

  // -----------------------------------------------
  // Точное совпадение планета + знак
  // -----------------------------------------------

  if (planet && sign) {

    const item = knowledge.find(entry => {

      const entryPlanet = normalize(
        entry.planet || ""
      );

      const entrySign = normalize(
        entry.sign || ""
      );

      return (
        entryPlanet === planet &&
        entrySign === sign
      );

    });

    if (item) {

      console.log("НАЙДЕНА ЗАПИСЬ:", item);

      return item;
    }
  }

  // -----------------------------------------------
  // Поиск по тексту
  // -----------------------------------------------

  const item = knowledge.find(entry => {

    const text = normalize(
      `${entry.key || ""} ${entry.planet || ""} ${entry.sign || ""}`
    );

    return text.includes(query);

  });

  return item || null;
}

// --------------------------------------------------
// Подстановка имени
// --------------------------------------------------

function replaceVariables(text, profile = {}) {

  if (!text) {
    return "";
  }

  return String(text).replace(
    /\{([^}]+)\}/g,
    (match, variable) => {

      if (
        profile[variable] !== undefined
      ) {
        return profile[variable];
      }

      return match;

    }
  );
}

// --------------------------------------------------
// HTTP
// --------------------------------------------------

export default async function handler(req) {

  // OPTIONS

  if (req.method === "OPTIONS") {

    return new Response(
      JSON.stringify({}),
      {
        status: 204,
        headers
      }
    );

  }

  // GET

  if (req.method === "GET") {

    const knowledge = loadKnowledge();

    return new Response(
      JSON.stringify({
        ok: true,
        ai: false,
        knowledgeItems: knowledge.length
      }),
      {
        status: 200,
        headers
      }
    );

  }

  // POST

  if (req.method !== "POST") {

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed"
      }),
      {
        status: 405,
        headers
      }
    );

  }

  try {

    const body = await req.json();

    console.log("BODY:", body);

    const message = String(
      body.message ||
      body.text ||
      body.query ||
      ""
    ).trim();

    if (!message) {

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Пустое сообщение"
        }),
        {
          status: 400,
          headers
        }
      );

    }

    const knowledge = loadKnowledge();

    const result = findAnswer(
      message,
      knowledge
    );

    // ---------------------------------------------
    // Ответ найден
    // ---------------------------------------------

    if (result) {

      const answer =
        result.answer ||
        result.content ||
        result.text ||
        "";

      const finalAnswer =
        replaceVariables(
          answer,
          body.profile || {}
        );

      return new Response(
        JSON.stringify({
          ok: true,
          ai: false,
          found: true,
          reply: finalAnswer,
          answer: finalAnswer,
          data: result
        }),
        {
          status: 200,
          headers
        }
      );

    }

    // ---------------------------------------------
    // Ответ НЕ найден
    // ---------------------------------------------

    return new Response(
      JSON.stringify({
        ok: true,
        ai: false,
        found: false,
        reply:
          "Я не нашла эту трактовку в базе знаний."
      }),
      {
        status: 200,
        headers
      }
    );

  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message
      }),
      {
        status: 500,
        headers
      }
    );

  }

}
