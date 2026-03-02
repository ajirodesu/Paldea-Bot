/**
 * NPM Executor
 * Execute npm commands directly on the server.
 * STRICTLY FOR DEVELOPERS.
 */

import { exec } from 'child_process';
import util from 'util';

// Promisify exec for cleaner async/await usage
const execPromise = util.promisify(exec);

export const meta = {
  name: "npm",
  version: "1.1.0",
  aliases: ["package", "node_modules"],
  description: "Execute NPM commands directly on the server.",
  author: "AjiroDesu",
  prefix: "both",
  category: "developer",
  type: "developer", // STRICTLY RESTRICTED
  cooldown: 5,
  guide: ["<command> (e.g. install axios)"]
};

export async function onStart({ args, response }) {
  const commandArgs = args.join(" ");

  if (!commandArgs) {
    return response.reply("⚠️ **Missing Arguments**\nUsage: `/npm <command>`\nExample: `/npm list --depth=0`");
  }

  let loadingMsg;

  try {
    // 1. Notify Start
    loadingMsg = await response.reply(`⏳ **Executing:** \`npm ${commandArgs}\`...`);

    // 2. Execute
    // We limit buffer size to 5MB to prevent crashing on massive outputs
    const { stdout, stderr } = await execPromise(`npm ${commandArgs}`, { maxBuffer: 1024 * 1024 * 5 });

    // 3. Format Output
    let output = stdout || stderr || "✅ Command executed successfully with no output.";

    // Truncate if too long for Telegram (limit is 4096 characters)
    if (output.length > 3000) {
      output = output.substring(0, 3000) + "\n\n...[Output Truncated]";
    }

    // 4. Send Result
    await response.edit('text', loadingMsg, 
      `📦 **NPM Execution Result**\n\n` +
      `\`\`\`bash\n${output}\n\`\`\``
    );

  } catch (error) {
    // Handle execution errors (non-zero exit codes)
    const errOutput = error.stderr || error.stdout || error.message || "Unknown Error";

    const finalMsg = `❌ **Execution Failed**\n\n` +
                     `\`\`\`bash\n${errOutput.substring(0, 3000)}\n\`\`\``;

    if (loadingMsg) {
      await response.edit('text', loadingMsg, finalMsg);
    } else {
      await response.reply(finalMsg);
    }
  }
}