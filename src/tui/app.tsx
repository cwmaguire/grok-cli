import { render, useKeyboard } from "@opentui/solid"
import { Show, createSignal, createEffect, onCleanup, createMemo, batch } from "solid-js"
import cfonts from "cfonts"
import { GrokAgent, type ChatEntry } from "../agent/grok-agent.js"
import { ConfirmationService } from "../utils/confirmation-service.js"
import { loadModelConfig, updateCurrentModel } from "../utils/model-config.js"
import {
  AgentProvider,
  ChatProvider,
  ConfirmationProvider,
  InputProvider,
  useAgent,
  useChat,
  useConfirmation,
  useInput,
} from "./context/index.js"
import {
  ChatInput,
  ChatHistory,
  LoadingSpinner,
  ConfirmationDialog,
  CommandSuggestions,
  ModelSelection,
  MCPStatus,
  ApiKeyInput,
  filterCommandSuggestions,
  type CommandSuggestion,
  type ModelOption,
} from "./components/index.js"

// Tips component
function Tips() {
  return (
    <box flexDirection="column" marginBottom={2}>
      <text fg="#00FFFF">
        Tips for getting started:
      </text>
      <box marginTop={1} flexDirection="column">
        <text fg="#808080">1. Ask questions, edit files, or run commands.</text>
        <text fg="#808080">2. Be specific for the best results.</text>
        <text fg="#808080">3. Create GROK.md files to customize your interactions with Grok.</text>
        <text fg="#808080">4. Press Shift+Tab to toggle auto-edit mode.</text>
        <text fg="#808080">5. /help for more information.</text>
      </box>
    </box>
  )
}

// Status bar component
function StatusBar() {
  const agent = useAgent()
  const confirmation = useConfirmation()

  return (
    <box flexDirection="row" marginTop={1}>
      <box marginRight={2}>
        <text fg="#00FFFF">
          {confirmation.autoEditEnabled() ? "▶" : "⏸"} auto-edit:{" "}
          {confirmation.autoEditEnabled() ? "on" : "off"}
        </text>
        <text fg="#808080"> (shift + tab)</text>
      </box>
      <box marginRight={2}>
        <text fg="#FFFF00">≋ {agent.getCurrentModel()}</text>
      </box>
      <MCPStatus />
    </box>
  )
}

// Main chat interface component
function ChatInterface(props: { initialMessage?: string }) {
  const agent = useAgent()
  const chat = useChat()
  const confirmation = useConfirmation()
  const inputState = useInput()

  const [showCommandSuggestions, setShowCommandSuggestions] = createSignal(false)
  const [selectedCommandIndex, setSelectedCommandIndex] = createSignal(0)
  const [showModelSelection, setShowModelSelection] = createSignal(false)
  const [selectedModelIndex, setSelectedModelIndex] = createSignal(0)

  const commandSuggestions: CommandSuggestion[] = [
    { command: "/help", description: "Show help information" },
    { command: "/clear", description: "Clear chat history" },
    { command: "/models", description: "Switch Grok Model" },
    { command: "/commit-and-push", description: "AI commit & push to remote" },
    { command: "/exit", description: "Exit the application" },
  ]

  const availableModels: ModelOption[] = loadModelConfig()

  // Show logo on start
  createEffect(() => {
    const isWindows = process.platform === "win32"
    const isPowerShell =
      process.env.ComSpec?.toLowerCase().includes("powershell") ||
      process.env.PSModulePath !== undefined

    if (!isWindows || !isPowerShell) {
      console.clear()
    }

    console.log("    ")

    const logoOutput = cfonts.render("GROK", {
      font: "3d",
      align: "left",
      colors: ["magenta", "gray"],
      space: true,
      maxLength: "0",
      gradient: ["magenta", "cyan"],
      independentGradient: false,
      transitionGradient: true,
      env: "node",
    })

    const logoLines = (logoOutput as any).string.split("\n")
    logoLines.forEach((line: string) => {
      if (line.trim()) {
        console.log(" " + line)
      } else {
        console.log(line)
      }
    })

    console.log(" ")
  })

  // Process initial message
  createEffect(() => {
    if (props.initialMessage && agent) {
      processUserMessage(props.initialMessage)
    }
  })

  // Update command suggestions based on input
  createEffect(() => {
    const input = inputState.input()
    if (input.startsWith("/")) {
      setShowCommandSuggestions(true)
      setSelectedCommandIndex(0)
    } else {
      setShowCommandSuggestions(false)
      setSelectedCommandIndex(0)
    }
  })

  const processUserMessage = async (userInput: string) => {
    const userEntry: ChatEntry = {
      type: "user",
      content: userInput,
      timestamp: new Date(),
    }
    chat.addEntry(userEntry)

    chat.setIsProcessing(true)
    inputState.clearInput()

    try {
      chat.setIsStreaming(true)
      let streamingEntry: ChatEntry | null = null

      for await (const chunk of agent.processUserMessageStream(userInput)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content) {
              if (!streamingEntry) {
                const newStreamingEntry: ChatEntry = {
                  type: "assistant",
                  content: chunk.content,
                  timestamp: new Date(),
                  isStreaming: true,
                }
                chat.addEntry(newStreamingEntry)
                streamingEntry = newStreamingEntry
              } else {
                chat.updateLastEntry((entry) =>
                  entry.isStreaming
                    ? { ...entry, content: entry.content + chunk.content }
                    : entry
                )
              }
            }
            break

          case "token_count":
            if (chunk.tokenCount !== undefined) {
              chat.setTokenCount(chunk.tokenCount)
            }
            break

          case "tool_calls":
            if (chunk.toolCalls) {
              chat.setHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming
                    ? { ...entry, isStreaming: false, toolCalls: chunk.toolCalls }
                    : entry
                )
              )
              streamingEntry = null

              chunk.toolCalls.forEach((toolCall) => {
                const toolCallEntry: ChatEntry = {
                  type: "tool_call",
                  content: "Executing...",
                  timestamp: new Date(),
                  toolCall: toolCall,
                }
                chat.addEntry(toolCallEntry)
              })
            }
            break

          case "tool_result":
            if (chunk.toolCall && chunk.toolResult) {
              chat.setHistory((prev) =>
                prev.map((entry) => {
                  if (entry.isStreaming) {
                    return { ...entry, isStreaming: false }
                  }
                  if (
                    entry.type === "tool_call" &&
                    entry.toolCall?.id === chunk.toolCall?.id
                  ) {
                    return {
                      ...entry,
                      type: "tool_result",
                      content: chunk.toolResult.success
                        ? chunk.toolResult.output || "Success"
                        : chunk.toolResult.error || "Error occurred",
                      toolResult: chunk.toolResult,
                    }
                  }
                  return entry
                })
              )
              streamingEntry = null
            }
            break

          case "done":
            if (streamingEntry) {
              chat.setHistory((prev) =>
                prev.map((entry) =>
                  entry.isStreaming ? { ...entry, isStreaming: false } : entry
                )
              )
            }
            chat.setIsStreaming(false)
            break
        }
      }
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      }
      chat.addEntry(errorEntry)
      chat.setIsStreaming(false)
    }

    chat.setIsProcessing(false)
  }

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim()

    if (trimmedInput === "/clear") {
      chat.clearHistory()
      ConfirmationService.getInstance().resetSession()
      inputState.clearInput()
      return true
    }

    if (trimmedInput === "/help") {
      const helpEntry: ChatEntry = {
        type: "assistant",
        content: `Grok CLI Help:

Built-in Commands:
  /clear      - Clear chat history
  /help       - Show this help
  /models     - Switch between available models
  /exit       - Exit application
  exit, quit  - Exit application

Git Commands:
  /commit-and-push - AI-generated commit + push to remote

Enhanced Input Features:
  ↑/↓ Arrow   - Navigate command history
  Ctrl+C      - Clear input (press twice to exit)
  Ctrl+←/→    - Move by word
  Ctrl+A/E    - Move to line start/end
  Ctrl+W      - Delete word before cursor
  Ctrl+K      - Delete to end of line
  Ctrl+U      - Delete to start of line
  Shift+Tab   - Toggle auto-edit mode (bypass confirmations)

Direct Commands (executed immediately):
  ls [path]   - List directory contents
  pwd         - Show current directory
  cd <path>   - Change directory
  cat <file>  - View file contents
  mkdir <dir> - Create directory
  touch <file>- Create empty file

Model Configuration:
  Edit ~/.grok/models.json to add custom models (Claude, GPT, Gemini, etc.)

For complex operations, just describe what you want in natural language.`,
        timestamp: new Date(),
      }
      chat.addEntry(helpEntry)
      inputState.clearInput()
      return true
    }

    if (trimmedInput === "/exit") {
      process.exit(0)
      return true
    }

    if (trimmedInput === "/models") {
      setShowModelSelection(true)
      setSelectedModelIndex(0)
      inputState.clearInput()
      return true
    }

    if (trimmedInput.startsWith("/models ")) {
      const modelArg = trimmedInput.split(" ")[1]
      const modelNames = availableModels.map((m) => m.model)

      if (modelNames.includes(modelArg)) {
        agent.setModel(modelArg)
        updateCurrentModel(modelArg)
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✓ Switched to model: ${modelArg}`,
          timestamp: new Date(),
        }
        chat.addEntry(confirmEntry)
      } else {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Invalid model: ${modelArg}\n\nAvailable models: ${modelNames.join(", ")}`,
          timestamp: new Date(),
        }
        chat.addEntry(errorEntry)
      }

      inputState.clearInput()
      return true
    }

    if (trimmedInput === "/commit-and-push") {
      const userEntry: ChatEntry = {
        type: "user",
        content: "/commit-and-push",
        timestamp: new Date(),
      }
      chat.addEntry(userEntry)
      chat.setIsProcessing(true)
      chat.setIsStreaming(true)

      try {
        const initialStatusResult = await agent.executeBashCommand("git status --porcelain")

        if (!initialStatusResult.success || !initialStatusResult.output?.trim()) {
          const noChangesEntry: ChatEntry = {
            type: "assistant",
            content: "No changes to commit. Working directory is clean.",
            timestamp: new Date(),
          }
          chat.addEntry(noChangesEntry)
          chat.setIsProcessing(false)
          chat.setIsStreaming(false)
          inputState.clearInput()
          return true
        }

        const addResult = await agent.executeBashCommand("git add .")
        if (!addResult.success) {
          const addErrorEntry: ChatEntry = {
            type: "assistant",
            content: `Failed to stage changes: ${addResult.error || "Unknown error"}`,
            timestamp: new Date(),
          }
          chat.addEntry(addErrorEntry)
          chat.setIsProcessing(false)
          chat.setIsStreaming(false)
          inputState.clearInput()
          return true
        }

        const diffResult = await agent.executeBashCommand("git diff --cached")
        const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`

        let commitMessage = ""
        for await (const chunk of agent.processUserMessageStream(commitPrompt)) {
          if (chunk.type === "content" && chunk.content) {
            commitMessage += chunk.content
          } else if (chunk.type === "done") {
            break
          }
        }

        const cleanCommitMessage = commitMessage.trim().replace(/^["']|["']$/g, "")
        const commitCommand = `git commit -m "${cleanCommitMessage}"`
        const commitResult = await agent.executeBashCommand(commitCommand)

        const commitEntry: ChatEntry = {
          type: "tool_result",
          content: commitResult.success
            ? commitResult.output || "Commit successful"
            : commitResult.error || "Commit failed",
          timestamp: new Date(),
          toolCall: {
            id: `git_commit_${Date.now()}`,
            type: "function",
            function: { name: "bash", arguments: JSON.stringify({ command: commitCommand }) },
          },
          toolResult: commitResult,
        }
        chat.addEntry(commitEntry)

        if (commitResult.success) {
          let pushResult = await agent.executeBashCommand("git push")
          let pushCommand = "git push"

          if (!pushResult.success && pushResult.error?.includes("no upstream branch")) {
            pushCommand = "git push -u origin HEAD"
            pushResult = await agent.executeBashCommand(pushCommand)
          }

          const pushEntry: ChatEntry = {
            type: "tool_result",
            content: pushResult.success
              ? pushResult.output || "Push successful"
              : pushResult.error || "Push failed",
            timestamp: new Date(),
            toolCall: {
              id: `git_push_${Date.now()}`,
              type: "function",
              function: { name: "bash", arguments: JSON.stringify({ command: pushCommand }) },
            },
            toolResult: pushResult,
          }
          chat.addEntry(pushEntry)
        }
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error during commit and push: ${error.message}`,
          timestamp: new Date(),
        }
        chat.addEntry(errorEntry)
      }

      chat.setIsProcessing(false)
      chat.setIsStreaming(false)
      inputState.clearInput()
      return true
    }

    // Direct bash commands
    const directBashCommands = ["ls", "pwd", "cd", "cat", "mkdir", "touch", "echo", "grep", "find", "cp", "mv", "rm"]
    const firstWord = trimmedInput.split(" ")[0]

    if (directBashCommands.includes(firstWord)) {
      const userEntry: ChatEntry = {
        type: "user",
        content: trimmedInput,
        timestamp: new Date(),
      }
      chat.addEntry(userEntry)

      try {
        const result = await agent.executeBashCommand(trimmedInput)

        const commandEntry: ChatEntry = {
          type: "tool_result",
          content: result.success ? result.output || "Command completed" : result.error || "Command failed",
          timestamp: new Date(),
          toolCall: {
            id: `bash_${Date.now()}`,
            type: "function",
            function: { name: "bash", arguments: JSON.stringify({ command: trimmedInput }) },
          },
          toolResult: result,
        }
        chat.addEntry(commandEntry)
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${error.message}`,
          timestamp: new Date(),
        }
        chat.addEntry(errorEntry)
      }

      inputState.clearInput()
      return true
    }

    return false
  }

  const handleSubmit = async () => {
    const userInput = inputState.input().trim()

    if (userInput === "exit" || userInput === "quit") {
      process.exit(0)
      return
    }

    if (userInput) {
      inputState.addToHistory(userInput)
      const directCommandResult = await handleDirectCommand(userInput)
      if (!directCommandResult) {
        await processUserMessage(userInput)
      }
    }
  }

  // Keyboard handler
  useKeyboard((key) => {
    // Don't handle input if confirmation dialog is active
    if (confirmation.options()) {
      return
    }

    // Handle Ctrl+C
    if (key.ctrl && key.name === "c") {
      if (inputState.input()) {
        inputState.clearInput()
      } else {
        process.exit(0)
      }
      return
    }

    // Handle Shift+Tab to toggle auto-edit
    if (key.shift && key.name === "tab") {
      confirmation.toggleAutoEdit()
      return
    }

    // Handle escape
    if (key.name === "escape") {
      if (showCommandSuggestions()) {
        setShowCommandSuggestions(false)
        setSelectedCommandIndex(0)
        return
      }
      if (showModelSelection()) {
        setShowModelSelection(false)
        setSelectedModelIndex(0)
        return
      }
      if (chat.isProcessing() || chat.isStreaming()) {
        agent.abortCurrentOperation()
        chat.setIsProcessing(false)
        chat.setIsStreaming(false)
        chat.setTokenCount(0)
        chat.setProcessingTime(0)
        return
      }
    }

    // Handle command suggestions navigation
    if (showCommandSuggestions()) {
      const filteredSuggestions = filterCommandSuggestions(commandSuggestions, inputState.input())

      if (filteredSuggestions.length === 0) {
        setShowCommandSuggestions(false)
        setSelectedCommandIndex(0)
      } else {
        if (key.name === "up") {
          setSelectedCommandIndex((prev) =>
            prev === 0 ? filteredSuggestions.length - 1 : prev - 1
          )
          return
        }
        if (key.name === "down") {
          setSelectedCommandIndex((prev) => (prev + 1) % filteredSuggestions.length)
          return
        }
        if (key.name === "tab" || key.name === "return") {
          const safeIndex = Math.min(selectedCommandIndex(), filteredSuggestions.length - 1)
          const selectedCommand = filteredSuggestions[safeIndex]
          const newInput = selectedCommand.command + " "
          inputState.setInput(newInput)
          inputState.setCursorPosition(newInput.length)
          setShowCommandSuggestions(false)
          setSelectedCommandIndex(0)
          return
        }
      }
    }

    // Handle model selection navigation
    if (showModelSelection()) {
      if (key.name === "up") {
        setSelectedModelIndex((prev) =>
          prev === 0 ? availableModels.length - 1 : prev - 1
        )
        return
      }
      if (key.name === "down") {
        setSelectedModelIndex((prev) => (prev + 1) % availableModels.length)
        return
      }
      if (key.name === "tab" || key.name === "return") {
        const selectedModel = availableModels[selectedModelIndex()]
        agent.setModel(selectedModel.model)
        updateCurrentModel(selectedModel.model)
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✓ Switched to model: ${selectedModel.model}`,
          timestamp: new Date(),
        }
        chat.addEntry(confirmEntry)
        setShowModelSelection(false)
        setSelectedModelIndex(0)
        return
      }
    }

    // Handle Enter
    if (key.name === "return") {
      handleSubmit()
      return
    }

    // Handle arrow keys for history
    if (key.name === "up" && !key.ctrl) {
      inputState.handleUp()
      return
    }
    if (key.name === "down" && !key.ctrl) {
      inputState.handleDown()
      return
    }

    // Handle cursor movement
    if (key.name === "left") {
      inputState.handleLeft(key.ctrl)
      return
    }
    if (key.name === "right") {
      inputState.handleRight(key.ctrl)
      return
    }

    // Handle Home/End
    if (key.ctrl && key.name === "a") {
      inputState.handleHome()
      return
    }
    if (key.ctrl && key.name === "e") {
      inputState.handleEnd()
      return
    }

    // Handle deletion
    if (key.name === "backspace") {
      inputState.handleBackspace(key.ctrl)
      return
    }
    if (key.name === "delete" || (key.ctrl && key.name === "d")) {
      inputState.handleDelete(key.ctrl)
      return
    }

    // Handle Ctrl+K, Ctrl+U, Ctrl+W
    if (key.ctrl && key.name === "k") {
      inputState.handleKillLine()
      return
    }
    if (key.ctrl && key.name === "u") {
      inputState.handleKillLineBack()
      return
    }
    if (key.ctrl && key.name === "w") {
      inputState.handleKillWord()
      return
    }

    // Handle regular character input
    if (key.sequence && !key.ctrl && !key.meta) {
      inputState.insertAtCursor(key.sequence)
    }
  })

  const showTips = createMemo(() => chat.history().length === 0 && !confirmation.options())

  return (
    <box flexDirection="column" padding={2}>
      <Show when={showTips()}>
        <Tips />
      </Show>

      <box flexDirection="column" marginBottom={1}>
        <text fg="#808080">
          Type your request in natural language. Ctrl+C to clear, 'exit' to quit.
        </text>
      </box>

      <box flexDirection="column">
        <ChatHistory />
      </box>

      <Show when={confirmation.options()}>
        <ConfirmationDialog />
      </Show>

      <Show when={!confirmation.options()}>
        <LoadingSpinner />

        <ChatInput />

        <StatusBar />

        <CommandSuggestions
          suggestions={commandSuggestions}
          input={inputState.input()}
          selectedIndex={selectedCommandIndex()}
          isVisible={showCommandSuggestions()}
        />

        <ModelSelection
          models={availableModels}
          selectedIndex={selectedModelIndex()}
          isVisible={showModelSelection()}
          currentModel={agent.getCurrentModel()}
        />
      </Show>
    </box>
  )
}

// Main app with providers
function App(props: { agent: GrokAgent; initialMessage?: string }) {
  return (
    <AgentProvider agent={props.agent}>
      <ChatProvider>
        <ConfirmationProvider>
          <InputProvider>
            <ChatInterface initialMessage={props.initialMessage} />
          </InputProvider>
        </ConfirmationProvider>
      </ChatProvider>
    </AgentProvider>
  )
}

// App with API key input
function AppWithApiKeyInput(props: { initialMessage?: string }) {
  const [agent, setAgent] = createSignal<GrokAgent | null>(null)

  return (
    <Show when={agent()} fallback={<ApiKeyInput onApiKeySet={setAgent} />}>
      {(currentAgent) => (
        <App agent={currentAgent()} initialMessage={props.initialMessage} />
      )}
    </Show>
  )
}

// Export the render function
export function startTUI(agent?: GrokAgent, initialMessage?: string) {
  if (agent) {
    render(() => <App agent={agent} initialMessage={initialMessage} />)
  } else {
    render(() => <AppWithApiKeyInput initialMessage={initialMessage} />)
  }
}
