import React from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/grok-agent.js";
import { DiffRenderer } from "./diff-renderer.js";
import { MarkdownRenderer } from "../utils/markdown-renderer.js";

interface ChatHistoryProps {
  entries: ChatEntry[];
  isConfirmationActive?: boolean;
}

// Memoized ChatEntry component to prevent unnecessary re-renders
const MemoizedChatEntry = React.memo(
  ({ entry, index }: { entry: ChatEntry; index: number }) => {
    const renderDiff = (diffContent: string, filename?: string) => {
      return (
        <DiffRenderer
          diffContent={diffContent}
          filename={filename}
          terminalWidth={80}
        />
      );
    };

    const renderFileContent = (content: string) => {
      const lines = content.split("\n");

      // Calculate minimum indentation like DiffRenderer does
      let baseIndentation = Infinity;
      for (const line of lines) {
        if (line.trim() === "") continue;
        const firstCharIndex = line.search(/\S/);
        const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex;
        baseIndentation = Math.min(baseIndentation, currentIndent);
      }
      if (!isFinite(baseIndentation)) {
        baseIndentation = 0;
      }

      return lines.map((line, index) => {
        const displayContent = line.substring(baseIndentation);
        return (
          <Text key={index} color="gray">
            {displayContent}
          </Text>
        );
      });
    };

    switch (entry.type) {
      case "user":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="gray">
                {">"} {entry.content}
              </Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box flexDirection="row" alignItems="flex-start">
              <Text color="white">⏺ </Text>
              <Box flexDirection="column" flexGrow={1}>
                {entry.toolCalls ? (
                  // If there are tool calls, just show plain text
                  <Text color="white">{entry.content.trim()}</Text>
                ) : (
                  // If no tool calls, render as markdown
                  <MarkdownRenderer content={entry.content.trim()} />
                )}
                {entry.isStreaming && <Text color="cyan">█</Text>}
              </Box>
            </Box>
          </Box>
        );

      case "tool_call":
      case "tool_result":
        const getToolActionName = (toolName: string) => {
          // Handle MCP tools with mcp__servername__toolname format
          if (toolName.startsWith("mcp__")) {
            const parts = toolName.split("__");
            if (parts.length >= 3) {
              const serverName = parts[1];
              const actualToolName = parts.slice(2).join("__");
              return `${serverName.charAt(0).toUpperCase() + serverName.slice(1)}(${actualToolName.replace(/_/g, " ")})`;
            }
          }

          switch (toolName) {
            case "view_file":
              return "Read";
            case "str_replace_editor":
              return "Update";
            case "create_file":
              return "Create";
            case "bash":
              return "Bash";
            case "search":
              return "Search";
            case "create_todo_list":
              return "Created Todo";
            case "update_todo_list":
              return "Updated Todo";
            default:
              return "Tool";
          }
        };

        const toolName = entry.toolCall?.function?.name || "unknown";
        const actionName = getToolActionName(toolName);

        // Extract meaningful context for each tool type
        const getToolContext = (toolCall: any): { summary: string; detail: string } => {
          if (!toolCall?.function?.arguments) {
            return { summary: "", detail: "Executing..." };
          }

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const name = toolCall.function.name;

            switch (name) {
              case "bash": {
                const cmd = args.command || "";
                const truncatedCmd = cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd;
                return { summary: "", detail: `Running: ${truncatedCmd}` };
              }
              case "view_file": {
                const range = args.start_line
                  ? ` (lines ${args.start_line}-${args.end_line || "end"})`
                  : "";
                return { summary: args.path || "", detail: `Reading${range}` };
              }
              case "str_replace_editor": {
                const oldLen = args.old_str?.length || 0;
                const newLen = args.new_str?.length || 0;
                return {
                  summary: args.path || "",
                  detail: `Replacing ${oldLen} → ${newLen} chars`
                };
              }
              case "create_file": {
                const size = args.content?.length || 0;
                return { summary: args.path || "", detail: `Creating (${size} chars)` };
              }
              case "search": {
                const query = args.query || "";
                const truncatedQuery = query.length > 40 ? query.slice(0, 40) + "..." : query;
                return { summary: "", detail: `Searching: "${truncatedQuery}"` };
              }
              case "web_search": {
                const query = args.query || "";
                const truncatedQuery = query.length > 40 ? query.slice(0, 40) + "..." : query;
                return { summary: "", detail: `Searching web: "${truncatedQuery}"` };
              }
              case "create_todo_list": {
                const count = args.todos?.length || 0;
                return { summary: "", detail: `Creating ${count} items` };
              }
              case "update_todo_list": {
                const count = args.updates?.length || 0;
                return { summary: "", detail: `Updating ${count} items` };
              }
              case "apt": {
                return { summary: "", detail: `apt ${args.operation || ""} ${args.package || ""}`.trim() };
              }
              case "systemctl": {
                return { summary: "", detail: `systemctl ${args.operation || ""} ${args.service || ""}`.trim() };
              }
              case "disk": {
                return { summary: "", detail: `disk ${args.operation || ""} ${args.path || ""}`.trim() };
              }
              case "network": {
                return { summary: "", detail: `network ${args.operation || ""} ${args.host || ""}`.trim() };
              }
              case "code_execution": {
                const lang = args.language || "code";
                const preview = args.code?.slice(0, 30) || "";
                return { summary: "", detail: `Running ${lang}: ${preview}...` };
              }
              default:
                // Fallback: try to extract common fields
                const path = args.path || args.file_path || "";
                const query = args.query || "";
                const command = args.command || "";
                if (query) {
                  return { summary: "", detail: `Query: "${query.slice(0, 40)}"` };
                }
                if (command) {
                  return { summary: "", detail: `Running: ${command.slice(0, 50)}` };
                }
                return { summary: path, detail: "Executing..." };
            }
          } catch {
            return { summary: "", detail: "Executing..." };
          }
        };

        const { summary: filePath, detail: executingDetail } = getToolContext(entry.toolCall);
        const isExecuting = entry.type === "tool_call" || !entry.toolResult;
        
        // Format JSON content for better readability
        const formatToolContent = (content: string, toolName: string) => {
          if (toolName.startsWith("mcp__")) {
            try {
              // Try to parse as JSON and format it
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                // For arrays, show a summary instead of full JSON
                return `Found ${parsed.length} items`;
              } else if (typeof parsed === 'object') {
                // For objects, show a formatted version
                return JSON.stringify(parsed, null, 2);
              }
            } catch {
              // If not JSON, return as is
              return content;
            }
          }
          return content;
        };
        const shouldShowDiff =
          entry.toolCall?.function?.name === "str_replace_editor" &&
          entry.toolResult?.success &&
          entry.content.includes("Updated") &&
          entry.content.includes("---") &&
          entry.content.includes("+++");

        const shouldShowFileContent =
          (entry.toolCall?.function?.name === "view_file" ||
            entry.toolCall?.function?.name === "create_file") &&
          entry.toolResult?.success &&
          !shouldShowDiff;

        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="magenta">⏺</Text>
              <Text color="white">
                {" "}
                {filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
            </Box>
            <Box marginLeft={2} flexDirection="column">
              {isExecuting ? (
                <Text color="cyan">⎿ {executingDetail}</Text>
              ) : shouldShowFileContent ? (
                <Box flexDirection="column">
                  <Text color="gray">⎿ File contents:</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderFileContent(entry.content)}
                  </Box>
                </Box>
              ) : shouldShowDiff ? (
                // For diff results, show only the summary line, not the raw content
                <Text color="gray">⎿ {entry.content.split("\n")[0]}</Text>
              ) : (
                <Text color="gray">⎿ {formatToolContent(entry.content, toolName)}</Text>
              )}
            </Box>
            {shouldShowDiff && !isExecuting && (
              <Box marginLeft={4} flexDirection="column">
                {renderDiff(entry.content, filePath)}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  }
);

MemoizedChatEntry.displayName = "MemoizedChatEntry";

export function ChatHistory({
  entries,
  isConfirmationActive = false,
}: ChatHistoryProps) {
  // Filter out tool_call entries with "Executing..." when confirmation is active
  const filteredEntries = isConfirmationActive
    ? entries.filter(
        (entry) =>
          !(entry.type === "tool_call" && entry.content === "Executing...")
      )
    : entries;

  return (
    <Box flexDirection="column">
      {filteredEntries.slice(-20).map((entry, index) => (
        <MemoizedChatEntry
          key={`${entry.timestamp.getTime()}-${index}`}
          entry={entry}
          index={index}
        />
      ))}
    </Box>
  );
}
