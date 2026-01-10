import { Show, For } from "solid-js"

export interface ModelOption {
  model: string
}

interface ModelSelectionProps {
  models: ModelOption[]
  selectedIndex: number
  isVisible: boolean
  currentModel: string
}

export function ModelSelection(props: ModelSelectionProps) {
  return (
    <Show when={props.isVisible}>
      <box marginTop={1} flexDirection="column">
        <box marginBottom={1}>
          <text fg="#00FFFF">Select Grok Model (current: {props.currentModel}):</text>
        </box>
        <For each={props.models}>
          {(modelOption, index) => (
            <box paddingLeft={1}>
              <text
                fg={index() === props.selectedIndex ? "#000000" : "#FFFFFF"}
                bg={index() === props.selectedIndex ? "#00FFFF" : undefined}
              >
                {modelOption.model}
              </text>
            </box>
          )}
        </For>
        <box marginTop={1}>
          <text fg="#808080">↑↓ navigate • Enter/Tab select • Esc cancel</text>
        </box>
      </box>
    </Show>
  )
}
