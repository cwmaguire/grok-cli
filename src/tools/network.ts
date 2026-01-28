import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';

const execAsync = promisify(exec);

export class NetworkTool {
  private confirmationService = ConfirmationService.getInstance();

  get name(): string {
    return 'network';
  }

  get description(): string {
    return 'Network diagnostics and monitoring tool';
  }

  async execute(operation: string, ...args: string[]): Promise<ToolResult> {
    switch (operation) {
      case 'ping':
        return this.ping(args[0], args[1]);
      case 'traceroute':
        return this.traceroute(args[0]);
      case 'interfaces':
        return this.interfaces();
      case 'connections':
        return this.connections();
      case 'dns':
        return this.dnsLookup(args[0]);
      case 'speedtest':
        return this.speedTest();
      default:
        return {
          success: false,
          error: `Unknown network operation: ${operation}. Supported: ping, traceroute, interfaces, connections, dns, speedtest`
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
        error: `Network command failed: ${error.message}`
      };
    }
  }

  async ping(host: string, count: string = '4'): Promise<ToolResult> {
    if (!host) {
      return { success: false, error: 'Host is required for ping' };
    }
    return this.runCommand(`ping -c ${count} ${host}`);
  }

  async traceroute(host: string): Promise<ToolResult> {
    if (!host) {
      return { success: false, error: 'Host is required for traceroute' };
    }
    return this.runCommand(`traceroute ${host}`);
  }

  async interfaces(): Promise<ToolResult> {
    return this.runCommand('ip addr show');
  }

  async connections(): Promise<ToolResult> {
    return this.runCommand('ss -tuln');
  }

  async dnsLookup(host: string): Promise<ToolResult> {
    if (!host) {
      return { success: false, error: 'Host is required for DNS lookup' };
    }
    return this.runCommand(`nslookup ${host}`);
  }

  async speedTest(): Promise<ToolResult> {
    // Check if speedtest-cli is available
    try {
      await execAsync('which speedtest-cli', { timeout: 5000 });
      return this.runCommand('speedtest-cli --simple');
    } catch {
      // speedtest-cli not available, provide alternative
      return {
        success: true,
        output: 'speedtest-cli not installed. Install with: sudo apt install speedtest-cli\n\nAlternative: Visit https://www.speedtest.net/ for manual testing'
      };
    }
  }
}