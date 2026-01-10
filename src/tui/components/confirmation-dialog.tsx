import { Show, For, createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useConfirmation } from "../context/confirmation.js"
import { useChat } from "../context/chat.js"
import { DiffRenderer } from "./diff-renderer.js"

export function ConfirmationDialog() {
  const confirmation = useConfirmation()
  const chat = useChat()
  const [selectedOption, setSelectedOption] = createSignal(0)
  const [feedbackMode, setFeedbackMode] = createSignal(false)
  const [feedback, setFeedback] = createSignal("")

  const options = [
    "Yes",
    "Yes, and don't ask again this session",
    "No",
    "No, with feedback",
  ]

  useKeyboard((key) => {
    if (!confirmation.options()) return

    if (feedbackMode()) {
      if (key.name === "return") {
        confirmation.reject(feedback().trim())
        setFeedbackMode(false)
        setFeedback("")
        // Reset processing states when rejected
        chat.setIsProcessing(false)
        chat.setIsStreaming(false)
        chat.setTokenCount(0)
        chat.setProcessingTime(0)
        return
      }
      if (key.name === "backspace") {
        setFeedback((prev) => prev.slice(0, -1))
        return
      }
      if (key.name === "escape") {
        setFeedbackMode(false)
        setFeedback("")
        return
      }
      if (key.sequence && !key.ctrl && !key.meta) {
        setFeedback((prev) => prev + key.sequence)
      }
      return
    }

    if (key.name === "up" || (key.shift && key.name === "tab")) {
      setSelectedOption((prev) => (prev > 0 ? prev - 1 : options.length - 1))
      return
    }

    if (key.name === "down" || key.name === "tab") {
      setSelectedOption((prev) => (prev + 1) % options.length)
      return
    }

    if (key.name === "return") {
      const selected = selectedOption()
      if (selected === 0) {
        confirmation.confirm(false)
      } else if (selected === 1) {
        confirmation.confirm(true)
      } else if (selected === 2) {
        confirmation.reject("Operation cancelled by user")
        chat.setIsProcessing(false)
        chat.setIsStreaming(false)
        chat.setTokenCount(0)
        chat.setProcessingTime(0)
      } else {
        setFeedbackMode(true)
      }
      return
    }

    if (key.name === "escape") {
      confirmation.reject("Operation cancelled by user (pressed Escape)")
      chat.setIsProcessing(false)
      chat.setIsStreaming(false)
      chat.setTokenCount(0)
      chat.setProcessingTime(0)
    }
  })

  const opts = () => confirmation.options()

  return (
    <Show when={opts()}>
      {(options_) => (
        <Show when={feedbackMode()} fallback={
          <box flexDirection="column">
            {/* Tool use header */}
            <box marginTop={1}>
              <text fg="#FF00FF">⏺</text>
              <text fg="#FFFFFF"> {options_().operation}({options_().filename})</text>
            </box>

            <box marginLeft={2} flexDirection="column">
              <text fg="#808080">⎿ Requesting user confirmation</text>

              <Show when={options_().showVSCodeOpen}>
                <box marginTop={1}>
                  <text fg="#808080">⎿ Opened changes in Visual Studio Code ⧉</text>
                </box>
              </Show>

              <Show when={options_().content}>
                <text fg="#808080">⎿ {options_().content!.split("\n")[0]}</text>
                <box marginLeft={4} flexDirection="column">
                  <DiffRenderer
                    diffContent={options_().content!}
                    filename={options_().filename}
                  />
                </box>
              </Show>
            </box>

            {/* Confirmation options */}
            <box flexDirection="column" marginTop={1}>
              <box marginBottom={1}>
                <text>Do you want to proceed with this operation?</text>
              </box>

              <box flexDirection="column">
                <For each={options}>
                  {(option, index) => (
                    <box paddingLeft={1}>
                      <text
                        fg={selectedOption() === index() ? "#000000" : "#FFFFFF"}
                        bg={selectedOption() === index() ? "#00FFFF" : undefined}
                      >
                        {index() + 1}. {option}
                      </text>
                    </box>
                  )}
                </For>
              </box>

              <box marginTop={1}>
                <text fg="#808080">↑↓ navigate • Enter select • Esc cancel</text>
              </box>
            </box>
          </box>
        }>
          <box flexDirection="column" padding={1}>
            <box flexDirection="column" marginBottom={1}>
              <text fg="#808080">
                Type your feedback and press Enter, or press Escape to go back.
              </text>
            </box>

            <box
              borderStyle="rounded"
              borderColor="#FFFF00"
              padding={1}
              marginTop={1}
            >
              <text fg="#808080">❯ </text>
              <text>
                {feedback()}
                <text fg="#FFFFFF">█</text>
              </text>
            </box>
          </box>
        </Show>
      )}
    </Show>
  )
}
