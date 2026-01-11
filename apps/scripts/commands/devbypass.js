/**
 * Maintenance Bypass (Dev Whitelist)
 * Allows specific commands to be used by everyone during Global Maintenance.
 */

export const meta = {
  name: 'devbypass',
  version: '1.0.0',
  aliases: ['ignoremaintenance', 'devwhitelist', 'ignoredev'],
  description: 'Whitelist commands to bypass Maintenance Mode.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'developer',
  type: 'developer', // STRICTLY DEVELOPER
  cooldown: 3,
  guide: [
    ' add <command>: Allow a command during maintenance',
    ' del <command>: Remove a command',
    ' list: View allowed commands'
  ]
};

export async function onStart({ args, response, matches }) {
  const { settings } = global.paldea;
  const subCommand = args[0]?.toLowerCase();
  const targetCmd = args[1]?.toLowerCase();

  // Ensure list exists
  const ignoreList = settings.maintenanceIgnore || [];

  // --- 1. ADD ---
  if (subCommand === 'add' || subCommand === 'allow') {
    if (!targetCmd) return response.reply("⚠️ **Missing Argument**\nPlease specify the command name to whitelist.");

    // Check if command exists
    const commandExists = global.paldea.commands.has(targetCmd) || 
                          [...global.paldea.commands.values()].some(c => c.aliases?.includes(targetCmd));

    if (!commandExists) {
      return response.reply(`⚠️ **Unknown Command**\n\`${targetCmd}\` does not exist in the bot's system.`);
    }

    if (ignoreList.includes(targetCmd)) {
      return response.reply(`ℹ️ \`${targetCmd}\` is already whitelisted.`);
    }

    // Update Settings
    const newList = [...ignoreList, targetCmd];
    global.paldea.settings = { ...settings, maintenanceIgnore: newList };

    return response.reply(`✅ **Whitelisted**\nEveryone can now use \`${targetCmd}\` during Maintenance.`);
  }

  // --- 2. DELETE ---
  if (subCommand === 'del' || subCommand === 'remove' || subCommand === 'rm') {
    if (!targetCmd) return response.reply("⚠️ **Missing Argument**\nPlease specify the command name to remove.");

    if (!ignoreList.includes(targetCmd)) {
      return response.reply(`ℹ️ \`${targetCmd}\` is not in the whitelist.`);
    }

    // Remove item
    const newList = ignoreList.filter(cmd => cmd !== targetCmd);
    global.paldea.settings = { ...settings, maintenanceIgnore: newList };

    return response.reply(`🗑️ **Removed**\n\`${targetCmd}\` is now blocked during Maintenance.`);
  }

  // --- 3. LIST ---
  if (subCommand === 'list' || subCommand === 'show') {
    if (ignoreList.length === 0) {
      return response.reply("📂 **Whitelist Empty**\nNo exceptions set. Maintenance Mode blocks everything.");
    }

    return response.reply(
      `🚧 **Maintenance Exceptions**\n` +
      `These commands work even when Maintenance is ON:\n\n` +
      ignoreList.map(c => `• \`${c}\``).join('\n')
    );
  }

  return response.reply(`❓ **Usage:** ${matches}devbypass [add | del | list]`);
}