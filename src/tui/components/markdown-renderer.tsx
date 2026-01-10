import { marked } from "marked"
import TerminalRenderer from "marked-terminal"

// Configure marked to use the terminal renderer
marked.setOptions({
  renderer: new (TerminalRenderer as any)()
})

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  try {
    const result = marked.parse(props.content)
    const rendered = typeof result === "string" ? result : props.content
    return <text>{rendered}</text>
  } catch {
    return <text>{props.content}</text>
  }
}
