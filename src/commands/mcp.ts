import yargs from "yargs"
import { addMCPServer, removeMCPServer, loadMCPConfig, PREDEFINED_SERVERS } from "../mcp/config.js"
import { getMCPManager } from "../grok/tools.js"
import { MCPServerConfig } from "../mcp/client.js"
import chalk from "chalk"

export function createMCPCommand() {
  return yargs()
    .scriptName("grok mcp")
    .command(
      "add <name>",
      "Add an MCP server",
      (yargs) =>
        yargs
          .positional("name", { describe: "Server name", type: "string", demandOption: true })
          .option("transport", {
            alias: "t",
            type: "string",
            description: "Transport type (stdio, http, sse, streamable_http)",
            default: "stdio",
          })
          .option("command", {
            alias: "c",
            type: "string",
            description: "Command to run the server (for stdio transport)",
          })
          .option("args", {
            alias: "a",
            type: "array",
            description: "Arguments for the server command (for stdio transport)",
            default: [],
          })
          .option("url", {
            alias: "u",
            type: "string",
            description: "URL for HTTP/SSE transport",
          })
          .option("headers", {
            alias: "h",
            type: "array",
            description: "HTTP headers (key=value format)",
            default: [],
          })
          .option("env", {
            alias: "e",
            type: "array",
            description: "Environment variables (key=value format)",
            default: [],
          }),
      async (argv) => {
        try {
          const name = argv.name as string

          // Check if it's a predefined server
          if (PREDEFINED_SERVERS[name]) {
            const config = PREDEFINED_SERVERS[name]
            addMCPServer(config)
            console.log(chalk.green(`✓ Added predefined MCP server: ${name}`))

            const manager = getMCPManager()
            await manager.addServer(config)
            console.log(chalk.green(`✓ Connected to MCP server: ${name}`))

            const tools = manager.getTools().filter((t) => t.serverName === name)
            console.log(chalk.blue(`  Available tools: ${tools.length}`))

            return
          }

          // Custom server
          const transportType = (argv.transport as string).toLowerCase()

          if (transportType === "stdio") {
            if (!argv.command) {
              console.error(chalk.red("Error: --command is required for stdio transport"))
              process.exit(1)
            }
          } else if (transportType === "http" || transportType === "sse" || transportType === "streamable_http") {
            if (!argv.url) {
              console.error(chalk.red(`Error: --url is required for ${transportType} transport`))
              process.exit(1)
            }
          } else {
            console.error(chalk.red("Error: Transport type must be stdio, http, sse, or streamable_http"))
            process.exit(1)
          }

          // Parse environment variables
          const env: Record<string, string> = {}
          for (const envVar of (argv.env as string[]) || []) {
            const [key, value] = envVar.split("=", 2)
            if (key && value) {
              env[key] = value
            }
          }

          // Parse headers
          const headers: Record<string, string> = {}
          for (const header of (argv.headers as string[]) || []) {
            const [key, value] = header.split("=", 2)
            if (key && value) {
              headers[key] = value
            }
          }

          const config = {
            name,
            transport: {
              type: transportType as "stdio" | "http" | "sse" | "streamable_http",
              command: argv.command as string | undefined,
              args: (argv.args as string[]) || [],
              url: argv.url as string | undefined,
              env,
              headers: Object.keys(headers).length > 0 ? headers : undefined,
            },
          }

          addMCPServer(config)
          console.log(chalk.green(`✓ Added MCP server: ${name}`))

          const manager = getMCPManager()
          await manager.addServer(config)
          console.log(chalk.green(`✓ Connected to MCP server: ${name}`))

          const tools = manager.getTools().filter((t) => t.serverName === name)
          console.log(chalk.blue(`  Available tools: ${tools.length}`))
        } catch (error: any) {
          console.error(chalk.red(`Error adding MCP server: ${error.message}`))
          process.exit(1)
        }
      }
    )
    .command(
      "add-json <name> <json>",
      "Add an MCP server from JSON configuration",
      (yargs) =>
        yargs
          .positional("name", { describe: "Server name", type: "string", demandOption: true })
          .positional("json", { describe: "JSON configuration", type: "string", demandOption: true }),
      async (argv) => {
        try {
          const name = argv.name as string
          const jsonConfig = argv.json as string

          let config
          try {
            config = JSON.parse(jsonConfig)
          } catch {
            console.error(chalk.red("Error: Invalid JSON configuration"))
            process.exit(1)
          }

          const serverConfig: MCPServerConfig = {
            name,
            transport: {
              type: "stdio",
              command: config.command,
              args: config.args || [],
              env: config.env || {},
              url: config.url,
              headers: config.headers,
            },
          }

          if (config.transport) {
            if (typeof config.transport === "string") {
              serverConfig.transport.type = config.transport as "stdio" | "http" | "sse"
            } else if (typeof config.transport === "object") {
              serverConfig.transport = { ...serverConfig.transport, ...config.transport }
            }
          }

          addMCPServer(serverConfig)
          console.log(chalk.green(`✓ Added MCP server: ${name}`))

          const manager = getMCPManager()
          await manager.addServer(serverConfig)
          console.log(chalk.green(`✓ Connected to MCP server: ${name}`))

          const tools = manager.getTools().filter((t) => t.serverName === name)
          console.log(chalk.blue(`  Available tools: ${tools.length}`))
        } catch (error: any) {
          console.error(chalk.red(`Error adding MCP server: ${error.message}`))
          process.exit(1)
        }
      }
    )
    .command(
      "remove <name>",
      "Remove an MCP server",
      (yargs) =>
        yargs.positional("name", { describe: "Server name", type: "string", demandOption: true }),
      async (argv) => {
        try {
          const name = argv.name as string
          const manager = getMCPManager()
          await manager.removeServer(name)
          removeMCPServer(name)
          console.log(chalk.green(`✓ Removed MCP server: ${name}`))
        } catch (error: any) {
          console.error(chalk.red(`Error removing MCP server: ${error.message}`))
          process.exit(1)
        }
      }
    )
    .command("list", "List configured MCP servers", {}, () => {
      const config = loadMCPConfig()
      const manager = getMCPManager()

      if (config.servers.length === 0) {
        console.log(chalk.yellow("No MCP servers configured"))
        return
      }

      console.log(chalk.bold("Configured MCP servers:"))
      console.log()

      for (const server of config.servers) {
        const isConnected = manager.getServers().includes(server.name)
        const status = isConnected ? chalk.green("✓ Connected") : chalk.red("✗ Disconnected")

        console.log(`${chalk.bold(server.name)}: ${status}`)

        if (server.transport) {
          console.log(`  Transport: ${server.transport.type}`)
          if (server.transport.type === "stdio") {
            console.log(`  Command: ${server.transport.command} ${(server.transport.args || []).join(" ")}`)
          } else if (server.transport.type === "http" || server.transport.type === "sse") {
            console.log(`  URL: ${server.transport.url}`)
          }
        } else if (server.command) {
          console.log(`  Command: ${server.command} ${(server.args || []).join(" ")}`)
        }

        if (isConnected) {
          const transportType = manager.getTransportType(server.name)
          if (transportType) {
            console.log(`  Active Transport: ${transportType}`)
          }

          const tools = manager.getTools().filter((t) => t.serverName === server.name)
          console.log(`  Tools: ${tools.length}`)
          if (tools.length > 0) {
            tools.forEach((tool) => {
              const displayName = tool.name.replace(`mcp__${server.name}__`, "")
              console.log(`    - ${displayName}: ${tool.description}`)
            })
          }
        }

        console.log()
      }
    })
    .command(
      "test <name>",
      "Test connection to an MCP server",
      (yargs) =>
        yargs.positional("name", { describe: "Server name", type: "string", demandOption: true }),
      async (argv) => {
        const name = argv.name as string
        try {
          const config = loadMCPConfig()
          const serverConfig = config.servers.find((s) => s.name === name)

          if (!serverConfig) {
            console.error(chalk.red(`Server ${name} not found`))
            process.exit(1)
          }

          console.log(chalk.blue(`Testing connection to ${name}...`))

          const manager = getMCPManager()
          await manager.addServer(serverConfig)

          const tools = manager.getTools().filter((t) => t.serverName === name)
          console.log(chalk.green(`✓ Successfully connected to ${name}`))
          console.log(chalk.blue(`  Available tools: ${tools.length}`))

          if (tools.length > 0) {
            console.log("  Tools:")
            tools.forEach((tool) => {
              const displayName = tool.name.replace(`mcp__${name}__`, "")
              console.log(`    - ${displayName}: ${tool.description}`)
            })
          }
        } catch (error: any) {
          console.error(chalk.red(`✗ Failed to connect to ${name}: ${error.message}`))
          process.exit(1)
        }
      }
    )
    .help()
}

// Execute list command
export async function listMCPServers() {
  await createMCPCommand().parseAsync(["list"])
}

// Execute add command
export async function addMCPServerCmd(name: string) {
  await createMCPCommand().parseAsync(["add", name])
}

// Execute remove command
export async function removeMCPServerCmd(name: string) {
  await createMCPCommand().parseAsync(["remove", name])
}
