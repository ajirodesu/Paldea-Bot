import { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec);

/**
 * Shell Command
 * Executes system shell commands.
 */
export const meta = {
  name: 'shell',
  version: '1.0.0',
  aliases: ['sh', 'exec', 'term'],
  description: 'Execute shell/terminal commands.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 3,
  guide: ['<command>'],
};

export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();

  const command = args.join(' ');
  const loading = await response.reply('💻 **Executing...**');

  try {
    const { stdout, stderr } = await exec(command, {
      timeout: 15000, // 15s timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      shell: '/bin/bash'
    });

    const output = (stdout || '').toString().trim();
    const error = (stderr || '').toString().trim();

    let result = '';
    if (output) result += `STDOUT:\n${output}\n`;
    if (error) result += `STDERR:\n${error}\n`;
    if (!result) result = 'Command executed. No output.';

    // Handle large output
    if (result.length > 3000) {
      await response.edit('text', loading, '📄 Output too large. Sending file...');
      const buffer = Buffer.from(result, 'utf8');
      return response.upload('document', buffer, { filename: 'shell_output.txt' });
    }

    await response.edit('text', loading, `\`\`\`bash\n${result}\n\`\`\``);

  } catch (err) {
    const message = err.message || 'Unknown Error';
    await response.edit('text', loading, `⚠️ **Execution Failed**\n\`\`\`\n${message}\n\`\`\``);
  }
}