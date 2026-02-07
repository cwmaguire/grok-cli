import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';

const execAsync = promisify(exec);

export class AptTool {
  private confirmationService = ConfirmationService.getInstance();

  get name(): string {
    return 'apt';
  }

  get description(): string {
    return 'Ubuntu package management tool for installing, removing, and managing packages';
  }

  async execute(operation: string, ...args: string[]): Promise<ToolResult> {
    switch (operation) {
      case 'install':
        return this.install(args[0]);
      case 'remove':
        return this.remove(args[0]);
      case 'update':
        return this.update();
      case 'upgrade':
        return this.upgrade();
      case 'search':
        return this.search(args[0]);
      case 'show':
        return this.show(args[0]);
      default:
        return {
          success: false,
          error: `Unknown apt operation: ${operation}. Supported: install, remove, update, upgrade, search, show`
        };
    }
  }

  private async runCommand(command: string, requiresConfirmation: boolean = true): Promise<ToolResult> {
    try {
      if (requiresConfirmation) {
        const sessionFlags = this.confirmationService.getSessionFlags();
        if (!sessionFlags.bashCommands && !sessionFlags.allOperations) {
          const confirmationResult = await this.confirmationService.requestConfirmation({
            operation: 'Run apt command',
            filename: command,
            showVSCodeOpen: false,
            content: `Command: sudo ${command}`
          }, 'bash');

          if (!confirmationResult.confirmed) {
            return {
              success: false,
              error: confirmationResult.feedback || 'Apt command cancelled by user'
            };
          }
        }
      }

      const { stdout, stderr } = await execAsync(`sudo ${command}`, {
        timeout: 300000, // 5 minutes for apt operations
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');

      return {
        success: true,
        output: output.trim() || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Apt command failed: ${error.message}`
      };
    }
  }

  async install(packageName: string): Promise<ToolResult> {
    if (!packageName) {
      return { success: false, error: 'Package name is required' };
    }
    return this.runCommand(`apt install -y ${packageName}`);
  }

  async remove(packageName: string): Promise<ToolResult> {
    if (!packageName) {
      return { success: false, error: 'Package name is required' };
    }
    return this.runCommand(`apt remove -y ${packageName}`);
  }

  async update(): Promise<ToolResult> {
    return this.runCommand('apt update');
  }

  async upgrade(): Promise<ToolResult> {
    return this.runCommand('apt upgrade -y');
  }

  async search(packageName: string): Promise<ToolResult> {
    if (!packageName) {
      return { success: false, error: 'Package name is required' };
    }
    return this.runCommand(`apt search ${packageName}`, false); // Search doesn't require confirmation
  }

  async show(packageName: string): Promise<ToolResult> {
    if (!packageName) {
      return { success: false, error: 'Package name is required' };
    }
    return this.runCommand(`apt show ${packageName}`, false); // Show doesn't require confirmation
  }
}