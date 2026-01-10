import { Show, For, createMemo } from "solid-js"

export const MAX_SUGGESTIONS = 8

export interface CommandSuggestion {
  command: string
  description: string
}

export function filterCommandSuggestions<T extends { command: string }>(
  suggestions: T[],
  input: string
): T[] {
  const lowerInput = input.toLowerCase()
  return suggestions
    .filter((s) => s.command.toLowerCase().startsWith(lowerInput))
    .slice(0, MAX_SUGGESTIONS)
}

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[]
  input: string
  selectedIndex: number
  isVisible: boolean
}

export function CommandSuggestions(props: CommandSuggestionsProps) {
  const filteredSuggestions = createMemo(() => 
    filterCommandSuggestions(props.suggestions, props.input)
  )

  return (
    <Show when={props.isVisible && filteredSuggestions().length > 0}>
      <box marginTop={1} flexDirection="column">
        <For each={filteredSuggestions()}>
          {(suggestion, index) => (
            <box paddingLeft={1}>
              <text
                fg={index() === props.selectedIndex ? "#000000" : "#FFFFFF"}
                bg={index() === props.selectedIndex ? "#00FFFF" : undefined}
              >
                {suggestion.command}
              </text>
              <box marginLeft={1}>
                <text fg="#808080">{suggestion.description}</text>
              </box>
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
