import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// НАСТРОЙКИ
// ======================================================

const KNOWLEDGE_PATH = path.join(
  __dirname,
  "../../knowledge/knowledge.json"
);

// ======================================================
// CORS
// ======================================================

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

// ======================================================
// ОТВЕТ
// ======================================================

function response(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers
  });
}

// ======================================================
// НОРМАЛИЗАЦИЯ
// ======================================================

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// ЗАГРУЗКА БАЗЫ
// ======================================================

function loadKnowledge() {
  try {
    if (!fs.existsSync(KNOWLEDGE_PATH)) {
      console.log("База не найдена:", KNOWLEDGE_PATH);
      return [];
    }

    const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf8");

    if (!raw.trim()) {
      console.log("База пустая");
      return [];
    }

    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.entries)) {
      return data.entries;
    }

    if (Array.isArray(data.knowledge)) {
      return data.knowledge;
    }

    return [];
  } catch (error) {
    console.error("Ошибка загрузки базы:", error);
    return [];
  }
}

// ======================================================
// РАСПОЗНАВАНИЕ ПЛАНЕТЫ
// ======================================================

const planets = {
  "луна": "Луна",
  "солнце": "Солнце",
  "марс": "Марс",
  "меркурий": "Меркурий",
  "венера": "Венера",
  "юпитер": "Юпитер",
  "сатурн": "Сатурн",
  "узлы": "Узлы",
  "северный узел": "Узлы",
  "южный узел": "Узлы"
};

// ======================================================
// РАСПОЗНАВАНИЕ ЗНАКА
// ======================================================

const signs = {
  "овен": "Овен",
  "телец": "Телец",
  "близнецы": "Близнецы",
  "рак": "Рак",
  "лев": "Лев",
  "дева": "Дева",
  "весы": "Весы",
  "скорпион": "Скорпион",
  "стрелец": "Стрелец",
  "козерог": "Козерог",
  "водолей": "Водолей",
  "рыбы": "Рыбы"
};

// ======================================================
// РАСПОЗНАВАНИЕ ДОМА
// ======================================================

function getHouse(text) {
  const match = text.match(
    /(?:дом|доме|дома)\s*(\d{1,2})/i
  );

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

// ======================================================
// ПОИСК ПЛАНЕТЫ
// ======================================================

function getPlanet(text) {
  const normalized = normalize(text);

  for (const key of Object.keys(planets)) {
    if (normalized.includes(key)) {
      return planets[key];
    }
  }

  return null;
}

// ======================================================
// ПОИСК ЗНАКА
// ======================================================

function getSign(text) {
  const normalized = normalize(text);

  for (const key of Object.keys(signs)) {
    if (normalized.includes(key)) {
      return signs[key];
    }
  }

  return null;
}

// ======================================================
// ПОИСК ПО БАЗЕ
// ======================================================

function findAnswer(message, knowledge) {
  const normalized = normalize(message);

  const planet = getPlanet(message);
  const sign = getSign(message);
  const house = getHouse(normalized);

  console.log("Запрос:", message);
  console.log("Планета:", planet);
  console.log("Знак:", sign);
  console.log("Дом:", house);
  console.log("Записей в базе:", knowledge.length);

  // --------------------------------------------------
  // Сначала ищем максимально точное совпадение
  // --------------------------------------------------

  if (planet && sign && house) {
    const exact = knowledge.find(item => {
      const itemPlanet = normalize(item.planet || "");
      const itemSign = normalize(item.sign || "");
      const itemHouse = Number(item.house);

      return (
        itemPlanet === normalize(planet) &&
        itemSign === normalize(sign) &&
        itemHouse === house
      );
    });

    if (exact) {
      return exact;
    }
  }

  // --------------------------------------------------
  // Планета + знак
  // --------------------------------------------------

  if (planet && sign) {
    const exact = knowledge.find(item => {
      const itemPlanet = normalize(item.planet || "");
      const itemSign = normalize(item.sign || "");

      return (
        itemPlanet === normalize(planet) &&
        itemSign === normalize(sign)
      );
    });

    if (exact) {
      return exact;
    }
  }

  // --------------------------------------------------
  // Планета + дом
  // --------------------------------------------------

  if (planet && house) {
    const exact = knowledge.find(item => {
      const itemPlanet = normalize(item.planet || "");
      const itemHouse = Number(item.house);

      return (
        itemPlanet === normalize(planet) &&
        itemHouse === house
      );
    });

    if (exact) {
      return exact;
    }
  }

  // --------------------------------------------------
  // Ищем по question/title/key
  // --------------------------------------------------

  const candidates = knowledge.filter(item => {
    const text = normalize(
      [
        item.question,
        item.title,
        item.key,
        item.name,
        item.tags,
        item.planet,
        item.sign,
        item.house
      ]
        .filter(Boolean)
        .join(" ")
    );

    return text.includes(normalized);
  });

  if (candidates.length > 0) {
    return candidates[0];
  }

  // --------------------------------------------------
  // Более мягкий поиск
  // --------------------------------------------------

  const words = normalized
    .split(" ")
    .filter(word => word.length > 2);

  let bestItem = null;
  let bestScore = 0;

  for (const item of knowledge) {
    const text = normalize(
      [
        item.question,
        item.title,
        item.key,
        item.name,
        item.tags,
        item.planet,
        item.sign,
        item.house,
        item.answer,
        item.content,
        item.text
      ]
        .filter(Boolean)
        .join(" ")
    );

    let score = 0;

    for (const word of words) {
      if (text.includes(word)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestItem && bestScore > 0) {
    return bestItem;
  }

  return null;
}

// ======================================================
// ПОДСТАНОВКА ПЕРЕМЕННЫХ
// ======================================================

function replaceVariables(text, profile = {}) {
  if (!text) {
    return "";
  }

  return String(text).replace(
    /\{([^}]+)\}/g,
    (match, variable) => {
      return profile[variable] !== undefined
        ? profile[variable]
        : match;
    }
  );
}

// ======================================================
// ОСНОВНОЙ HANDLER
// ======================================================

export default async function handler(req) {

  // OPTIONS
  if (req.method === "OPTIONS") {
    return response({}, 204);
  }

  // GET
  if (req.method === "GET") {
    const knowledge = loadKnowledge();

    return response({
      ok: true,
      ai: false,
      service: "ANN",
      knowledgeItems: knowledge.length,
      message: "ANN работает без AI"
    });
  }

  // Только POST
  if (req.method !== "POST") {
    return response(
      {
        ok: false,
        error: "Метод не поддерживается"
      },
      405
    );
  }

  try {

    // --------------------------------------------------
    // Получаем тело запроса
    // --------------------------------------------------

    const body = await req.json();

    const message = String(
      body.message ||
      body.text ||
      body.query ||
      ""
    ).trim();

    if (!message) {
      return response(
        {
          ok: false,
          error: "Пустое сообщение"
        },
        400
      );
    }

    // --------------------------------------------------
    // Загружаем базу
    // --------------------------------------------------

    const knowledge = loadKnowledge();

    // --------------------------------------------------
    // Профиль пользователя
    // --------------------------------------------------

    const profile = body.profile || {};

    // --------------------------------------------------
    // Ищем ответ
    // --------------------------------------------------

    const result = findAnswer(
      message,
      knowledge
    );

    // --------------------------------------------------
    // Нашли
    // --------------------------------------------------

    if (result) {

      const answer =
        result.answer ||
        result.content ||
        result.text ||
        result.description ||
        result.value ||
        "";

      return response({
        ok: true,
        ai: false,
        found: true,
        reply: replaceVariables(
          answer,
          profile
        ),
        data: result
      });
    }

    // --------------------------------------------------
    // Не нашли
    // --------------------------------------------------

    return response({
      ok: true,
      ai: false,
      found: false,
      reply:
        "Я пока не нашла готовую трактовку для этого запроса в базе знаний. Попробуй указать планету и знак, например: «Луна в Тельце»."
    });

  } catch (error) {

    console.error(
      "Ошибка ANN:",
      error
    );

    return response(
      {
        ok: false,
        error: "Ошибка обработки запроса",
        details: error.message
      },
      500
    );
  }
}
