#!/usr/bin/env bun
import * as dotenv from "dotenv"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { GrokAgent } from "./agent/grok-agent.js"
import { startTUI } from "./tui/app.js"
import { getSettingsManager } from "./utils/settings-manager.js"
import { ConfirmationService } from "./utils/confirmation-service.js"
import type { ChatCompletionMessageParam } from "openai/resources/chat"

// Load environment variables
dotenv.config()

// Handle process signals
process.on("SIGTERM", () => {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(false)
    } catch {
      // Ignore errors when setting raw mode
    }
  }
  console.log("\nGracefully shutting down...")
  process.exit(0)
})

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason)
  process.exit(1)
})

// Ensure user settings are initialized
function ensureUserSettingsDirectory(): void {
  try {
    const manager = getSettingsManager()
    manager.loadUserSettings()
  } catch {
    // Silently ignore errors during setup
  }
}

// Load API key from user settings if not in environment
function loadApiKey(): string | undefined {
  const manager = getSettingsManager()
  return manager.getApiKey()
}

// Load base URL from user settings if not in environment
function loadBaseURL(): string {
  const manager = getSettingsManager()
  return manager.getBaseURL()
}

// Save command line settings to user settings file
async function saveCommandLineSettings(apiKey?: string, baseURL?: string): Promise<void> {
  try {
    const manager = getSettingsManager()

    if (apiKey) {
      manager.updateUserSetting("apiKey", apiKey)
      console.log("✅ API key saved to ~/.grok/user-settings.json")
    }
    if (baseURL) {
      manager.updateUserSetting("baseURL", baseURL)
      console.log("✅ Base URL saved to ~/.grok/user-settings.json")
    }
  } catch (error) {
    console.warn(
      "⚠️ Could not save settings to file:",
      error instanceof Error ? error.message : "Unknown error"
    )
  }
}

// Load model from user settings if not in environment
function loadModel(): string | undefined {
  let model = process.env.GROK_MODEL

  if (!model) {
    try {
      const manager = getSettingsManager()
      model = manager.getCurrentModel()
    } catch {
      // Ignore errors, model will remain undefined
    }
  }

  return model
}

// Handle commit-and-push command in headless mode
async function handleCommitAndPushHeadless(
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  try {
    const agent = new GrokAgent(apiKey, baseURL, model, maxToolRounds)

    const confirmationService = ConfirmationService.getInstance()
    confirmationService.setSessionFlag("allOperations", true)

    console.log("🤖 Processing commit and push...\n")
    console.log("> /commit-and-push\n")

    const initialStatusResult = await agent.executeBashCommand("git status --porcelain")

    if (!initialStatusResult.success || !initialStatusResult.output?.trim()) {
      console.log("❌ No changes to commit. Working directory is clean.")
      process.exit(1)
    }

    console.log("✅ git status: Changes detected")

    const addResult = await agent.executeBashCommand("git add .")

    if (!addResult.success) {
      console.log(`❌ git add: ${addResult.error || "Failed to stage changes"}`)
      process.exit(1)
    }

    console.log("✅ git add: Changes staged")

    const diffResult = await agent.executeBashCommand("git diff --cached")

    const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`

    console.log("🤖 Generating commit message...")

    const commitMessageEntries = await agent.processUserMessage(commitPrompt)
    let commitMessage = ""

    for (const entry of commitMessageEntries) {
      if (entry.type === "assistant" && entry.content.trim()) {
        commitMessage = entry.content.trim()
        break
      }
    }

    if (!commitMessage) {
      console.log("❌ Failed to generate commit message")
      process.exit(1)
    }

    const cleanCommitMessage = commitMessage.replace(/^["']|["']$/g, "")
    console.log(`✅ Generated commit message: "${cleanCommitMessage}"`)

    const commitCommand = `git commit -m "${cleanCommitMessage}"`
    const commitResult = await agent.executeBashCommand(commitCommand)

    if (commitResult.success) {
      console.log(`✅ git commit: ${commitResult.output?.split("\n")[0] || "Commit successful"}`)

      let pushResult = await agent.executeBashCommand("git push")

      if (!pushResult.success && pushResult.error?.includes("no upstream branch")) {
        console.log("🔄 Setting upstream and pushing...")
        pushResult = await agent.executeBashCommand("git push -u origin HEAD")
      }

      if (pushResult.success) {
        console.log(`✅ git push: ${pushResult.output?.split("\n")[0] || "Push successful"}`)
      } else {
        console.log(`❌ git push: ${pushResult.error || "Push failed"}`)
        process.exit(1)
      }
    } else {
      console.log(`❌ git commit: ${commitResult.error || "Commit failed"}`)
      process.exit(1)
    }
  } catch (error: any) {
    console.error("❌ Error during commit and push:", error.message)
    process.exit(1)
  }
}

// Headless mode processing function
async function processPromptHeadless(
  prompt: string,
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  try {
    const agent = new GrokAgent(apiKey, baseURL, model, maxToolRounds)

    const confirmationService = ConfirmationService.getInstance()
    confirmationService.setSessionFlag("allOperations", true)

    const chatEntries = await agent.processUserMessage(prompt)

    const messages: ChatCompletionMessageParam[] = []

    for (const entry of chatEntries) {
      switch (entry.type) {
        case "user":
          messages.push({ role: "user", content: entry.content })
          break

        case "assistant":
          const assistantMessage: ChatCompletionMessageParam = {
            role: "assistant",
            content: entry.content,
          }

          if (entry.toolCalls && entry.toolCalls.length > 0) {
            assistantMessage.tool_calls = entry.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            }))
          }

          messages.push(assistantMessage)
          break

        case "tool_result":
          if (entry.toolCall) {
            messages.push({
              role: "tool",
              tool_call_id: entry.toolCall.id,
              content: entry.content,
            })
          }
          break
      }
    }

    for (const message of messages) {
      console.log(JSON.stringify(message))
    }
  } catch (error: any) {
    console.log(
      JSON.stringify({
        role: "assistant",
        content: `Error: ${error.message}`,
      })
    )
    process.exit(1)
  }
}

// Main CLI
const argv = await yargs(hideBin(process.argv))
  .scriptName("grok")
  .usage("$0 [message...]", "A conversational AI CLI tool powered by Grok with text editor capabilities")
  .positional("message", {
    describe: "Initial message to send to Grok",
    type: "string",
    array: true,
  })
  .option("directory", {
    alias: "d",
    type: "string",
    description: "Set working directory",
    default: process.cwd(),
  })
  .option("api-key", {
    alias: "k",
    type: "string",
    description: "Grok API key (or set GROK_API_KEY env var)",
  })
  .option("base-url", {
    alias: "u",
    type: "string",
    description: "Grok API base URL (or set GROK_BASE_URL env var)",
  })
  .option("model", {
    alias: "m",
    type: "string",
    description: "AI model to use (e.g., grok-code-fast-1, grok-4-latest)",
  })
  .option("prompt", {
    alias: "p",
    type: "string",
    description: "Process a single prompt and exit (headless mode)",
  })
  .option("max-tool-rounds", {
    type: "number",
    description: "Maximum number of tool execution rounds",
    default: 400,
  })
  .command(
    "git commit-and-push",
    "Generate AI commit message and push to remote",
    (yargs) =>
      yargs
        .option("directory", {
          alias: "d",
          type: "string",
          description: "Set working directory",
          default: process.cwd(),
        })
        .option("api-key", {
          alias: "k",
          type: "string",
          description: "Grok API key",
        })
        .option("base-url", {
          alias: "u",
          type: "string",
          description: "Grok API base URL",
        })
        .option("model", {
          alias: "m",
          type: "string",
          description: "AI model to use",
        })
        .option("max-tool-rounds", {
          type: "number",
          description: "Maximum number of tool execution rounds",
          default: 400,
        }),
    async (argv) => {
      if (argv.directory) {
        try {
          process.chdir(argv.directory)
        } catch (error: any) {
          console.error(`Error changing directory to ${argv.directory}:`, error.message)
          process.exit(1)
        }
      }

      const apiKey = argv.apiKey || loadApiKey()
      const baseURL = argv.baseUrl || loadBaseURL()
      const model = argv.model || loadModel()
      const maxToolRounds = argv.maxToolRounds || 400

      if (!apiKey) {
        console.error(
          '❌ Error: API key required. Set GROK_API_KEY environment variable, use --api-key flag, or set "apiKey" field in ~/.grok/user-settings.json'
        )
        process.exit(1)
      }

      if (argv.apiKey || argv.baseUrl) {
        await saveCommandLineSettings(argv.apiKey, argv.baseUrl)
      }

      await handleCommitAndPushHeadless(apiKey, baseURL, model, maxToolRounds)
    }
  )
  .command(
    "mcp",
    "MCP (Model Context Protocol) operations",
    (yargs) =>
      yargs
        .command("list", "List MCP servers and tools", {}, async () => {
          const { listMCPServers } = await import("./commands/mcp.js")
          await listMCPServers()
          process.exit(0)
        })
        .command(
          "add <server>",
          "Add an MCP server",
          (yargs) => yargs.positional("server", { type: "string", demandOption: true }),
          async (argv) => {
            const { addMCPServerCmd } = await import("./commands/mcp.js")
            await addMCPServerCmd(argv.server as string)
            process.exit(0)
          }
        )
        .command(
          "remove <server>",
          "Remove an MCP server",
          (yargs) => yargs.positional("server", { type: "string", demandOption: true }),
          async (argv) => {
            const { removeMCPServerCmd } = await import("./commands/mcp.js")
            await removeMCPServerCmd(argv.server as string)
            process.exit(0)
          }
        )
        .command(
          "test <server>",
          "Test connection to an MCP server",
          (yargs) => yargs.positional("server", { type: "string", demandOption: true }),
          async (argv) => {
            const { createMCPCommand } = await import("./commands/mcp.js")
            await createMCPCommand().parseAsync(["test", argv.server as string])
            process.exit(0)
          }
        )
        .demandCommand(1, "Please specify a subcommand")
  )
  .help()
  .version("1.0.1")
  .parse()

// Main execution
const args = argv as any

// Handle directory change
if (args.directory && args.directory !== process.cwd()) {
  try {
    process.chdir(args.directory)
  } catch (error: any) {
    console.error(`Error changing directory to ${args.directory}:`, error.message)
    process.exit(1)
  }
}

// Skip main processing if a subcommand was executed
if (args._ && args._[0]) {
  // Subcommand was handled
} else {
  // Get API key from options, environment, or user settings
  const apiKey = args.apiKey || loadApiKey()
  const baseURL = args.baseUrl || loadBaseURL()
  const model = args.model || loadModel()
  const maxToolRounds = args.maxToolRounds || 400

  // Save API key and base URL to user settings if provided via command line
  if (args.apiKey || args.baseUrl) {
    await saveCommandLineSettings(args.apiKey, args.baseUrl)
  }

  // Headless mode: process prompt and exit
  if (args.prompt) {
    if (!apiKey) {
      console.error(
        '❌ Error: API key required. Set GROK_API_KEY environment variable, use --api-key flag, or set "apiKey" field in ~/.grok/user-settings.json'
      )
      process.exit(1)
    }
    await processPromptHeadless(args.prompt, apiKey, baseURL, model, maxToolRounds)
  } else {
    // Interactive mode: launch TUI
    ensureUserSettingsDirectory()

    // Support variadic positional arguments for multi-word initial message
    const initialMessage = Array.isArray(args._) && args._.length > 0
      ? args._.join(" ")
      : undefined

    console.log("🤖 Starting Grok CLI Conversational Assistant...\n")

    if (apiKey) {
      const agent = new GrokAgent(apiKey, baseURL, model, maxToolRounds)
      startTUI(agent, initialMessage)
    } else {
      startTUI(undefined, initialMessage)
    }
  }
}
