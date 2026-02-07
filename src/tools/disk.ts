import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';

const execAsync = promisify(exec);

export class DiskTool {
  private confirmationService = ConfirmationService.getInstance();

  get name(): string {
    return 'disk';
  }

  get description(): string {
    return 'Disk usage monitoring and management tool';
  }

  async execute(operation: string, ...args: string[]): Promise<ToolResult> {
    switch (operation) {
      case 'usage':
        return this.usage(args[0]);
      case 'free':
        return this.free();
      case 'du':
        return this.diskUsage(args[0] || '.');
      case 'large-files':
        return this.findLargeFiles(args[0] || '.', args[1] || '100M');
      case 'cleanup':
        return this.cleanupSuggestions();
      default:
        return {
          success: false,
          error: `Unknown disk operation: ${operation}. Supported: usage, free, du, large-files, cleanup`
        };
    }
  }

  private async runCommand(command: string): Promise<ToolResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');

      return {
        success: true,
        output: output.trim() || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Disk command failed: ${error.message}`
      };
    }
  }

  async usage(path: string = '/'): Promise<ToolResult> {
    return this.runCommand(`df -h ${path}`);
  }

  async free(): Promise<ToolResult> {
    return this.runCommand('free -h');
  }

  async diskUsage(path: string = '.'): Promise<ToolResult> {
    return this.runCommand(`du -sh ${path}`);
  }

  async findLargeFiles(directory: string = '/', minSize: string = '100M'): Promise<ToolResult> {
    // Find files larger than specified size
    return this.runCommand(`find ${directory} -type f -size +${minSize} -exec ls -lh {} \\; | sort -k5 -hr | head -20`);
  }

  async cleanupSuggestions(): Promise<ToolResult> {
    const suggestions = [
      'Consider cleaning package cache: sudo apt autoclean && sudo apt autoremove',
      'Check for large log files: sudo find /var/log -type f -size +50M -exec ls -lh {} \\;',
      'Look for old kernels: dpkg --list | grep linux-image',
      'Check Docker if installed: docker system df',
      'Find duplicate packages: sudo apt list --installed | grep -o "^[^/]*" | sort | uniq -d'
    ];

    return {
      success: true,
      output: 'Disk cleanup suggestions:\n' + suggestions.join('\n')
    };
  }
}