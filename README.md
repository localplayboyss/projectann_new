# ANN — Netlify, без AI

Версия проекта для запуска без API-ключа. AI/OpenAI не используется.

## Netlify
- Build command: пусто
- Publish directory: `.`
- Functions directory: `netlify/functions`

Функция: `/.netlify/functions/chat`

## База знаний
Сейчас в `knowledge/knowledge.json` лежит тестовая база. Замените её объединённой базой ANN.

Формат записи:
```json
{
  "key": "sun_aries",
  "planet": "Солнце",
  "sign": "Овен",
  "house": 1,
  "answer": "Текст трактовки"
}
```

API-ключ не нужен.
