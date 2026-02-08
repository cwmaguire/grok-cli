# Grok CLI - Project Instructions

## Project Overview

Grok CLI (`@vibe-kit/grok-cli`) is a terminal-based conversational AI agent powered by xAI's Grok models. It provides an interactive TUI built with React/Ink that supports file editing, bash execution, search, and extensibility via MCP (Model Context Protocol) servers.

## Tech Stack

- **Language:** TypeScript 5.3, targeting ES2022
- **Runtime:** Node.js 18+
- **UI framework:** React 18 + Ink 4 (terminal rendering)
- **API client:** OpenAI SDK (OpenAI-compatible interface to xAI's API)
- **CLI framework:** Commander
- **Module system:** ESM (`"type": "module"` in package.json)
- **Package manager:** npm

## Common Commands

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript (tsc -> dist/)
npm run typecheck        # Type check without emitting
npm run lint             # ESLint
npm run dev:node         # Run from source with tsx
npm run start            # Run compiled output
```

## Verification

After making changes, always run:

```bash
npm run typecheck && npm run lint
```

## Project Structure

```
src/
├── index.ts              # CLI entry point (Commander setup, process handlers)
├── agent/                # Core AI agent logic
│   └── grok-agent.ts     # GrokAgent class - orchestrates tool execution loop
├── grok/                 # Grok API client layer
│   ├── client.ts         # GrokClient - OpenAI SDK wrapper for xAI
│   └── tools.ts          # Tool definitions (function schemas for the LLM)
├── tools/                # Tool implementations
│   ├── index.ts          # Barrel exports
│   ├── bash.ts           # Bash command execution
│   ├── text-editor.ts    # File viewing/editing (str_replace pattern)
│   ├── morph-editor.ts   # Morph Fast Apply integration
│   ├── search.ts         # File/content search (ripgrep)
│   ├── todo-tool.ts      # Todo list management
│   └── confirmation-tool.ts  # User confirmation dialogs
├── mcp/                  # Model Context Protocol integration
│   ├── client.ts         # MCPManager - manages server connections
│   ├── config.ts         # MCP config loading/saving
│   └── transports.ts     # Transport implementations (stdio, HTTP, SSE)
├── hooks/                # React hooks for terminal UI
│   ├── use-input-handler.ts   # Main input handling
│   ├── use-enhanced-input.ts  # Advanced input features
│   └── use-input-history.ts   # Input history
├── ui/                   # React/Ink components
│   ├── app.tsx           # Root app component
│   └── components/       # UI components (chat, input, diff, model picker, etc.)
├── types/                # Shared TypeScript interfaces
│   └── index.ts          # ToolResult, Tool, EditorCommand, etc.
└── utils/                # Utilities and services
    ├── settings-manager.ts    # Settings singleton (user + project settings)
    ├── confirmation-service.ts # Confirmation singleton
    ├── token-counter.ts       # Token counting with tiktoken
    ├── custom-instructions.ts # Loads .grok/GROK.md files
    └── model-config.ts        # Model definitions and configuration
```

## Architecture

### Key patterns

- **Agent loop:** `GrokAgent` extends `EventEmitter` and runs an iterative tool-calling loop (up to 400 rounds by default). It sends messages to the Grok API, receives tool call requests, executes them, and feeds results back.
- **Tool pattern:** Each tool is a class in `src/tools/` with methods that return `ToolResult` (`{ success, output?, error?, data? }`). Tool schemas (the function definitions the LLM sees) are defined separately in `src/grok/tools.ts`.
- **Singletons:** `SettingsManager` and `ConfirmationService` use the singleton pattern (accessed via `getSettingsManager()` and `ConfirmationService.getInstance()`).
- **React/Ink UI:** The terminal interface uses React functional components and hooks. UI state flows through React, while agent events bridge the gap between the agent loop and the UI.
- **MCP extensibility:** External tools are loaded from MCP servers configured in project settings. `MCPManager` handles transport creation and tool invocation.

### Adding a new tool

1. Create the tool class in `src/tools/your-tool.ts` returning `ToolResult`
2. Export it from `src/tools/index.ts`
3. Add the function schema to `BASE_GROK_TOOLS` in `src/grok/tools.ts`
4. Add execution logic in `GrokAgent.executeTool()` in `src/agent/grok-agent.ts`

### Configuration layers (highest to lowest priority)

1. CLI flags (`-k`, `-m`, `-u`, etc.)
2. Environment variables (`GROK_API_KEY`, `GROK_MODEL`, etc.)
3. Project settings (`.grok/settings.json`)
4. User settings (`~/.grok/user-settings.json`)
5. System defaults (fallback model: `grok-code-fast-1`)

## Code Conventions

### Imports

- ESM only. All local imports **must** use `.js` extensions (e.g., `import { Foo } from "./foo.js"`), even though source files are `.ts`/`.tsx`. This is required by the ESNext module resolution.
- Use named imports. Default imports only for React and libraries that require it.

### TypeScript style

- `strict` and `noImplicitAny` are currently `false` in tsconfig. When writing **new** code, prefer explicit types and avoid `any` where practical. Do not refactor existing code to add types unless directly relevant to the change.
- Interfaces go in `src/types/index.ts` if shared across modules, or co-located with the class/component if local.
- Use `async`/`await` over raw Promises.

### Naming

- Classes: `PascalCase` (e.g., `GrokAgent`, `TextEditorTool`)
- Functions/methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts` (e.g., `grok-agent.ts`, `text-editor.ts`)

### Error handling

- Tool methods wrap logic in try/catch and return `ToolResult` with `success: false` and `error` message on failure.
- Process-level errors (`uncaughtException`, `unhandledRejection`) are caught in `src/index.ts` and cause `process.exit(1)`.

### React/Ink components

- Functional components with hooks. No class components.
- Component files use `.tsx` extension.
- Props interfaces are defined alongside the component.

## Testing

No test framework is set up yet. If tests are needed, use Vitest. Place test files adjacent to source files using the `*.test.ts` naming convention.

## Restrictions

- **Never run `npm publish`** or any publish command.
- **Never modify user settings files** (`~/.grok/user-settings.json`, `~/.grok/GROK.md`) or project settings files (`.grok/settings.json`).
