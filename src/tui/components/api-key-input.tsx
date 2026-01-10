import { Show, createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { GrokAgent } from "../../agent/grok-agent.js"
import { getSettingsManager } from "../../utils/settings-manager.js"

interface ApiKeyInputProps {
  onApiKeySet: (agent: GrokAgent) => void
}

export function ApiKeyInput(props: ApiKeyInputProps) {
  const [input, setInput] = createSignal("")
  const [error, setError] = createSignal("")
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const handleSubmit = async () => {
    if (!input().trim()) {
      setError("API key cannot be empty")
      return
    }

    setIsSubmitting(true)
    try {
      const apiKey = input().trim()
      const agent = new GrokAgent(apiKey)

      // Set environment variable for current process
      process.env.GROK_API_KEY = apiKey

      // Save to user settings
      try {
        const manager = getSettingsManager()
        manager.updateUserSetting("apiKey", apiKey)
        console.log("\n✅ API key saved to ~/.grok/user-settings.json")
      } catch {
        console.log("\n⚠️ Could not save API key to settings file")
        console.log("API key set for current session only")
      }

      props.onApiKeySet(agent)
    } catch {
      setError("Invalid API key format")
      setIsSubmitting(false)
    }
  }

  useKeyboard((key) => {
    if (isSubmitting()) return

    if (key.ctrl && key.name === "c") {
      process.exit(0)
      return
    }

    if (key.name === "return") {
      handleSubmit()
      return
    }

    if (key.name === "backspace") {
      setInput((prev) => prev.slice(0, -1))
      setError("")
      return
    }

    if (key.sequence && !key.ctrl && !key.meta) {
      setInput((prev) => prev + key.sequence)
      setError("")
    }
  })

  const displayText = () => {
    if (input().length > 0) {
      return isSubmitting() ? "*".repeat(input().length) : "*".repeat(input().length) + "█"
    }
    return isSubmitting() ? " " : "█"
  }

  return (
    <box flexDirection="column" padding={2}>
      <text fg="#FFFF00">🔑 Grok API Key Required</text>
      <box marginBottom={1}>
        <text fg="#808080">Please enter your Grok API key to continue:</text>
      </box>

      <box borderStyle="rounded" borderColor="#4488FF" padding={1} marginBottom={1}>
        <text fg="#808080">❯ </text>
        <text>{displayText()}</text>
      </box>

      <Show when={error()}>
        <box marginBottom={1}>
          <text fg="#FF0000">❌ {error()}</text>
        </box>
      </Show>

      <box flexDirection="column" marginTop={1}>
        <text fg="#808080">• Press Enter to submit</text>
        <text fg="#808080">• Press Ctrl+C to exit</text>
        <text fg="#808080">Note: API key will be saved to ~/.grok/user-settings.json</text>
      </box>

      <Show when={isSubmitting()}>
        <box marginTop={1}>
          <text fg="#FFFF00">🔄 Validating API key...</text>
        </box>
      </Show>
    </box>
  )
}
