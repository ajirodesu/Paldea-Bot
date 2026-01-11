/**
 * Password Generator Command
 * Generates strong passwords based on an optional base word.
 */
export const meta = {
  name: 'generatepass',
  version: '1.1.0',
  aliases: ['genpass', 'password'],
  description: 'Generate strong passwords.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'utility',
  type: 'anyone',
  cooldown: 3,
  guide: ['[base_word]']
};

// --- Helpers ---

const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  num: '0123456789',
  sym: '!@#$%^&*()_'
};

const MODIFICATIONS = { a: '@', e: '3', i: '!', o: '0', s: '$' };

/**
 * Modifies a character randomly based on common leetspeak.
 */
const modifyChar = (char) => {
  return (Math.random() < 0.3 && MODIFICATIONS[char]) ? MODIFICATIONS[char] : char;
};

/**
 * Generates random characters from the full charset.
 */
const getRandomChars = (length) => {
  const fullCharset = Object.values(CHARSETS).join('');
  let result = '';
  for (let i = 0; i < length; i++) {
    result += fullCharset[Math.floor(Math.random() * fullCharset.length)];
  }
  return result;
};

/**
 * Shuffles an array (Fisher-Yates).
 */
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join('');
};

/**
 * Core generation logic.
 */
const createPassword = (base = '', length = 12) => {
  // Process base word: lowercase, alphanumeric only, take first half of length
  const processed = base
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, Math.floor(length / 2))
    .split('')
    .map(modifyChar);

  // Fill remaining length
  const remaining = Math.max(0, length - processed.length);
  const randomPart = getRandomChars(remaining).split('');

  // Combine and shuffle
  return shuffle([...processed, ...randomPart]);
};

// --- Command ---

export async function onStart({ msg, args, response, usage }) {
  const baseWord = args.join(' ').trim();

  // 1. Usage Check
  if (!baseWord) {
    return response.reply(
      `💡 **Usage Guide**\n\n` +
      `Generates 6 strong passwords based on your input.\n\n` +
      `**Example:**\n` +
      `/generatepass banana`
    );
  }

  try {
    const passwords = [];
    for (let i = 0; i < 6; i++) {
      passwords.push(`${i + 1}. \`${createPassword(baseWord, 12)}\``);
    }

    const name = msg.from?.first_name || 'User';

    await response.reply(
      `🔐 **Generated Passwords for:** _${baseWord}_\n\n` +
      `${passwords.join('\n')}\n\n` +
      `_Click to copy on mobile._`
    );

  } catch (err) {
    console.error('[GenPass] Error:', err);
    await response.reply(`⚠️ **Error:** ${err.message}`);
  }
}