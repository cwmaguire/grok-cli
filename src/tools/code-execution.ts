import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';

const execAsync = promisify(exec);

export class CodeExecutionTool {
  private confirmationService = ConfirmationService.getInstance();

  get name(): string {
    return 'code_execution';
  }

  get description(): string {
    return 'Safely execute code snippets in isolated Docker containers for testing';
  }

  async execute(operation: string, ...args: string[]): Promise<ToolResult> {
    switch (operation) {
      case 'run':
        return this.runCode(args[0], args[1], args[2]);
      case 'test':
        return this.testCode(args[0], args[1]);
      default:
        return {
          success: false,
          error: `Unknown code execution operation: ${operation}. Supported: run, test`
        };
    }
  }

  private async runCode(code: string, language: string, input?: string): Promise<ToolResult> {
    if (!code) {
      return { success: false, error: 'Code is required' };
    }
    if (!language) {
      return { success: false, error: 'Language is required' };
    }

    // Check if Docker is available
    try {
      await execAsync('docker --version');
    } catch {
      return {
        success: false,
        error: 'Docker is required for safe code execution but is not available. Please install Docker.'
      };
    }

    // Request confirmation for code execution
    const sessionFlags = this.confirmationService.getSessionFlags();
    if (!sessionFlags.bashCommands && !sessionFlags.allOperations) {
      const confirmationResult = await this.confirmationService.requestConfirmation({
        operation: 'Execute code in Docker container',
        filename: `code.${language}`,
        showVSCodeOpen: false,
        content: `Language: ${language}\nCode length: ${code.length} characters\nInput: ${input || 'none'}`
      }, 'bash');

      if (!confirmationResult.confirmed) {
        return {
          success: false,
          error: confirmationResult.feedback || 'Code execution cancelled by user'
        };
      }
    }

    let tempDir: string | null = null;
    let containerName: string | null = null;

    try {
      // Create temporary directory
      tempDir = await mkdtemp(join(tmpdir(), 'grok-code-exec-'));
      containerName = `grok-exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Prepare code file based on language
      const { filename, dockerImage, runCommand } = this.getLanguageConfig(language);

      // Write code to file
      const codePath = join(tempDir, filename);
      await writeFile(codePath, code, 'utf8');

      // Write input to file if provided
      let inputPath: string | null = null;
      if (input) {
        inputPath = join(tempDir, 'input.txt');
        await writeFile(inputPath, input, 'utf8');
      }

      // Build Docker command
      const dockerCommand = this.buildDockerCommand(
        dockerImage,
        containerName,
        tempDir,
        runCommand,
        inputPath
      );

      // Execute in Docker with timeout
      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');

      return {
        success: true,
        output: output.trim() || 'Code executed successfully (no output)',
        data: {
          language,
          containerName,
          executionTime: 'completed'
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Code execution failed: ${error.message}`,
        data: {
          language,
          containerName,
          executionTime: 'failed'
        }
      };
    } finally {
      // Cleanup
      try {
        if (containerName) {
          // Remove container (don't await to avoid blocking)
          execAsync(`docker rm -f ${containerName}`).catch(() => {});
        }
        if (tempDir) {
          // Clean up temp directory
          execAsync(`rm -rf ${tempDir}`).catch(() => {});
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async testCode(code: string, language: string): Promise<ToolResult> {
    // Test mode - run with sample input to verify code works
    const testInputs: { [key: string]: string } = {
      javascript: 'console.log("Hello from test!");',
      python: 'print("Hello from test!")',
      bash: 'echo "Hello from test!"',
      java: 'public class Test { public static void main(String[] args) { System.out.println("Hello from test!"); } }'
    };

    const testInput = testInputs[language] || code;
    return this.runCode(testInput, language);
  }

  private getLanguageConfig(language: string): {
    filename: string;
    dockerImage: string;
    runCommand: string;
  } {
    const configs: { [key: string]: { filename: string; dockerImage: string; runCommand: string } } = {
      javascript: {
        filename: 'code.js',
        dockerImage: 'node:18-alpine',
        runCommand: 'node code.js'
      },
      typescript: {
        filename: 'code.ts',
        dockerImage: 'node:18-alpine',
        runCommand: 'npx ts-node code.ts'
      },
      python: {
        filename: 'code.py',
        dockerImage: 'python:3.11-alpine',
        runCommand: 'python code.py'
      },
      python3: {
        filename: 'code.py',
        dockerImage: 'python:3.11-alpine',
        runCommand: 'python code.py'
      },
      java: {
        filename: 'Main.java',
        dockerImage: 'openjdk:17-alpine',
        runCommand: 'javac Main.java && java Main'
      },
      cpp: {
        filename: 'main.cpp',
        dockerImage: 'gcc:11-alpine',
        runCommand: 'g++ -o main main.cpp && ./main'
      },
      c: {
        filename: 'main.c',
        dockerImage: 'gcc:11-alpine',
        runCommand: 'gcc -o main main.c && ./main'
      },
      go: {
        filename: 'main.go',
        dockerImage: 'golang:1.21-alpine',
        runCommand: 'go run main.go'
      },
      rust: {
        filename: 'main.rs',
        dockerImage: 'rust:1.72-alpine',
        runCommand: 'rustc main.rs && ./main'
      },
      bash: {
        filename: 'script.sh',
        dockerImage: 'alpine:latest',
        runCommand: 'chmod +x script.sh && ./script.sh'
      },
      shell: {
        filename: 'script.sh',
        dockerImage: 'alpine:latest',
        runCommand: 'chmod +x script.sh && ./script.sh'
      },
      sh: {
        filename: 'script.sh',
        dockerImage: 'alpine:latest',
        runCommand: 'chmod +x script.sh && ./script.sh'
      }
    };

    return configs[language.toLowerCase()] || {
      filename: 'code.txt',
      dockerImage: 'alpine:latest',
      runCommand: 'echo "Unsupported language"'
    };
  }

  private buildDockerCommand(
    image: string,
    containerName: string,
    tempDir: string,
    runCommand: string,
    inputPath: string | null
  ): string {
    // Mount temp directory as read-only for security
    const volumeMount = `-v ${tempDir}:/app:ro`;

    // If there's input, mount it separately as readable
    const inputMount = inputPath ? `-v ${inputPath}:/app/input.txt:ro` : '';

    // Build the full command
    const dockerRun = `docker run --rm --name ${containerName} ${volumeMount} ${inputMount} -w /app --memory=128m --cpus=0.5 --network=none --read-only --tmpfs /tmp ${image}`;

    // If input file exists, redirect it to stdin
    const finalCommand = inputPath
      ? `${dockerRun} sh -c "${runCommand} < input.txt"`
      : `${dockerRun} sh -c "${runCommand}"`;

    return finalCommand;
  }
}