import axios from "axios";

// --- Configuration ---
const TIMEOUT = 10000;
const API_URL = "https://opentdb.com/api.php?amount=1&type=multiple";

// --- State Management ---
// In-memory cache for active quizzes
const quizCache = new Map();

// --- Helpers ---

/**
 * Decodes HTML entities commonly found in OpenTDB responses.
 */
const decodeHtml = (str) => {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/g, "é")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”");
};

/**
 * Shuffles an array (Fisher-Yates).
 */
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Fetches a quiz question.
 */
async function fetchQuiz() {
  try {
    const { data } = await axios.get(API_URL, { 
      timeout: TIMEOUT,
      headers: { Accept: "application/json" }
    });
    return data?.results?.[0] || null;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Quiz Command
 * Fetches a random trivia question from OpenTDB.
 */
export const meta = {
  name: "quiz",
  version: "1.2.0",
  aliases: ["trivia", "question", "test"],
  description: "Get a random trivia question.",
  author: "AjiroDesu",
  prefix: "both",
  category: "random",
  type: "anyone",
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply("🧠 **Fetching a question...**");

  try {
    const data = await fetchQuiz();
    if (!data) throw new Error("No data received from API");

    // Process Data
    const question = decodeHtml(data.question);
    const correct = decodeHtml(data.correct_answer);
    const incorrect = data.incorrect_answers.map(decodeHtml);

    // Shuffle options
    const options = shuffle([correct, ...incorrect]);

    // Generate Session ID
    const quizId = Math.random().toString(36).substring(2, 10);

    // Cache Data
    quizCache.set(quizId, { correct, options });

    // Build Keyboard
    // We use a short JSON format to fit within Telegram's 64-byte limit
    const buttons = options.map((opt, index) => ([{
      text: opt,
      callback_data: JSON.stringify({ 
        command: "quiz", 
        id: quizId, 
        a: index // Answer Index
      })
    }]));

    const message = 
      `🎯 **Quiz Time**\n\n` +
      `❓ **Question:**\n_${question}_\n\n` +
      `👇 Select the correct answer below:`;

    await response.edit('text', loading, message, {
      reply_markup: { inline_keyboard: buttons }
    });

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // 1. Validate Payload & Session
  // payload.id = quizId, payload.a = answer index
  if (!payload.id || payload.a === undefined) return;

  const quizData = quizCache.get(payload.id);

  if (!quizData) {
    return response.answerCallback(callbackQuery, { 
      text: "⚠️ Quiz expired or invalid.", 
      show_alert: true 
    });
  }

  try {
    const chosen = quizData.options[payload.a];
    const isCorrect = chosen === quizData.correct;

    const emoji = isCorrect ? "✅" : "❌";
    const statusText = isCorrect ? "Correct!" : "Wrong!";

    const feedbackMsg = isCorrect
      ? `🎉 **Correct!**\nThe answer is **${quizData.correct}**.`
      : `😢 **Wrong!**\nYou chose: _${chosen}_\nThe correct answer was: **${quizData.correct}**`;

    const finalMessage = `${emoji} ${feedbackMsg}`;

    // 2. Update Message (Remove buttons, show result)
    await response.edit('text', message, finalMessage);

    // 3. Answer Toast
    await response.answerCallback(callbackQuery, { text: statusText });

    // 4. Cleanup
    quizCache.delete(payload.id);

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: "⚠️ Error processing answer." });
  }
}