/**
 * Say command module
 * Converts text to speech using Google TTS with language quick-select buttons
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const meta = {
  name: "say",
  aliases: ["tts"],
  version: "1.0.0",
  author: "johnlester-0369 converted",
  description: "Convert text to speech using Google TTS",
  prefix: "both",
  guide: ["<text>", "<text> | <lang>", "| <lang> (reply to a message)"],
  cooldown: 5,
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

const POPULAR_LANGS = [
  { code: "en", flag: "🇬🇧" }, { code: "ko", flag: "🇰🇷" },
  { code: "ja", flag: "🇯🇵" }, { code: "zh", flag: "🇨🇳" },
  { code: "es", flag: "🇪🇸" }, { code: "fr", flag: "🇫🇷" },
  { code: "de", flag: "🇩🇪" }, { code: "ru", flag: "🇷🇺" },
  { code: "pt", flag: "🇵🇹" },
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
function parseSayArgs(argsArray) {
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
 * Fetch TTS audio from Google Translate and return a Buffer
 */
async function generateTTSAudio(text, lang) {
  const res = await axios.get("https://translate.google.com/translate_tts", {
    params: { ie: "UTF-8", q: text, tl: lang.toLowerCase(), client: "tw-ob" },
    responseType: "arraybuffer",
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://translate.google.com/",
    },
  });
  if (!res.data || res.data.byteLength === 0) {
    throw new Error("Empty audio response from TTS service");
  }
  return Buffer.from(res.data);
}

/**
 * Build inline keyboard for language picker.
 * Encodes the full { command, args } payload that handleCallback.js expects.
 */
function buildLangKeyboard(text) {
  const rows = [];
  for (let i = 0; i < POPULAR_LANGS.length; i += 3) {
    const row = POPULAR_LANGS.slice(i, i + 3).map(lang => ({
      text: `${lang.flag} ${lang.code.toUpperCase()}`,
      callback_data: JSON.stringify({ command: "say", args: [text, lang.code] }),
    }));
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

/**
 * Build quick re-speak keyboard attached to the sent voice message.
 */
function buildQuickLangKeyboard(text) {
  return {
    inline_keyboard: [[
      { text: "🇬🇧", callback_data: JSON.stringify({ command: "say", args: [text, "en"] }) },
      { text: "🇰🇷", callback_data: JSON.stringify({ command: "say", args: [text, "ko"] }) },
      { text: "🇯🇵", callback_data: JSON.stringify({ command: "say", args: [text, "ja"] }) },
      { text: "🇨🇳", callback_data: JSON.stringify({ command: "say", args: [text, "zh"] }) },
      { text: "🇫🇷", callback_data: JSON.stringify({ command: "say", args: [text, "fr"] }) },
      { text: "🇪🇸", callback_data: JSON.stringify({ command: "say", args: [text, "es"] }) },
    ]],
  };
}

/**
 * Generate TTS, write to a temp file in __dirname/temp, send as voice, then clean up.
 */
async function sendTTSVoice(bot, chatId, replyToId, text, lang) {
  const audioBuffer = await generateTTSAudio(text, lang);

  const langName = getLanguageName(lang);
  const displayText = text.length > 80 ? `${text.substring(0, 80)}...` : text;
  const caption = `🔊 "${displayText}"\n_${langName}_`;

  // Use __dirname/temp so we stay within the command's own directory
  const tempDir = path.join(__dirname, "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
  fs.writeFileSync(tempFile, audioBuffer);

  try {
    await bot.sendVoice(chatId, fs.createReadStream(tempFile), {
      caption,
      parse_mode: "Markdown",
      ...(replyToId ? { reply_to_message_id: replyToId } : {}),
      reply_markup: buildQuickLangKeyboard(text.length > 80 ? text.substring(0, 80) : text),
    });
  } finally {
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
  }
}

// ─── onStart ──────────────────────────────────────────────────────────────────

export async function onStart({ bot, response, msg, args, usage }) {
  const { text: parsedText, targetLang } = parseSayArgs(args);

  // Resolve text: command args → replied message
  let textToSpeak = parsedText;
  if (!textToSpeak && msg.reply_to_message) {
    textToSpeak = msg.reply_to_message.text || msg.reply_to_message.caption || null;
  }

  // No text → show usage guide
  if (!textToSpeak) {
    return usage();
  }

  // Text length guard
  if (textToSpeak.length > 200) {
    return response.reply(
      `⚠️ Text is too long for speech. Maximum is *200* characters.\nYour text: ${textToSpeak.length} characters.\n\n💡 Try breaking it into smaller parts.`
    );
  }

  // Text provided but no explicit lang pipe → show language picker
  const rawInput = args.join(" ").trim();
  const hasPipe = rawInput.includes("|");

  if (!hasPipe) {
    const truncated = textToSpeak.length > 50
      ? `${textToSpeak.substring(0, 50)}...`
      : textToSpeak;
    // Store up to 80 chars in buttons (callback_data has a 64-byte limit per Telegram, JSON adds overhead)
    const storedText = textToSpeak.length > 80 ? textToSpeak.substring(0, 80) : textToSpeak;
    return response.reply(
      `🔊 *Select Voice Language*\n\n📝 Text: "${truncated}"\n\n_Choose a language for the voice:_`,
      { reply_markup: buildLangKeyboard(storedText) }
    );
  }

  // Validate lang code
  if (!isValidLanguage(targetLang)) {
    return response.reply(
      `⚠️ Unknown language code: *${targetLang}*\n\nCommon codes: en, ko, ja, zh, vi, fr, de, es, ru, ar, hi, th, fil`
    );
  }

  // Send generating indicator
  const statusMsg = await response.reply("🔄 Generating audio...");

  try {
    await sendTTSVoice(bot, msg.chat.id, msg.message_id, textToSpeak, targetLang);
  } catch (error) {
    console.error("[say] TTS error:", error);

    let errorMessage = "❌ An error occurred while generating speech.";
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      errorMessage = "⚠️ TTS request timed out. Please try again later.";
    } else if (error.response?.status === 429) {
      errorMessage = "⚠️ Too many TTS requests. Please wait a moment and try again.";
    } else if (error.response?.status === 403) {
      errorMessage = "⚠️ TTS service access denied. Please try again later.";
    } else if (error.response?.status >= 500) {
      errorMessage = "⚠️ TTS service is temporarily unavailable. Please try again later.";
    } else if (error.message?.includes("Empty audio")) {
      errorMessage = "⚠️ Could not generate audio for this text. Try different text or language.";
    }

    await response.reply(errorMessage);
  } finally {
    // Delete the "Generating audio..." status message regardless of outcome
    try { await response.delete(statusMsg); } catch { /* ignore */ }
  }
}

// ─── onCallback ───────────────────────────────────────────────────────────────
// Called by handleCallback.js when a button press resolves to this command.
// args[0] = text to speak
// args[1] = target language code

export async function onCallback({ bot, callbackQuery, chatId, messageId, args, response }) {
  const [textToSpeak, targetLang] = args;

  if (!textToSpeak || !targetLang) {
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
  await response.answerCallback(callbackQuery, { text: "🔄 Generating audio..." });

  // Show progress in the picker message
  try {
    await response.edit("text", messageId, "🔄 Generating audio...");
  } catch { /* picker message may already be gone */ }

  try {
    // Reply to the original user message if available, otherwise just send to chat
    const replyToId = callbackQuery.message?.reply_to_message?.message_id || null;

    await sendTTSVoice(bot, chatId, replyToId, textToSpeak, targetLang);

    // Clean up the picker / progress message
    try { await response.delete(messageId); } catch { /* ignore */ }

  } catch (error) {
    console.error("[say] onCallback TTS error:", error);
    try {
      await response.edit("text", messageId, "❌ Failed to generate audio. Please try again.");
    } catch {
      // If edit fails, the answerCallback popup was already shown above
    }
  }
}