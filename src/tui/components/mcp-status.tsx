import { Show, createSignal, createEffect, onCleanup } from "solid-js"
import { getMCPManager } from "../../grok/tools.js"

export function MCPStatus() {
  const [connectedServers, setConnectedServers] = createSignal<string[]>([])

  createEffect(() => {
    const updateStatus = () => {
      try {
        const manager = getMCPManager()
        const servers = manager.getServers()
        setConnectedServers(servers)
      } catch {
        setConnectedServers([])
      }
    }

    // Initial update with a small delay to allow MCP initialization
    const initialTimer = setTimeout(updateStatus, 2000)

    // Set up polling to check for status changes
    const interval = setInterval(updateStatus, 2000)

    onCleanup(() => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    })
  })

  return (
    <Show when={connectedServers().length > 0}>
      <box marginLeft={1}>
        <text fg="#00FF00">⚒ mcps: {connectedServers().length} </text>
      </box>
    </Show>
  )
}
