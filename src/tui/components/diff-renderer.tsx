import { For, Show, createMemo } from "solid-js"

interface DiffLine {
  type: "add" | "del" | "context" | "hunk" | "other"
  oldLine?: number
  newLine?: number
  content: string
}

function parseDiffWithLineNumbers(diffContent: string): DiffLine[] {
  const lines = diffContent.split("\n")
  const result: DiffLine[] = []
  let currentOldLine = 0
  let currentNewLine = 0
  let inHunk = false
  const hunkHeaderRegex = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/

  for (const line of lines) {
    const hunkMatch = line.match(hunkHeaderRegex)
    if (hunkMatch) {
      currentOldLine = parseInt(hunkMatch[1], 10)
      currentNewLine = parseInt(hunkMatch[2], 10)
      inHunk = true
      result.push({ type: "hunk", content: line })
      currentOldLine--
      currentNewLine--
      continue
    }
    if (!inHunk) {
      if (
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("diff --git") ||
        line.startsWith("index ") ||
        line.startsWith("similarity index") ||
        line.startsWith("rename from") ||
        line.startsWith("rename to") ||
        line.startsWith("new file mode") ||
        line.startsWith("deleted file mode")
      ) {
        continue
      }
      continue
    }
    if (line.startsWith("+")) {
      currentNewLine++
      result.push({
        type: "add",
        newLine: currentNewLine,
        content: line.substring(1),
      })
    } else if (line.startsWith("-")) {
      currentOldLine++
      result.push({
        type: "del",
        oldLine: currentOldLine,
        content: line.substring(1),
      })
    } else if (line.startsWith(" ")) {
      currentOldLine++
      currentNewLine++
      result.push({
        type: "context",
        oldLine: currentOldLine,
        newLine: currentNewLine,
        content: line.substring(1),
      })
    } else if (line.startsWith("\\")) {
      result.push({ type: "other", content: line })
    }
  }
  return result
}

interface DiffRendererProps {
  diffContent: string
  filename?: string
  tabWidth?: number
}

const DEFAULT_TAB_WIDTH = 4

export function DiffRenderer(props: DiffRendererProps) {
  const tabWidth = props.tabWidth ?? DEFAULT_TAB_WIDTH

  const parsedData = createMemo(() => {
    if (!props.diffContent || typeof props.diffContent !== "string") {
      return { lines: [], baseIndentation: 0 }
    }

    // Strip the first summary line
    const lines = props.diffContent.split("\n")
    const firstLine = lines[0]
    let actualDiffContent = props.diffContent

    if (firstLine && (firstLine.startsWith("Updated ") || firstLine.startsWith("Created "))) {
      actualDiffContent = lines.slice(1).join("\n")
    }

    const parsedLines = parseDiffWithLineNumbers(actualDiffContent)

    // Normalize whitespace
    const normalizedLines = parsedLines.map((line) => ({
      ...line,
      content: line.content.replace(/\t/g, " ".repeat(tabWidth)),
    }))

    const displayableLines = normalizedLines.filter(
      (l) => l.type !== "hunk" && l.type !== "other"
    )

    // Calculate base indentation
    let baseIndentation = Infinity
    for (const line of displayableLines) {
      if (line.content.trim() === "") continue
      const firstCharIndex = line.content.search(/\S/)
      const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex
      baseIndentation = Math.min(baseIndentation, currentIndent)
    }
    if (!isFinite(baseIndentation)) {
      baseIndentation = 0
    }

    return { lines: displayableLines, baseIndentation }
  })

  return (
    <Show when={parsedData().lines.length > 0} fallback={
      <text fg="#808080">No changes detected.</text>
    }>
      <box flexDirection="column">
        <For each={parsedData().lines}>
          {(line) => {
            let gutterNumStr = ""
            let backgroundColor: string | undefined
            let prefixSymbol = " "
            let dim = false

            switch (line.type) {
              case "add":
                gutterNumStr = (line.newLine ?? "").toString()
                backgroundColor = "#86efac"
                prefixSymbol = "+"
                break
              case "del":
                gutterNumStr = (line.oldLine ?? "").toString()
                backgroundColor = "#fca5a5"
                prefixSymbol = "-"
                break
              case "context":
                gutterNumStr = (line.newLine ?? "").toString()
                dim = true
                prefixSymbol = " "
                break
              default:
                return null
            }

            const displayContent = line.content.substring(parsedData().baseIndentation)

            return (
              <box flexDirection="row">
                <text fg="#808080">{gutterNumStr.padEnd(4)}</text>
                <text
                  fg={backgroundColor ? "#000000" : undefined}
                  bg={backgroundColor}
                >
                  {prefixSymbol}{" "}
                </text>
                <text
                  fg={backgroundColor ? "#000000" : dim ? "#808080" : undefined}
                  bg={backgroundColor}
                >
                  {displayContent}
                </text>
              </box>
            )
          }}
        </For>
      </box>
    </Show>
  )
}
