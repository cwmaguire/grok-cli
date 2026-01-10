import { For, Show, Switch, Match, createMemo } from "solid-js"
import { useChat } from "../context/chat.js"
import { useConfirmation } from "../context/confirmation.js"
import type { ChatEntry } from "../../agent/grok-agent.js"
import { DiffRenderer } from "./diff-renderer.js"
import { MarkdownRenderer } from "./markdown-renderer.js"

interface ChatEntryComponentProps {
  entry: ChatEntry
}

function ChatEntryComponent(props: ChatEntryComponentProps) {
  const getToolActionName = (toolName: string) => {
    // Handle MCP tools with mcp__servername__toolname format
    if (toolName.startsWith("mcp__")) {
      const parts = toolName.split("__")
      if (parts.length >= 3) {
        const serverName = parts[1]
        const actualToolName = parts.slice(2).join("__")
        return `${serverName.charAt(0).toUpperCase() + serverName.slice(1)}(${actualToolName.replace(/_/g, " ")})`
      }
    }

    switch (toolName) {
      case "view_file": return "Read"
      case "str_replace_editor": return "Update"
      case "create_file": return "Create"
      case "bash": return "Bash"
      case "search": return "Search"
      case "create_todo_list": return "Created Todo"
      case "update_todo_list": return "Updated Todo"
      default: return "Tool"
    }
  }

  const getFilePath = (toolCall: any) => {
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments)
        if (toolCall.function.name === "search") {
          return args.query
        }
        return args.path || args.file_path || args.command || ""
      } catch {
        return ""
      }
    }
    return ""
  }

  const formatToolContent = (content: string, toolName: string) => {
    if (toolName.startsWith("mcp__")) {
      try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          return `Found ${parsed.length} items`
        } else if (typeof parsed === "object") {
          return JSON.stringify(parsed, null, 2)
        }
      } catch {
        return content
      }
    }
    return content
  }

  const renderFileContent = (content: string) => {
    const lines = content.split("\n")
    
    let baseIndentation = Infinity
    for (const line of lines) {
      if (line.trim() === "") continue
      const firstCharIndex = line.search(/\S/)
      const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex
      baseIndentation = Math.min(baseIndentation, currentIndent)
    }
    if (!isFinite(baseIndentation)) {
      baseIndentation = 0
    }

    return lines.map((line) => line.substring(baseIndentation))
  }

  return (
    <Switch>
      <Match when={props.entry.type === "user"}>
        <box flexDirection="column" marginTop={1}>
          <text fg="#808080">{">"} {props.entry.content}</text>
        </box>
      </Match>

      <Match when={props.entry.type === "assistant"}>
        <box flexDirection="column" marginTop={1}>
          <box flexDirection="row">
            <text fg="#FFFFFF">⏺ </text>
            <box flexDirection="column" flexGrow={1}>
              <Show when={props.entry.toolCalls} fallback={
                <MarkdownRenderer content={props.entry.content.trim()} />
              }>
                <text fg="#FFFFFF">{props.entry.content.trim()}</text>
              </Show>
              <Show when={props.entry.isStreaming}>
                <text fg="#00FFFF">█</text>
              </Show>
            </box>
          </box>
        </box>
      </Match>

      <Match when={props.entry.type === "tool_call" || props.entry.type === "tool_result"}>
        {(() => {
          const toolName = props.entry.toolCall?.function?.name || "unknown"
          const actionName = getToolActionName(toolName)
          const filePath = getFilePath(props.entry.toolCall)
          const isExecuting = props.entry.type === "tool_call" || !props.entry.toolResult

          const shouldShowDiff = 
            props.entry.toolCall?.function?.name === "str_replace_editor" &&
            props.entry.toolResult?.success &&
            props.entry.content.includes("Updated") &&
            props.entry.content.includes("---") &&
            props.entry.content.includes("+++")

          const shouldShowFileContent =
            (props.entry.toolCall?.function?.name === "view_file" ||
              props.entry.toolCall?.function?.name === "create_file") &&
            props.entry.toolResult?.success &&
            !shouldShowDiff

          return (
            <box flexDirection="column" marginTop={1}>
              <box>
                <text fg="#FF00FF">⏺</text>
                <text fg="#FFFFFF"> {filePath ? `${actionName}(${filePath})` : actionName}</text>
              </box>
              <box marginLeft={2} flexDirection="column">
                <Show when={isExecuting} fallback={
                  <Show when={shouldShowFileContent} fallback={
                    <Show when={shouldShowDiff} fallback={
                      <text fg="#808080">⎿ {formatToolContent(props.entry.content, toolName)}</text>
                    }>
                      <text fg="#808080">⎿ {props.entry.content.split("\n")[0]}</text>
                    </Show>
                  }>
                    <box flexDirection="column">
                      <text fg="#808080">⎿ File contents:</text>
                      <box marginLeft={2} flexDirection="column">
                        <For each={renderFileContent(props.entry.content)}>
                          {(line) => <text fg="#808080">{line}</text>}
                        </For>
                      </box>
                    </box>
                  </Show>
                }>
                  <text fg="#00FFFF">⎿ Executing...</text>
                </Show>
              </box>
              <Show when={shouldShowDiff && !isExecuting}>
                <box marginLeft={4} flexDirection="column">
                  <DiffRenderer diffContent={props.entry.content} filename={filePath} />
                </box>
              </Show>
            </box>
          )
        })()}
      </Match>
    </Switch>
  )
}

export function ChatHistory() {
  const chat = useChat()
  const confirmation = useConfirmation()

  const filteredEntries = createMemo(() => {
    const entries = chat.history()
    const isConfirmationActive = !!confirmation.options()
    
    if (isConfirmationActive) {
      return entries.filter(
        (entry) => !(entry.type === "tool_call" && entry.content === "Executing...")
      )
    }
    return entries
  })

  const displayedEntries = createMemo(() => filteredEntries().slice(-20))

  return (
    <box flexDirection="column">
      <For each={displayedEntries()}>
        {(entry) => <ChatEntryComponent entry={entry} />}
      </For>
    </box>
  )
}
