import { Show, For, createMemo } from "solid-js"
import { useInput } from "../context/input.js"
import { useChat } from "../context/chat.js"

export function ChatInput() {
  const inputState = useInput()
  const chat = useChat()

  const isActive = createMemo(() => !chat.isProcessing() && !chat.isStreaming())
  const borderColor = createMemo(() => 
    chat.isProcessing() || chat.isStreaming() ? "#FFFF00" : "#4488FF"
  )

  const lines = createMemo(() => inputState.input().split("\n"))
  const isMultiline = createMemo(() => lines().length > 1)

  // Calculate cursor position within current line
  const cursorInfo = createMemo(() => {
    const input = inputState.input()
    const cursorPos = inputState.cursorPosition()
    const allLines = lines()
    
    let currentLineIndex = 0
    let currentCharIndex = 0
    let totalChars = 0

    for (let i = 0; i < allLines.length; i++) {
      if (totalChars + allLines[i].length >= cursorPos) {
        currentLineIndex = i
        currentCharIndex = cursorPos - totalChars
        break
      }
      totalChars += allLines[i].length + 1 // +1 for newline
    }

    return { lineIndex: currentLineIndex, charIndex: currentCharIndex }
  })

  const placeholderText = "Ask me anything..."
  const isPlaceholder = createMemo(() => !inputState.input())

  return (
    <box
      borderStyle="rounded"
      borderColor={borderColor()}
      padding={1}
      marginTop={1}
      flexDirection="column"
    >
      <Show when={isMultiline()} fallback={
        <box>
          <text fg="#00FFFF">❯ </text>
          <Show when={isPlaceholder()} fallback={
            <text>
              {inputState.input().slice(0, inputState.cursorPosition())}
              <Show when={isActive()}>
                <text bg="#FFFFFF" fg="#000000">
                  {inputState.input().slice(inputState.cursorPosition(), inputState.cursorPosition() + 1) || " "}
                </text>
              </Show>
              <Show when={!isActive()}>
                {inputState.input().slice(inputState.cursorPosition(), inputState.cursorPosition() + 1)}
              </Show>
              {inputState.input().slice(inputState.cursorPosition() + 1)}
            </text>
          }>
            <text fg="#808080">{placeholderText}</text>
            <Show when={isActive()}>
              <text bg="#FFFFFF" fg="#000000"> </text>
            </Show>
          </Show>
        </box>
      }>
        <For each={lines()}>
          {(line, index) => {
            const isCurrentLine = () => index() === cursorInfo().lineIndex
            const promptChar = index() === 0 ? "❯" : "│"

            return (
              <box>
                <text fg="#00FFFF">{promptChar} </text>
                <Show when={isCurrentLine()} fallback={<text>{line}</text>}>
                  <text>
                    {line.slice(0, cursorInfo().charIndex)}
                    <Show when={isActive()}>
                      <text bg="#FFFFFF" fg="#000000">
                        {line.slice(cursorInfo().charIndex, cursorInfo().charIndex + 1) || " "}
                      </text>
                    </Show>
                    <Show when={!isActive()}>
                      {line.slice(cursorInfo().charIndex, cursorInfo().charIndex + 1)}
                    </Show>
                    {line.slice(cursorInfo().charIndex + 1)}
                  </text>
                </Show>
              </box>
            )
          }}
        </For>
      </Show>
    </box>
  )
}
