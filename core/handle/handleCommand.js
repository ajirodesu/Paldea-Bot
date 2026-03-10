/**
 * @fileoverview Core Command Handler with Wataru AI
 * Now powered by Official Groq API (llama-3.3-70b-versatile) – fixed JSON + ultra-fast
 */

import fetch from 'node-fetch';

const SYMBOLS = {
  usage: "▫️", 
  error: "❌", 
  warning: "⚠️", 
  cooldown: "⏳", 
  guide: "📄", 
  unknown: "❓",
  maintenance: "🚧"
};

/* ====================== AI HELPER – Official Groq API ====================== */
const GROQ_API_KEY = `${global.paldea.settings.groqKey}`; // ← PASTE YOUR KEY FROM console.groq.com (or set in settings)

const callAI = async (text, systemPrompt, sessionId) => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: `${global.paldea.settings.groqModel || "llama-3.3-70b-versatile"}`,  // Use setting or default fast model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" }  // ← Guarantees valid JSON!
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API Error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
};

/* ====================== WATARU AI HANDLER ====================== */
const handleWataru = async ({ bot, msg, response, log }) => {
  const { settings, commands: cmdMap, cooldowns } = global.paldea;
  const body = msg.text.trim();
  const isDev = settings.developers.includes(String(msg.from.id));
  const fullName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");
  const userId = msg.from.id;

  // Add context if there's a replied message (improvement: provide AI with more context for better decision-making)
  let enhancedText = body;
  if (msg.reply_to_message) {
    const repliedUser = msg.reply_to_message.from;
    const repliedName = repliedUser.first_name + (repliedUser.last_name ? ` ${repliedUser.last_name}` : "") || "Unknown";
    const repliedText = msg.reply_to_message.text?.substring(0, 100) || "[non-text message]";
    enhancedText += ` (This message is a reply to: "${repliedText}" from ${repliedName})`;
  }

  try {
    // Build dynamic list of ALL commands (improvement: include category for better AI matching)
    let commandList = "";
    for (const [name, cmd] of cmdMap) {
      const aliases = cmd.aliases ? cmd.aliases.join(", ") : "none";
      const category = cmd.category ? cmd.category : "uncategorized";
      commandList += `• ${name} | ${cmd.description || "No description"} | Category: ${category} | Aliases: ${aliases}\n`;
    }

    const systemPrompt = `You are Wataru, the smart AI assistant of the Paldea Telegram Bot.
The user's name is ${fullName}.
The user's ID is ${userId}.

Users mention "wataru" to invoke you. Analyze their natural language request.

Here are ALL available commands:
${commandList}

Your job:
- If the user's request clearly matches a command (by name, alias, description, or intent), output "execute_command" with the exact primary commandName (not alias) and extract args as an array of strings split by spaces or logically.
- If it's casual chat, greeting, question, or doesn't match any command, output "respond" with a short, friendly reply. Use the user's name where appropriate to personalize.
- If the user is asking for help, guide them to use the command.
- If the user is asking for Developer or Owner name, respond with ${global.paldea.settings.owner}.
- Consider if the message is a reply; commands like 'uid' can use the replied context automatically.
- ALWAYS output ONLY valid JSON (no extra text, no markdown, no explanations).
- Be precise: Only choose existing commands. Extract args accurately. If no args needed, use empty array.

Examples:
User: wataru get my user id
{"action": "execute_command", "commandName": "uid", "args": []}

User: wataru echo hello world
{"action": "execute_command", "commandName": "echo", "args": ["hello", "world"]}

User: wataru uid (This message is a reply to: "some message" from John)
{"action": "execute_command", "commandName": "uid", "args": []}  // Command will handle the reply context

User: hi wataru how are you
{"action": "respond", "message": "Hi ${fullName}! I'm doing great, thanks for asking. How can I assist?"}

User: wataru tell me a joke
{"action": "respond", "message": "Why did the scarecrow win an award? Because he was outstanding in his field!"}
`;

    const aiText = await callAI(enhancedText, systemPrompt, `wataru_${msg.from.id}`);

    // Parse JSON (native format ensures no errors)
    const decision = JSON.parse(aiText);

    if (decision.action === "execute_command" && decision.commandName) {
      const cmdName = decision.commandName.toLowerCase().trim();

      let selectedCmd = cmdMap.get(cmdName) ||
                        [...cmdMap.values()].find(c => c.aliases?.includes(cmdName));

      if (!selectedCmd) {
        return response.reply(`${SYMBOLS.unknown} Wataru: Command "${cmdName}" not found. Try describing what you want!`);
      }

      // Maintenance check
      if (settings.maintenance) {
        const ignored = settings.maintenanceIgnore || [];
        const whitelisted = ignored.includes(selectedCmd.name) ||
                            (selectedCmd.aliases && selectedCmd.aliases.some(a => ignored.includes(a)));
        if (!isDev && !whitelisted) {
          return response.reply(`${SYMBOLS.maintenance} **System Under Maintenance**`);
        }
      }

      // Permission + Cooldown
      const level = selectedCmd.type || selectedCmd.access || "anyone";
      if (!(await checkPermission(bot, msg, level))) {
        if (level === "developer") return;
        if (level === "administrator" && msg.chat.type === 'private') {
          return response.reply(`${SYMBOLS.warning} This command cannot be used in private chats.`);
        }
        return response.reply(`${SYMBOLS.warning} Access Restricted: **${level.toUpperCase()}**`);
      }

      if (!isDev) {
        if (handleCooldown({ msg, response, cooldowns }, selectedCmd)) return;
      }

      log.commands(`[WATARU AI] ${selectedCmd.name} executed by ${fullName}`);

      const aiUsage = async () => {
        if (!selectedCmd.guide) return;
        const p = selectedCmd.prefix === false ? "" : settings.prefix;
        const guides = (Array.isArray(selectedCmd.guide) ? selectedCmd.guide : [selectedCmd.guide])
          .map(g => `\`${p}${selectedCmd.name} ${g}\``)
          .join("\n");
        return await response.reply(
          `${SYMBOLS.usage} **Usage Guide:**\n\n${guides}\n\n${SYMBOLS.guide} ${selectedCmd.description || "No description."}`
        );
      };

      await selectedCmd.onStart({
        bot,
        msg,
        args: Array.isArray(decision.args) ? decision.args : (decision.args ? String(decision.args).split(/\s+/) : []),
        response,
        usage: aiUsage,
        commandName: selectedCmd.name,
        matches: settings.prefix
      });

    } else if (decision.action === "respond" && decision.message) {
      await response.reply(decision.message);
    } else {
      await response.reply("🟢 **Wataru here!** Mention me to use any command naturally or just chat.");
    }

  } catch (error) {
    log.error(`[WATARU AI] ${error.message}`);
    await response.reply(`${SYMBOLS.error} Wataru had a problem: ${error.message}`);
  }
};

/* ====================== ORIGINAL HELPERS (unchanged) ====================== */
const checkPermission = async (bot, msg, level) => {
  const { settings } = global.paldea;
  const senderId = String(msg.from.id);
  const chatType = msg.chat.type;

  const isDev = settings.developers.includes(senderId);
  const isVip = isDev || settings.vip.includes(senderId);

  switch (level) {
    case 'developer': return isDev;
    case 'vip':       return isVip;
    case 'group':     return ['group', 'supergroup'].includes(chatType);
    case 'private':   return chatType === 'private';
    case 'administrator':
      if (chatType === 'private') return false;
      if (isDev) return true;
      try {
        const member = await bot.getChatMember(msg.chat.id, senderId);
        return ['creator', 'administrator'].includes(member.status);
      } catch { return false; }
    case 'anyone':
    default: return true;
  }
};

const handleCooldown = (context, command) => {
  const { msg, response, cooldowns } = context;
  if (!command.cooldown) return false;

  const key = `${msg.from.id}_${command.name}`;
  const now = Date.now();
  const duration = command.cooldown * 1000;

  if (cooldowns.has(key)) {
    const expiration = cooldowns.get(key) + duration;
    if (now < expiration) {
      const left = ((expiration - now) / 1000).toFixed(1);
      response.reply(`${SYMBOLS.cooldown} Wait **${left}s** before using this again.`);
      return true;
    }
  }

  cooldowns.set(key, now);
  setTimeout(() => cooldowns.delete(key), duration);
  return false;
};

/* ====================== MAIN COMMAND HANDLER ====================== */
export async function handleCommand({ bot, msg, response, log, userId }) {
  if (!msg.text || msg.from.is_bot) return;

  const { settings, commands, cooldowns } = global.paldea;
  const { prefix, subprefix } = settings;
  const body = msg.text.trim();

  const isDev = settings.developers.includes(String(msg.from.id));

  const allPrefixes = [prefix, ...(subprefix || [])];
  const matchedPrefix = allPrefixes.find(p => body.startsWith(p));

  if (matchedPrefix && body === matchedPrefix) {
    return response.reply(`🟢 **System Online.**\nType \`${matchedPrefix}help\` to see commands.`);
  }

  let commandName, args;
  let isPrefixed = !!matchedPrefix;

  if (isPrefixed) {
    const parts = body.slice(matchedPrefix.length).trim().split(/\s+/);
    commandName = parts[0].toLowerCase();
    args = parts.slice(1);
  } else {
    const parts = body.split(/\s+/);
    commandName = parts[0].toLowerCase();
    args = parts.slice(1);
  }

  const command = commands.get(commandName) || 
                  [...commands.values()].find(cmd => cmd.aliases?.includes(commandName));

  if (!command) {
    if (body.toLowerCase().includes("wataru")) {
      return await handleWataru({ bot, msg, response, log });
    }
    if (isPrefixed) {
      if (commandName === "start") return; 
      return response.reply(`${SYMBOLS.unknown} **Unknown Command**\n\`${commandName}\` not found.`);
    }
    return;
  }

  if (settings.maintenance) {
    const ignoredCommands = settings.maintenanceIgnore || [];
    const isWhitelisted = ignoredCommands.includes(command.name) || 
                          (command.aliases && command.aliases.some(a => ignoredCommands.includes(a)));

    if (!isDev && !isWhitelisted) {
      return response.reply(`${SYMBOLS.maintenance} **System Under Maintenance**\nThe bot is currently being updated. Please try again later.`);
    }
  }

  const usage = async () => {
    if (!command.guide) return;
    const p = command.prefix === false ? "" : (matchedPrefix || prefix);
    const guides = (Array.isArray(command.guide) ? command.guide : [command.guide])
      .map(g => `\`${p}${command.name} ${g}\``)
      .join('\n');

    return await response.reply(
      `${SYMBOLS.usage} **Usage Guide:**\n\n${guides}\n\n${SYMBOLS.guide} ${command.description || "No description."}`
    );
  };

  try {
    const requiresPrefix = command.prefix ?? true; 
    if (requiresPrefix === true && !isPrefixed) return; 
    if (requiresPrefix === false && isPrefixed) return; 

    const level = command.type || command.access || 'anyone';
    if (!(await checkPermission(bot, msg, level))) {
      if (level === 'developer') return; 
      if (level === 'administrator' && msg.chat.type === 'private') {
        return response.reply(`${SYMBOLS.warning} This command cannot be used in private chats.`);
      }
      return response.reply(`${SYMBOLS.warning} Access Restricted: **${level.toUpperCase()}**`);
    }

    if (!isDev) {
      if (handleCooldown({ msg, response, cooldowns }, command)) return;
    }

    const fullName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");

    log.commands(`${command.name} called by ${fullName}`);

    await command.onStart({ 
      bot, 
      msg, 
      args, 
      response, 
      usage, 
      commandName, 
      matches: matchedPrefix 
    });

  } catch (error) {
    log.error(`[${commandName}] Runtime Error: ${error.message}`);
    await response.reply(`${SYMBOLS.error} **System Error:**\n\`${error.message}\``);
  }
}