import { Show, createSignal, createEffect, onCleanup } from "solid-js"
import { useChat } from "../context/chat.js"
import { formatTokenCount } from "../../utils/token-counter.js"

const loadingTexts = [
  "Thinking...",
  "Computing...",
  "Analyzing...",
  "Processing...",
  "Calculating...",
  "Interfacing...",
  "Optimizing...",
  "Synthesizing...",
  "Decrypting...",
  "Calibrating...",
  "Bootstrapping...",
  "Synchronizing...",
  "Compiling...",
  "Downloading...",
]

const spinnerFrames = ["/", "-", "\\", "|"]

export function LoadingSpinner() {
  const chat = useChat()
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)
  const [loadingTextIndex, setLoadingTextIndex] = createSignal(0)

  createEffect(() => {
    if (!chat.isProcessing() && !chat.isStreaming()) return

    const spinnerInterval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % spinnerFrames.length)
    }, 500)

    onCleanup(() => clearInterval(spinnerInterval))
  })

  createEffect(() => {
    if (!chat.isProcessing() && !chat.isStreaming()) return

    setLoadingTextIndex(Math.floor(Math.random() * loadingTexts.length))

    const textInterval = setInterval(() => {
      setLoadingTextIndex(Math.floor(Math.random() * loadingTexts.length))
    }, 4000)

    onCleanup(() => clearInterval(textInterval))
  })

  // Update processing time
  createEffect(() => {
    if (!chat.isProcessing() && !chat.isStreaming()) {
      chat.setProcessingTime(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      chat.setProcessingTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    onCleanup(() => clearInterval(interval))
  })

  return (
    <Show when={chat.isProcessing() || chat.isStreaming()}>
      <box marginTop={1}>
        <text fg="#00FFFF">
          {spinnerFrames[spinnerFrame()]} {loadingTexts[loadingTextIndex()]}{" "}
        </text>
        <text fg="#808080">
          ({chat.processingTime()}s · ↑ {formatTokenCount(chat.tokenCount())} tokens · esc to interrupt)
        </text>
      </box>
    </Show>
  )
}
