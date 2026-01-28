import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';

const execAsync = promisify(exec);

export class SystemctlTool {
  private confirmationService = ConfirmationService.getInstance();

  get name(): string {
    return 'systemctl';
  }

  get description(): string {
    return 'Systemd service management tool for controlling system services';
  }

  async execute(operation: string, serviceName: string): Promise<ToolResult> {
    if (!serviceName) {
      return { success: false, error: 'Service name is required' };
    }

    switch (operation) {
      case 'start':
        return this.start(serviceName);
      case 'stop':
        return this.stop(serviceName);
      case 'restart':
        return this.restart(serviceName);
      case 'status':
        return this.status(serviceName);
      case 'enable':
        return this.enable(serviceName);
      case 'disable':
        return this.disable(serviceName);
      case 'is-active':
        return this.isActive(serviceName);
      case 'is-enabled':
        return this.isEnabled(serviceName);
      default:
        return {
          success: false,
          error: `Unknown systemctl operation: ${operation}. Supported: start, stop, restart, status, enable, disable, is-active, is-enabled`
        };
    }
  }

  private async runCommand(command: string, requiresConfirmation: boolean = true): Promise<ToolResult> {
    try {
      if (requiresConfirmation) {
        const sessionFlags = this.confirmationService.getSessionFlags();
        if (!sessionFlags.bashCommands && !sessionFlags.allOperations) {
          const confirmationResult = await this.confirmationService.requestConfirmation({
            operation: 'Run systemctl command',
            filename: command,
            showVSCodeOpen: false,
            content: `Command: sudo ${command}`
          }, 'bash');

          if (!confirmationResult.confirmed) {
            return {
              success: false,
              error: confirmationResult.feedback || 'Systemctl command cancelled by user'
            };
          }
        }
      }

      const { stdout, stderr } = await execAsync(`sudo ${command}`, {
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
        error: `Systemctl command failed: ${error.message}`
      };
    }
  }

  async start(serviceName: string): Promise<ToolResult> {
    return this.runCommand(`systemctl start ${serviceName}`);
  }

  async stop(serviceName: string): Promise<ToolResult> {
    return this.runCommand(`systemctl stop ${serviceName}`);
  }

  async restart(serviceName: string): Promise<ToolResult> {
    return this.runCommand(`systemctl restart ${serviceName}`);
  }

  async status(serviceName: string): Promise<ToolResult> {
    return this.runCommand(`systemctl status ${serviceName}`, false); // Status check doesn't require confirmation
  }

  async enable(serviceName: string): Promise<ToolResult> {
    return this.runCommand(`systemctl enable ${serviceName}`);
  }

  async disable(serviceName: string): Promise<ToolResult> {
    return this.runCommand(`systemctl disable ${serviceName}`);
  }

  async isActive(serviceName: string): Promise<ToolResult> {
    const result = await this.runCommand(`systemctl is-active ${serviceName}`, false);
    if (result.success) {
      result.output = `Service ${serviceName} is ${result.output}`;
    }
    return result;
  }

  async isEnabled(serviceName: string): Promise<ToolResult> {
    const result = await this.runCommand(`systemctl is-enabled ${serviceName}`, false);
    if (result.success) {
      result.output = `Service ${serviceName} is ${result.output}`;
    }
    return result;
  }
}