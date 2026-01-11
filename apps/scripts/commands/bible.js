import axios from 'axios';

// --- Configuration ---
const API = {
  BIBLE: 'https://bible-api.com',
  RANDOM: 'https://labs.bible.org/api/?passage=random&type=json',
  GATEWAY: 'https://www.biblegateway.com/passage'
};

const TIMEOUT = 10000;

// --- Helpers ---

/**
 * Parses arguments to extract --version or -v flags.
 * Returns { text, version }
 */
function parseArgs(args) {
  let version = 'kjv';
  const cleanArgs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check --version=xyz
    if (arg.startsWith('--version=') || arg.startsWith('-v=')) {
      version = arg.split('=')[1];
      continue;
    }

    // Check -v xyz or --version xyz
    if ((arg === '--version' || arg === '-v') && args[i + 1]) {
      version = args[i + 1];
      i++; // Skip next arg
      continue;
    }

    cleanArgs.push(arg);
  }

  return { text: cleanArgs.join(' '), version };
}

/**
 * Fetches a random verse reference (e.g., "John 3:16").
 */
async function fetchRandomReference() {
  try {
    const { data } = await axios.get(API.RANDOM, { timeout: 8000 });
    // API returns array: [{bookname, chapter, verse, text}]
    if (Array.isArray(data) && data[0]) {
      const { bookname, chapter, verse } = data[0];
      return `${bookname} ${chapter}:${verse}`;
    }
  } catch (err) {
    // Silent fail
  }
  return null;
}

/**
 * Builds a keyboard with external link and translation switch.
 */
function createKeyboard(reference, version) {
  const encRef = encodeURIComponent(reference);
  const encVer = encodeURIComponent(version);

  // Suggest an alternative version (Flip between KJV and WEB usually)
  const altVer = version.toLowerCase() === 'kjv' ? 'WEB' : 'KJV';

  return {
    inline_keyboard: [
      [
        { text: '📖 Read on BibleGateway', url: `${API.GATEWAY}/?search=${encRef}&version=${encVer}` }
      ],
      [
        { 
          text: `🔄 Switch to ${altVer}`, 
          callback_data: JSON.stringify({ command: 'bible', ref: reference, v: altVer }) 
        }
      ]
    ]
  };
}

/**
 * Bible Command
 * Fetches scriptures from bible-api.com
 */
export const meta = {
  name: 'bible',
  version: '1.2.1',
  aliases: ['verse', 'scripture', 'gospel'],
  description: 'Fetch Bible passages or random verses.',
  author: 'AjiroDesu',
  category: 'random',
  type: 'anyone',
  cooldown: 3,
  guide: ['[passage]', '--version=<ver>'],
  prefix: 'both'
};

export async function onStart({ msg, args, response, usage }) {
  // 1. Parse Arguments
  let { text, version } = parseArgs(args);

  // 2. Handle Reply Context
  if (!text && msg.reply_to_message?.text) {
    text = msg.reply_to_message.text;
  }

  // 3. Handle Random Mode
  let isRandom = false;
  if (!text) {
    const randomRef = await fetchRandomReference();
    if (!randomRef) return usage(); // Fallback if random API fails
    text = randomRef;
    isRandom = true;
  }

  const loading = await response.reply(`📖 **Looking up:** ${text} (${version.toUpperCase()})...`);

  try {
    // 4. Call API
    // bible-api.com handles encoding
    const url = `${API.BIBLE}/${encodeURIComponent(text)}?translation=${encodeURIComponent(version)}`;
    const { data } = await axios.get(url, { timeout: TIMEOUT });

    // 5. Format Data
    const reference = data.reference || text;
    const translationName = data.translation_name || version.toUpperCase();

    let passageText = '';
    if (data.text) {
      passageText = data.text.trim();
    } else if (data.verses) {
      passageText = data.verses.map(v => `${v.verse}. ${v.text.trim()}`).join('\n');
    } else {
      passageText = 'No text found.';
    }

    const header = isRandom ? '🎯 **Random Verse**' : '📜 **Scripture**';

    // Removed separator line
    const message = `${header}\n` +
                    `**${reference}** — _${translationName}_\n\n` +
                    `${passageText}`;

    const limit = 3800; // Telegram limit margin

    // 6. Send Response
    if (message.length > limit) {
      // Send as file if too long
      const buffer = Buffer.from(`${reference} (${translationName})\n\n${passageText}`, 'utf-8');
      await response.upload('document', buffer, { 
        filename: `${reference.replace(/\s/g, '_')}.txt`,
        caption: `📄 **Passage too long**\nHere is **${reference}** as a file.`
      });
      await response.delete(loading);
    } else {
      // Send as text
      await response.edit('text', loading, message, {
        reply_markup: createKeyboard(reference, version)
      });
    }

  } catch (err) {
    const errorText = err.response?.data?.error || err.message;
    await response.edit('text', loading, `⚠️ **Error:** ${errorText}\n\nTry checking the spelling or the version.`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Validate Payload
  if (!payload.ref || !payload.v) return;

  try {
    const version = payload.v;
    const text = payload.ref;

    // Show loading toast
    await response.answerCallback(callbackQuery, { text: `Switching to ${version}...` });

    // Call API again
    const url = `${API.BIBLE}/${encodeURIComponent(text)}?translation=${encodeURIComponent(version)}`;
    const { data } = await axios.get(url, { timeout: TIMEOUT });

    const reference = data.reference || text;
    const translationName = data.translation_name || version.toUpperCase();

    let passageText = data.text ? data.text.trim() : 'No text.';
    if (!data.text && data.verses) {
      passageText = data.verses.map(v => `${v.verse}. ${v.text.trim()}`).join('\n');
    }

    // Removed separator line
    const newMessage = `📜 **Scripture**\n` +
                       `**${reference}** — _${translationName}_\n\n` +
                       `${passageText}`;

    // Edit the existing message
    await response.edit('text', message, newMessage, {
      reply_markup: createKeyboard(reference, version)
    });

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to switch version.', show_alert: true });
  }
}