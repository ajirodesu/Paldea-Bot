/**
 * Command Module Manager
 * Allows Developers to Install, Load, Unload, Reload, and Delete commands dynamically.
 */

import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { pathToFileURL, fileURLToPath } from 'url';

// Helper for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths relative to this file (apps/scripts/commands/system/cmd.js)
// We go up one level to reach 'apps/scripts/commands'
const COMMANDS_DIR = path.resolve(__dirname, '..'); 
// We go up four levels to reach root, then into 'utility/scripts.js'
const SCRIPTS_PATH = path.resolve(__dirname, '../../../../core/utility/scripts.js');

export const meta = {
  name: 'cmd',
  version: '1.2.1',
  aliases: ['command', 'module', 'load'],
  description: 'Manage bot commands (Install, Load, Delete, Reload).',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'developer',
  type: 'developer', // STRICTLY DEVELOPER
  cooldown: 0,
  guide: [
    ' install <filename.js> <url>: Install new command',
    ' load <command>: Reload a command',
    ' unload <command>: Unload a command',
    ' delete <command>: Permanently delete a command file',
    ' loadall: Reload all commands',
    ' unloadall: Clear all commands'
  ]
};

// --- Helper: Single File Loader ---
async function loadCommandFile(filePath) {
  try {
    // Cache Busting: Append timestamp to force Node to re-import the module
    const modulePath = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
    const imported = await import(modulePath);

    // Normalize Structure
    let content = {};
    if (imported.meta) {
      content = { ...imported.meta };
      content.meta = imported.meta;
      ['onStart', 'onChat', 'onReply', 'onEvent', 'onCallback'].forEach(fn => {
        if (imported[fn]) content[fn] = imported[fn];
      });
    } else {
      content = imported.default || imported;
    }

    // Validation
    const requiredKeys = ['name', 'description', 'onStart'];
    const missing = requiredKeys.find(key => {
        if (key.startsWith('on')) return typeof content[key] !== 'function';
        return typeof content[key] !== 'string';
    });

    if (missing) throw new Error(`Invalid structure. Missing: ${missing}`);

    // Save to Map
    global.paldea.commands.set(content.name, content);
    return content.name;

  } catch (err) {
    throw new Error(`Import failed: ${err.message}`);
  }
}

// --- Helper: Find File Path by Command Name ---
function findCommandFile(commandName) {
  const files = getAllFiles(COMMANDS_DIR);
  for (const file of files) {
    // Check if filename contains command name (Simple heuristic)
    if (path.basename(file).toLowerCase().includes(commandName.toLowerCase())) {
        return file;
    }
  }
  return null;
}

// Recursively get files
const getAllFiles = (dir) => {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) results = results.concat(getAllFiles(fullPath));
      else if (file.endsWith('.js')) results.push(fullPath);
    });
  } catch (err) { return []; }
  return results;
};

export async function onStart({ args, response, usage }) {
  const action = args[0]?.toLowerCase();
  const target = args[1]; // Filename or Command Name
  const url = args[2];    // For install

  // --- 1. INSTALL ---
  if (action === 'install') {
    if (!target || !url) return response.reply("⚠️ **Usage:** `/cmd install <filename.js> <raw_url>`");
    if (!target.endsWith('.js')) return response.reply("⚠️ Filename must end with `.js`");

    try {
      const sent = await response.reply(`📥 **Downloading** \`${target}\`...`);

      const { data } = await axios.get(url, { responseType: 'text' });

      // Determine save path
      const savePath = path.join(COMMANDS_DIR, target); 

      await fs.outputFile(savePath, data);

      const loadedName = await loadCommandFile(savePath);
      return response.edit('text', sent, `✅ **Installed & Loaded:** \`${loadedName}\``);
    } catch (err) {
      return response.reply(`❌ **Install Failed:**\n\`${err.message}\``);
    }
  }

  // --- 2. LOAD (Reload) ---
  if (action === 'load') {
    if (!target) return response.reply("⚠️ Provide a command name to load.");

    const filePath = findCommandFile(target);
    if (!filePath) return response.reply(`❌ Could not locate file for \`${target}\`.`);

    try {
      const name = await loadCommandFile(filePath);
      return response.reply(`🔄 **Reloaded:** \`${name}\``);
    } catch (err) {
      return response.reply(`❌ **Load Failed:**\n\`${err.message}\``);
    }
  }

  // --- 3. UNLOAD ---
  if (action === 'unload') {
    if (!target) return response.reply("⚠️ Provide a command name to unload.");

    if (global.paldea.commands.has(target)) {
      global.paldea.commands.delete(target);
      return response.reply(`🗑️ **Unloaded:** \`${target}\``);
    }
    return response.reply(`ℹ️ Command \`${target}\` is not loaded.`);
  }

  // --- 4. DELETE (File Removal) ---
  if (['delete', 'del', 'remove', 'rm'].includes(action)) {
    if (!target) return response.reply("⚠️ Provide a command name or filename to delete.");

    const filePath = findCommandFile(target);
    if (!filePath) return response.reply(`❌ File not found for \`${target}\`.`);

    try {
      // Unload from memory if active
      if (global.paldea.commands.has(target)) {
        global.paldea.commands.delete(target);
      }

      // Delete file
      await fs.remove(filePath);

      return response.reply(
        `🗑️ **Deleted Permanently**\n` +
        `File: \`${path.basename(filePath)}\`\n` +
        `Module unloaded and file removed from disk.`
      );
    } catch (e) {
      return response.reply(`❌ **Delete Failed:**\n\`${e.message}\``);
    }
  }

  // --- 5. LOAD ALL ---
  if (action === 'loadall') {
    try {
      const sent = await response.reply("🔄 **Reloading System...**");

      // Dynamic Import of Scripts Utility using resolved path
      const scriptsModule = await import(pathToFileURL(SCRIPTS_PATH).href);
      const scripts = scriptsModule.default;

      global.paldea.commands.clear();
      await scripts.loadCommands(); // Rescan and load

      return response.edit('text', sent, `✅ **System Reloaded**\nCommands: ${global.paldea.commands.size}`);
    } catch (e) {
      return response.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- 6. UNLOAD ALL ---
  if (action === 'unloadall') {
    const size = global.paldea.commands.size;
    global.paldea.commands.clear();
    return response.reply(`🗑️ **Unloaded All** (${size} commands).`);
  }

  return usage();
}