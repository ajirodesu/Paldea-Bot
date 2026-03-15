/**
 * @fileoverview Core Command Handler with Wataru AI
 * Powered by Official Groq API (llama-3.3-70b-versatile) – ultra-fast + JSON-guaranteed
 *
 * Improvements:
 *  - Wataru detects natural language intent and maps to closest command automatically
 *  - Robust JSON parsing with structured fallback
 *  - AI call deduplication / per-user rate limiting (no spam)
 *  - Full reply_to_message context extraction (text, photo, sticker, etc.)
 *  - Fuzzy command name matching as a safety net after AI picks a wrong name
 *  - Smart "did you mean?" suggestion on unknown prefixed commands
 *  - Cleaner code structure with clear separation of concerns
 */

import fetch from 'node-fetch';

/* ======================== CONSTANTS ======================== */

const SYMBOLS = {
  usage:       "▫️",
  error:       "❌",
  warning:     "⚠️",
  cooldown:    "⏳",
  guide:       "📄",
  unknown:     "❓",
  maintenance: "🚧",
  ai:          "🤖",
};

/** How many Wataru AI requests one user can make per minute. */
const WATARU_RATE_LIMIT   = 5;
const WATARU_RATE_WINDOW  = 60_000; // 1 minute in ms

/* ======================== SHARED STATE ======================== */

/** Per-user AI call timestamps for rate limiting. */
const wataruRateMap = new Map(); // userId → timestamp[]

/* ======================== GROQ AI CLIENT ======================== */

/**
 * Calls the Groq API and returns the raw string response.
 * Always requests `json_object` response format so output is valid JSON.
 */
const callAI = async (userText, systemPrompt) => {
  const { groqKey, groqModel } = global.paldea.settings;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model:           groqModel || "llama-3.3-70b-versatile",
      temperature:     0.2,
      max_tokens:      512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userText      },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
};

/* ======================== UTILITY HELPERS ======================== */

/**
 * Extracts a human-readable label from any Telegram message object.
 * Handles text, caption, sticker, photo, video, audio, document, voice, etc.
 */
const extractMessageContext = (replyMsg) => {
  if (!replyMsg) return null;

  const sender = [replyMsg.from?.first_name, replyMsg.from?.last_name]
    .filter(Boolean).join(" ") || "Unknown";

  let content = "[non-text content]";
  if (replyMsg.text)            content = replyMsg.text.slice(0, 150);
  else if (replyMsg.caption)    content = `[Image caption] ${replyMsg.caption.slice(0, 150)}`;
  else if (replyMsg.sticker)    content = `[Sticker: ${replyMsg.sticker.emoji || "?"}]`;
  else if (replyMsg.photo)      content = "[Photo]";
  else if (replyMsg.video)      content = "[Video]";
  else if (replyMsg.audio)      content = "[Audio]";
  else if (replyMsg.document)   content = `[File: ${replyMsg.document.file_name || "unknown"}]`;
  else if (replyMsg.voice)      content = "[Voice message]";

  return { sender, content };
};

/**
 * Parses a raw command token that may contain an @username suffix.
 * Returns null if the @username does NOT match this bot → silently ignore.
 */
const parseCommandToken = (rawToken, botUsername) => {
  const atIndex = rawToken.indexOf("@");
  if (atIndex === -1) {
    return { commandName: rawToken.toLowerCase(), targetUsername: null };
  }

  const commandName    = rawToken.slice(0, atIndex).toLowerCase();
  const targetUsername = rawToken.slice(atIndex + 1).toLowerCase();

  if (botUsername && targetUsername !== botUsername.toLowerCase()) return null;

  return { commandName, targetUsername };
};

/**
 * Finds the command that best fuzzy-matches a given name.
 * Checks primary name, then aliases, then startsWith, then includes.
 * Returns undefined if nothing is close enough.
 */
const fuzzyFindCommand = (name, cmdMap) => {
  const n = name.toLowerCase().trim();

  // Exact match
  const exact = cmdMap.get(n);
  if (exact) return exact;

  // Alias match
  const byAlias = [...cmdMap.values()].find(c => c.aliases?.includes(n));
  if (byAlias) return byAlias;

  // Starts-with match (e.g. "hel" → "help")
  const startsWith = [...cmdMap.values()].find(c =>
    c.name.startsWith(n) || c.aliases?.some(a => a.startsWith(n))
  );
  if (startsWith) return startsWith;

  return undefined;
};

/**
 * Returns up to `limit` command names that are similar to `input`
 * using a simple character overlap heuristic — for "did you mean?" hints.
 */
const suggestCommands = (input, cmdMap, limit = 3) => {
  const n = input.toLowerCase();
  return [...cmdMap.keys()]
    .map(name => {
      let score = 0;
      for (const ch of n) if (name.includes(ch)) score++;
      return { name, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ name }) => name);
};

/* ======================== PERMISSION & COOLDOWN ======================== */

const checkPermission = async (bot, msg, level) => {
  const { settings } = global.paldea;
  const senderId     = String(msg.from.id);
  const chatType     = msg.chat.type;

  const isDev = settings.developers.includes(senderId);
  const isVip = isDev || settings.vip.includes(senderId);

  switch (level) {
    case "developer": return isDev;
    case "vip":       return isVip;
    case "group":     return ["group", "supergroup"].includes(chatType);
    case "private":   return chatType === "private";
    case "administrator":
      if (chatType === "private") return false;
      if (isDev) return true;
      try {
        const member = await bot.getChatMember(msg.chat.id, senderId);
        return ["creator", "administrator"].includes(member.status);
      } catch { return false; }
    default: return true; // "anyone"
  }
};

/**
 * Returns true (and sends a reply) if the user is still on cooldown.
 * Returns false if the command may proceed.
 */
const handleCooldown = ({ msg, response, cooldowns }, command) => {
  if (!command.cooldown) return false;

  const key      = `${msg.from.id}_${command.name}`;
  const now      = Date.now();
  const duration = command.cooldown * 1000;

  if (cooldowns.has(key)) {
    const expiry = cooldowns.get(key) + duration;
    if (now < expiry) {
      const left = ((expiry - now) / 1000).toFixed(1);
      response.reply(`${SYMBOLS.cooldown} Please wait **${left}s** before using **${command.name}** again.`);
      return true;
    }
  }

  cooldowns.set(key, now);
  setTimeout(() => cooldowns.delete(key), duration);
  return false;
};

/* ======================== WATARU AI HANDLER ======================== */

/**
 * Per-user rate limiting for Wataru AI calls.
 * Returns true (blocked) if the user has exceeded WATARU_RATE_LIMIT calls
 * within the last WATARU_RATE_WINDOW milliseconds.
 */
const isWataruRateLimited = (userId) => {
  const now        = Date.now();
  const timestamps = (wataruRateMap.get(userId) || []).filter(t => now - t < WATARU_RATE_WINDOW);

  if (timestamps.length >= WATARU_RATE_LIMIT) return true;

  timestamps.push(now);
  wataruRateMap.set(userId, timestamps);
  return false;
};

/**
 * Builds a concise command catalogue string for the AI system prompt.
 * Format: `name | description | category | aliases`
 */
const buildCommandCatalogue = (cmdMap) => {
  const lines = [];
  for (const [name, cmd] of cmdMap) {
    const category = cmd.category || "general";
    const aliases  = cmd.aliases?.join(", ") || "—";
    const desc     = cmd.description || "No description";
    lines.push(`${name} | ${desc} | category:${category} | aliases:${aliases}`);
  }
  return lines.join("\n");
};

/**
 * Handles any message that invokes Wataru (via natural language).
 * Calls the Groq API to decide whether to execute a command or respond conversationally.
 */
const handleWataru = async ({ bot, msg, response, log }) => {
  const { settings, commands: cmdMap, cooldowns } = global.paldea;

  const userId   = msg.from.id;
  const isDev    = settings.developers.includes(String(userId));
  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");
  const body     = msg.text?.trim() || "";

  // Per-user rate limit (developers are exempt)
  if (!isDev && isWataruRateLimited(userId)) {
    return response.reply(
      `${SYMBOLS.cooldown} You're using Wataru too fast! Please slow down a little.`
    );
  }

  // Build context string — include reply context if present
  let userContext = body;
  const replyCtx  = extractMessageContext(msg.reply_to_message);
  if (replyCtx) {
    userContext += `\n[This message is a reply to "${replyCtx.content}" from ${replyCtx.sender}]`;
  }

  // Build the system prompt
  const catalogue   = buildCommandCatalogue(cmdMap);
  const ownerName   = settings.owner || "the bot owner";
  const systemPrompt = `\
You are Wataru, the intelligent assistant of the Paldea Telegram Bot.
The user's name is "${fullName}" and their Telegram ID is ${userId}.

## Your Task
Analyze the user's natural-language message and decide ONE of two actions:

1. **execute_command** – when the user's intent clearly maps to one of the available commands.
   - Use the exact primary command name (never an alias).
   - Extract args as a JSON array of strings. If no args are needed, use [].
   - Even if the user only describes what they want (not the command name), infer the best command.

2. **respond** – for greetings, questions, chit-chat, or when no command fits.
   - Keep the reply concise, friendly, and personalized using the user's name.
   - If asked about the owner or developer, answer: "${ownerName}".

## Rules
- Output ONLY a valid JSON object — no markdown, no code fences, no extra text.
- Never invent command names. Only use names from the catalogue below.
- If the user is replying to a message, use that context to understand the intent.
- Prefer execute_command over respond whenever a command genuinely fits.

## Available Commands
${catalogue}

## Output Format Examples
{"action":"execute_command","commandName":"uid","args":[]}
{"action":"execute_command","commandName":"echo","args":["hello","world"]}
{"action":"respond","message":"Hi ${fullName}! I'm Wataru. How can I help you today?"}
`;

  try {
    const raw      = await callAI(userContext, systemPrompt);
    const decision = JSON.parse(raw);

    /* ---- Execute a command ---- */
    if (decision.action === "execute_command" && decision.commandName) {
      const requestedName = decision.commandName.toLowerCase().trim();

      // Primary lookup then fuzzy fallback
      const selectedCmd =
        cmdMap.get(requestedName) ||
        [...cmdMap.values()].find(c => c.aliases?.includes(requestedName)) ||
        fuzzyFindCommand(requestedName, cmdMap);

      if (!selectedCmd) {
        const suggestions = suggestCommands(requestedName, cmdMap, 3);
        const hint = suggestions.length
          ? `\nDid you mean: ${suggestions.map(s => `\`${s}\``).join(", ")}?`
          : "";
        return response.reply(
          `${SYMBOLS.unknown} Wataru couldn't find a command called **${requestedName}**.${hint}`
        );
      }

      // Maintenance check
      if (settings.maintenance) {
        const ignored      = settings.maintenanceIgnore || [];
        const isWhitelisted =
          ignored.includes(selectedCmd.name) ||
          selectedCmd.aliases?.some(a => ignored.includes(a));

        if (!isDev && !isWhitelisted) {
          return response.reply(`${SYMBOLS.maintenance} **System Under Maintenance.** Please try again later.`);
        }
      }

      // Permission check
      const level = selectedCmd.type || selectedCmd.access || "anyone";
      if (!(await checkPermission(bot, msg, level))) {
        if (level === "developer") return;
        if (level === "administrator" && msg.chat.type === "private") {
          return response.reply(`${SYMBOLS.warning} This command can only be used in group chats.`);
        }
        return response.reply(`${SYMBOLS.warning} Access Restricted: **${level.toUpperCase()}**`);
      }

      // Cooldown check (developers are exempt)
      if (!isDev && handleCooldown({ msg, response, cooldowns }, selectedCmd)) return;

      log.commands(`[WATARU] "${selectedCmd.name}" triggered by ${fullName} (${userId})`);

      // Build a usage helper specific to Wataru context
      const aiUsage = async () => {
        if (!selectedCmd.guide) return;
        const p      = selectedCmd.prefix === false ? "" : settings.prefix;
        const guides = (Array.isArray(selectedCmd.guide) ? selectedCmd.guide : [selectedCmd.guide])
          .map(g => `\`${p}${selectedCmd.name} ${g}\``)
          .join("\n");
        await response.reply(
          `${SYMBOLS.usage} **Usage Guide — ${selectedCmd.name}:**\n\n${guides}\n\n` +
          `${SYMBOLS.guide} ${selectedCmd.description || "No description."}`
        );
      };

      // Normalize args
      const args = Array.isArray(decision.args)
        ? decision.args.map(String)
        : decision.args
          ? String(decision.args).trim().split(/\s+/)
          : [];

      await selectedCmd.onStart({
        bot,
        msg,
        args,
        response,
        usage:       aiUsage,
        commandName: selectedCmd.name,
        matches:     settings.prefix,
      });

    /* ---- Conversational response ---- */
    } else if (decision.action === "respond" && decision.message) {
      await response.reply(String(decision.message));

    /* ---- Fallback if AI output was unexpected ---- */
    } else {
      await response.reply(
        `${SYMBOLS.ai} **Wataru here!** Mention me and describe what you need, or type \`${settings.prefix}help\` to browse all commands.`
      );
    }

  } catch (error) {
    log.error(`[WATARU] ${error.message}`);
    await response.reply(
      `${SYMBOLS.error} Wataru ran into a problem. Please try again in a moment.\n\`${error.message}\``
    );
  }
};

/* ======================== MAIN COMMAND HANDLER ======================== */

/**
 * Entry point for every incoming message.
 * Handles prefixed commands, @username commands, and Wataru natural language.
 */
export async function handleCommand({ bot, msg, response, log }) {
  if (!msg?.text || msg.from?.is_bot) return;

  const { settings, commands, cooldowns } = global.paldea;
  const { prefix, subprefix } = settings;
  const body   = msg.text.trim();
  const isDev  = settings.developers.includes(String(msg.from.id));

  /* ------ Wataru natural language trigger (no prefix required) ------ */
  // Must appear before prefix matching so "wataru …" messages without a prefix
  // are correctly intercepted here rather than falling through to "unknown command".
  const watTrigger = /\bwataru\b/i;
  const allPrefixes = [prefix, ...(subprefix || [])].filter(Boolean);
  const matchedPrefix = allPrefixes.find(p => body.startsWith(p));

  // If message mentions "wataru" but is NOT a prefixed command, route to AI handler.
  if (!matchedPrefix && watTrigger.test(body)) {
    return handleWataru({ bot, msg, response, log });
  }

  /* ------ Bare prefix (e.g. just "!") ------ */
  if (matchedPrefix && body === matchedPrefix) {
    return response.reply(
      `🟢 **System Online.**\nType \`${matchedPrefix}help\` to see all available commands.`
    );
  }

  /* ------ Parse command name & args ------ */
  let rawToken, args;

  if (matchedPrefix) {
    const parts = body.slice(matchedPrefix.length).trim().split(/\s+/);
    rawToken = parts[0];
    args     = parts.slice(1);
  } else {
    const parts = body.split(/\s+/);
    rawToken = parts[0];
    args     = parts.slice(1);
  }

  /* ------ @username-aware token parsing ------ */
  const botInstance  = [...(global.paldea.instances?.values() || [])].find(b => b._paldea_me);
  const botUsername  = botInstance?._paldea_me?.username || "";
  const parsed       = parseCommandToken(rawToken, botUsername);

  // null → @username present but belongs to a different bot; silently ignore.
  if (parsed === null) return;

  const commandName = parsed.commandName;

  /* ------ Resolve command ------ */
  const command =
    commands.get(commandName) ||
    [...commands.values()].find(cmd => cmd.aliases?.includes(commandName));

  /* ------ Command not found ------ */
  if (!command) {
    // Wataru via prefixed message: e.g. "!wataru ping my server"
    if (watTrigger.test(body)) {
      return handleWataru({ bot, msg, response, log });
    }

    if (matchedPrefix) {
      // Ignore internal Telegram "/start" command
      if (commandName === "start") return;

      const suggestions = suggestCommands(commandName, commands, 3);
      const hint = suggestions.length
        ? `\n\nDid you mean: ${suggestions.map(s => `\`${matchedPrefix}${s}\``).join(", ")}?`
        : `\n\nType \`${matchedPrefix}help\` to see all commands.`;

      return response.reply(
        `${SYMBOLS.unknown} **Unknown Command:** \`${commandName}\`${hint}`
      );
    }
    return; // Unprefixed unknown command — silently ignore.
  }

  /* ------ Maintenance check ------ */
  if (settings.maintenance) {
    const ignored      = settings.maintenanceIgnore || [];
    const isWhitelisted =
      ignored.includes(command.name) ||
      command.aliases?.some(a => ignored.includes(a));

    if (!isDev && !isWhitelisted) {
      return response.reply(
        `${SYMBOLS.maintenance} **System Under Maintenance.**\nThe bot is being updated. Please try again later.`
      );
    }
  }

  /* ------ Prefix requirement gate ------ */
  const requiresPrefix = command.prefix ?? true;
  if (requiresPrefix === true  && !matchedPrefix) return;
  if (requiresPrefix === false && matchedPrefix)  return;

  /* ------ Permission check ------ */
  const level = command.type || command.access || "anyone";
  if (!(await checkPermission(bot, msg, level))) {
    if (level === "developer") return; // silently deny
    if (level === "administrator" && msg.chat.type === "private") {
      return response.reply(`${SYMBOLS.warning} This command can only be used in group chats.`);
    }
    return response.reply(`${SYMBOLS.warning} Access Restricted: **${level.toUpperCase()}**`);
  }

  /* ------ Cooldown check ------ */
  if (!isDev && handleCooldown({ msg, response, cooldowns }, command)) return;

  /* ------ Build usage helper ------ */
  const usage = async () => {
    if (!command.guide) return;
    const p      = command.prefix === false ? "" : (matchedPrefix || prefix);
    const guides = (Array.isArray(command.guide) ? command.guide : [command.guide])
      .map(g => `\`${p}${command.name} ${g}\``)
      .join("\n");
    await response.reply(
      `${SYMBOLS.usage} **Usage Guide — ${command.name}:**\n\n${guides}\n\n` +
      `${SYMBOLS.guide} ${command.description || "No description."}`
    );
  };

  /* ------ Execute ------ */
  try {
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");
    log.commands(`"${command.name}" called by ${fullName} (${msg.from.id})`);

    await command.onStart({
      bot,
      msg,
      args,
      response,
      usage,
      commandName,
      matches: matchedPrefix,
    });

  } catch (error) {
    log.error(`[${commandName}] Runtime Error: ${error.message}`);
    await response.reply(
      `${SYMBOLS.error} **Runtime Error in \`${commandName}\`:**\n\`${error.message}\``
    );
  }
}