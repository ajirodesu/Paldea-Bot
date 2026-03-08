/**
 * Prefix Command
 * Displays current prefix/subprefix settings and allows developers to change them.
 * Changes are persisted to settings.json and survive bot restarts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.resolve(__dirname, '../../json/settings.json');

export const meta = {
  name: 'prefix',
  version: '1.2.0',
  aliases: ['setprefix', 'pref'],
  description: 'View or change the bot prefix. Developer-only modification.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'utility',
  type: 'anyone',
  cooldown: 3,
  guide: ['[new_prefix]']
};

export async function onStart({ msg, response, args }) {
  try {
    const senderId    = String(msg.from?.id);
    const isDeveloper = global.paldea.settings.developers.map(String).includes(senderId);
    const prefix      = global.paldea.settings.prefix;
    const subprefixes = global.paldea.settings.subprefix;

    // No args → show current settings
    if (!args || args.length === 0) {
      return await response.reply(buildDisplay(prefix, subprefixes));
    }

    const newPrefix = args[0].trim();

    // Not a developer
    if (!isDeveloper) {
      return await response.reply(
        `⛔ Access Restricted\n\n` +
        `Only developers are allowed to change the prefix.\n\n` +
        `Current prefix — \`${prefix}\``
      );
    }

    // Must be special characters only
    if (!/^[^a-zA-Z0-9\s]+$/.test(newPrefix)) {
      return await response.reply(
        `⚠️ Invalid Prefix\n\n` +
        `The prefix must only contain special characters.\n\n` +
        `Allowed   \`!\` \`/\` \`$\` \`>>\` \`%%\` \`~\`\n` +
        `You used  \`${newPrefix}\``
      );
    }

    // Apply to runtime
    global.paldea.settings.prefix = newPrefix;

    // Persist to settings.json
    const raw      = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(raw);
    settings.prefix = newPrefix;
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');

    return await response.reply(
      `✅ Prefix Changed\n\n` +
      buildDisplay(newPrefix, subprefixes)
    );

  } catch (err) {
    console.error('[PREFIX] Error:', err);
    await response.reply(`⚠️ Something went wrong.\n\n\`${err.message}\``);
  }
}

function buildDisplay(prefix, subprefixes) {
  const subs = subprefixes.map(s => `\`${s}\``).join('  ');

  return (
    `⚙️ Prefix Settings\n\n` +
    `Prefix      \`${prefix}\`\n` +
    `Subprefix   ${subs}\n\n` +
    `_To change the prefix, run:_\n` +
    `\`${prefix}prefix <new_prefix>\``
  );
}