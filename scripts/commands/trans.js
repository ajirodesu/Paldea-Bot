/**
 * Translation command module
 * Translates text using Google Translate API with language quick-select buttons
 */

import axios from "axios";

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const meta = {
  name: "trans",
  aliases: ["translate", "tr"],
  version: "1.0.0",
  author: "johnlester-0369 ( converted to paldea )",
  description: "Translate text to another language using Google Translate",
  prefix: "both",
  guide: ["<text>", "<text> | <lang>", "| <lang> (reply to a message)"],
  cooldown: 3,
  type: "anyone",
  category: "utility"
};

// ─── Language Maps ────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = {
  af: "Afrikaans", sq: "Albanian", ar: "Arabic", hy: "Armenian",
  az: "Azerbaijani", eu: "Basque", be: "Belarusian", bn: "Bengali",
  bs: "Bosnian", bg: "Bulgarian", ca: "Catalan", ceb: "Cebuano",
  zh: "Chinese (Simplified)", "zh-cn": "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)", hr: "Croatian", cs: "Czech",
  da: "Danish", nl: "Dutch", en: "English", eo: "Esperanto",
  et: "Estonian", fil: "Filipino", fi: "Finnish", fr: "French",
  gl: "Galician", ka: "Georgian", de: "German", el: "Greek",
  gu: "Gujarati", ht: "Haitian Creole", ha: "Hausa", he: "Hebrew",
  hi: "Hindi", hmn: "Hmong", hu: "Hungarian", is: "Icelandic",
  ig: "Igbo", id: "Indonesian", ga: "Irish", it: "Italian",
  ja: "Japanese", jv: "Javanese", kn: "Kannada", kk: "Kazakh",
  km: "Khmer", ko: "Korean", lo: "Lao", la: "Latin", lv: "Latvian",
  lt: "Lithuanian", mk: "Macedonian", mg: "Malagasy", ms: "Malay",
  ml: "Malayalam", mt: "Maltese", mi: "Maori", mr: "Marathi",
  mn: "Mongolian", my: "Myanmar (Burmese)", ne: "Nepali", no: "Norwegian",
  ny: "Nyanja (Chichewa)", or: "Odia (Oriya)", ps: "Pashto",
  fa: "Persian", pl: "Polish", pt: "Portuguese", pa: "Punjabi",
  ro: "Romanian", ru: "Russian", sm: "Samoan", gd: "Scots Gaelic",
  sr: "Serbian", st: "Sesotho", sn: "Shona", sd: "Sindhi",
  si: "Sinhala (Sinhalese)", sk: "Slovak", sl: "Slovenian", so: "Somali",
  es: "Spanish", su: "Sundanese", sw: "Swahili", sv: "Swedish",
  tl: "Tagalog (Filipino)", tg: "Tajik", ta: "Tamil", tt: "Tatar",
  te: "Telugu", th: "Thai", tr: "Turkish", tk: "Turkmen",
  uk: "Ukrainian", ur: "Urdu", ug: "Uyghur", uz: "Uzbek",
  vi: "Vietnamese", cy: "Welsh", xh: "Xhosa", yi: "Yiddish",
  yo: "Yoruba", zu: "Zulu",
};

const POPULAR_LANGUAGES = [
  { code: "en", flag: "🇬🇧" }, { code: "ko", flag: "🇰🇷" },
  { code: "ja", flag: "🇯🇵" }, { code: "zh", flag: "🇨🇳" },
  { code: "es", flag: "🇪🇸" }, { code: "fr", flag: "🇫🇷" },
  { code: "de", flag: "🇩🇪" }, { code: "ru", flag: "🇷🇺" },
  { code: "ar", flag: "🇸🇦" }, { code: "hi", flag: "🇮🇳" },
  { code: "pt", flag: "🇵🇹" }, { code: "vi", flag: "🇻🇳" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidLanguage(code) {
  return code.toLowerCase() in SUPPORTED_LANGUAGES;
}

function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code.toLowerCase()] || code.toUpperCase();
}

/**
 * Parse args array into { text, targetLang }
 * Supports: "hello world | ko"  or  "hello world"  or  "| ko" (reply mode)
 */
function parseTransArgs(argsArray) {
  const raw = argsArray.join(" ").trim();
  const pipeIdx = raw.lastIndexOf("|");
  if (pipeIdx !== -1) {
    const text = raw.slice(0, pipeIdx).trim() || null;
    const lang = raw.slice(pipeIdx + 1).trim();
    return { text, targetLang: lang || "en" };
  }
  return { text: raw || null, targetLang: "en" };
}

/**
 * Translate text via Google Translate free endpoint.
 * Returns { translatedText, detectedLang }
 */
async function translateText(text, targetLang, sourceLang = "auto") {
  const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
    params: { client: "gtx", sl: sourceLang, tl: targetLang.toLowerCase(), dt: "t", q: text },
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  const data = res.data;
  if (!data || !Array.isArray(data) || !data[0]) {
    throw new Error("Invalid response from translation service");
  }

  let translatedText = "";
  for (const segment of data[0]) {
    if (segment && segment[0]) translatedText += segment[0];
  }

  return { translatedText, detectedLang: data[2] || sourceLang };
}

/**
 * Build inline keyboard for language picker.
 * Encodes full { command, args } payload that handleCallback.js expects.
 * args[0] = text to translate, args[1] = target lang
 */
function buildLangKeyboard(text) {
  const rows = [];
  for (let i = 0; i < POPULAR_LANGUAGES.length; i += 3) {
    const row = POPULAR_LANGUAGES.slice(i, i + 3).map(lang => ({
      text: `${lang.flag} ${lang.code.toUpperCase()}`,
      callback_data: JSON.stringify({ command: "trans", args: [text, lang.code] }),
    }));
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

/**
 * Build quick re-translate keyboard attached to result message.
 * args[0] = translated text (to re-translate into another lang), args[1] = target lang
 */
function buildQuickLangKeyboard(translatedText) {
  const t = translatedText.length > 80 ? translatedText.substring(0, 80) : translatedText;
  return {
    inline_keyboard: [[
      { text: "🇬🇧 EN", callback_data: JSON.stringify({ command: "trans", args: [t, "en"] }) },
      { text: "🇰🇷 KO", callback_data: JSON.stringify({ command: "trans", args: [t, "ko"] }) },
      { text: "🇯🇵 JA", callback_data: JSON.stringify({ command: "trans", args: [t, "ja"] }) },
      { text: "🇨🇳 ZH", callback_data: JSON.stringify({ command: "trans", args: [t, "zh"] }) },
    ]],
  };
}

function formatResult(translatedText, detectedLang, targetLang) {
  return [
    `🌐 *Translation*`,
    ``,
    `📝 ${translatedText}`,
    ``,
    `_${getLanguageName(detectedLang)} → ${getLanguageName(targetLang)}_`,
  ].join("\n");
}

// ─── onStart ──────────────────────────────────────────────────────────────────

export async function onStart({ bot, response, msg, args, usage }) {
  const { text: parsedText, targetLang } = parseTransArgs(args);

  // Resolve text: command args → replied message
  let textToTranslate = parsedText;
  if (!textToTranslate && msg.reply_to_message) {
    textToTranslate = msg.reply_to_message.text || msg.reply_to_message.caption || null;
  }

  // No text → show usage guide
  if (!textToTranslate) {
    return usage();
  }

  // Text length guard
  if (textToTranslate.length > 5000) {
    return response.reply(
      `⚠️ Text is too long. Maximum is *5000* characters.\nYour text: ${textToTranslate.length} characters.`
    );
  }

  // Text provided but no explicit lang pipe → show language picker
  const rawInput = args.join(" ").trim();
  const hasPipe = rawInput.includes("|");

  if (!hasPipe) {
    const truncated = textToTranslate.length > 50
      ? `${textToTranslate.substring(0, 50)}...`
      : textToTranslate;
    const storedText = textToTranslate.length > 80 ? textToTranslate.substring(0, 80) : textToTranslate;
    return response.reply(
      `🌐 *Select Target Language*\n\n📝 Text: "${truncated}"\n\n_Choose a language to translate to:_`,
      { reply_markup: buildLangKeyboard(storedText) }
    );
  }

  // Validate lang code
  if (!isValidLanguage(targetLang)) {
    return response.reply(
      `⚠️ Unknown language code: *${targetLang}*\n\nCommon codes: en, ko, ja, zh, vi, fr, de, es, ru, ar, hi, th, fil`
    );
  }

  // Show status indicator only for longer texts
  let statusMsg = null;
  if (textToTranslate.length > 200) {
    statusMsg = await response.reply("🔄 Translating...");
  }

  try {
    const { translatedText, detectedLang } = await translateText(textToTranslate, targetLang);

    if (statusMsg) {
      try { await response.delete(statusMsg); } catch { /* ignore */ }
    }

    await response.reply(
      formatResult(translatedText, detectedLang, targetLang),
      { reply_markup: buildQuickLangKeyboard(translatedText) }
    );

  } catch (error) {
    console.error("[trans] Error:", error);

    if (statusMsg) {
      try { await response.delete(statusMsg); } catch { /* ignore */ }
    }

    let errorMessage = "❌ An error occurred while translating.";
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      errorMessage = "⚠️ Translation request timed out. Please try again later.";
    } else if (error.response?.status === 429) {
      errorMessage = "⚠️ Too many translation requests. Please wait a moment and try again.";
    } else if (error.response?.status >= 500) {
      errorMessage = "⚠️ Translation service is temporarily unavailable. Please try again later.";
    } else if (error.message?.includes("Invalid response")) {
      errorMessage = "⚠️ Could not parse translation response. Please try again.";
    }

    await response.reply(errorMessage);
  }
}

// ─── onCallback ───────────────────────────────────────────────────────────────
// Called by handleCallback.js when a button press resolves to this command.
// args[0] = text to translate
// args[1] = target language code

export async function onCallback({ bot, callbackQuery, chatId, messageId, args, response }) {
  const [textToTranslate, targetLang] = args;

  if (!textToTranslate || !targetLang) {
    return response.answerCallback(callbackQuery, {
      text: "⚠️ Missing text or language.",
      show_alert: true,
    });
  }

  if (!isValidLanguage(targetLang)) {
    return response.answerCallback(callbackQuery, {
      text: `⚠️ Unknown language: ${targetLang}`,
      show_alert: true,
    });
  }

  // Acknowledge the button press immediately
  await response.answerCallback(callbackQuery, { text: "🔄 Translating..." });

  // Show progress in the picker/result message
  try {
    await response.edit("text", messageId, "🔄 Translating...");
  } catch { /* message may already be gone */ }

  try {
    const { translatedText, detectedLang } = await translateText(textToTranslate, targetLang);

    await response.edit(
      "text",
      messageId,
      formatResult(translatedText, detectedLang, targetLang),
      { reply_markup: buildQuickLangKeyboard(translatedText) }
    );

  } catch (error) {
    console.error("[trans] onCallback error:", error);
    try {
      await response.edit("text", messageId, "❌ Translation failed. Please try again.");
    } catch {
      // answerCallback popup was already shown above
    }
  }
}