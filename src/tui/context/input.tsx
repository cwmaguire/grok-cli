import { createContext, useContext, createSignal, type ParentComponent, type Accessor, type Setter } from "solid-js"
import {
  deleteCharBefore,
  deleteCharAfter,
  deleteWordBefore,
  deleteWordAfter,
  insertText,
  moveToLineStart,
  moveToLineEnd,
  moveToPreviousWord,
  moveToNextWord,
} from "../../utils/text-utils.js"

interface InputState {
  input: Accessor<string>
  setInput: Setter<string>
  cursorPosition: Accessor<number>
  setCursorPosition: Setter<number>
  history: Accessor<string[]>
  historyIndex: Accessor<number>
  clearInput: () => void
  insertAtCursor: (text: string) => void
  handleBackspace: (ctrl?: boolean) => void
  handleDelete: (ctrl?: boolean) => void
  handleLeft: (ctrl?: boolean) => void
  handleRight: (ctrl?: boolean) => void
  handleUp: () => boolean
  handleDown: () => boolean
  handleHome: () => void
  handleEnd: () => void
  handleKillLine: () => void
  handleKillLineBack: () => void
  handleKillWord: () => void
  addToHistory: (text: string) => void
}

const InputContext = createContext<InputState>()

export const InputProvider: ParentComponent = (props) => {
  const [input, setInput] = createSignal("")
  const [cursorPosition, setCursorPosition] = createSignal(0)
  const [history, setHistory] = createSignal<string[]>([])
  const [historyIndex, setHistoryIndex] = createSignal(-1)
  const [originalInput, setOriginalInput] = createSignal("")

  const clearInput = () => {
    setInput("")
    setCursorPosition(0)
    setHistoryIndex(-1)
    setOriginalInput("")
  }

  const insertAtCursor = (text: string) => {
    const result = insertText(input(), cursorPosition(), text)
    setInput(result.text)
    setCursorPosition(result.position)
    setOriginalInput(result.text)
    setHistoryIndex(-1)
  }

  const handleBackspace = (ctrl = false) => {
    if (ctrl) {
      const result = deleteWordBefore(input(), cursorPosition())
      setInput(result.text)
      setCursorPosition(result.position)
    } else {
      const result = deleteCharBefore(input(), cursorPosition())
      setInput(result.text)
      setCursorPosition(result.position)
    }
    setOriginalInput(input())
  }

  const handleDelete = (ctrl = false) => {
    if (ctrl) {
      const result = deleteWordAfter(input(), cursorPosition())
      setInput(result.text)
      setCursorPosition(result.position)
    } else {
      const result = deleteCharAfter(input(), cursorPosition())
      setInput(result.text)
      setCursorPosition(result.position)
    }
    setOriginalInput(input())
  }

  const handleLeft = (ctrl = false) => {
    if (ctrl) {
      const newPos = moveToPreviousWord(input(), cursorPosition())
      setCursorPosition(newPos)
    } else {
      setCursorPosition(Math.max(0, cursorPosition() - 1))
    }
  }

  const handleRight = (ctrl = false) => {
    if (ctrl) {
      const newPos = moveToNextWord(input(), cursorPosition())
      setCursorPosition(newPos)
    } else {
      setCursorPosition(Math.min(input().length, cursorPosition() + 1))
    }
  }

  const handleUp = (): boolean => {
    const hist = history()
    if (hist.length === 0) return false

    if (historyIndex() === -1) {
      setOriginalInput(input())
      setHistoryIndex(hist.length - 1)
    } else if (historyIndex() > 0) {
      setHistoryIndex(historyIndex() - 1)
    } else {
      return false
    }

    const newInput = hist[historyIndex()]
    setInput(newInput)
    setCursorPosition(newInput.length)
    return true
  }

  const handleDown = (): boolean => {
    const hist = history()
    if (historyIndex() === -1) return false

    if (historyIndex() < hist.length - 1) {
      setHistoryIndex(historyIndex() + 1)
      const newInput = hist[historyIndex()]
      setInput(newInput)
      setCursorPosition(newInput.length)
    } else {
      setHistoryIndex(-1)
      setInput(originalInput())
      setCursorPosition(originalInput().length)
    }
    return true
  }

  const handleHome = () => {
    setCursorPosition(0)
  }

  const handleEnd = () => {
    setCursorPosition(input().length)
  }

  const handleKillLine = () => {
    const lineEnd = moveToLineEnd(input(), cursorPosition())
    const newText = input().slice(0, cursorPosition()) + input().slice(lineEnd)
    setInput(newText)
    setOriginalInput(newText)
  }

  const handleKillLineBack = () => {
    const lineStart = moveToLineStart(input(), cursorPosition())
    const newText = input().slice(0, lineStart) + input().slice(cursorPosition())
    setInput(newText)
    setCursorPosition(lineStart)
    setOriginalInput(newText)
  }

  const handleKillWord = () => {
    const result = deleteWordBefore(input(), cursorPosition())
    setInput(result.text)
    setCursorPosition(result.position)
    setOriginalInput(result.text)
  }

  const addToHistory = (text: string) => {
    if (text.trim()) {
      setHistory((prev) => {
        // Don't add duplicates
        if (prev[prev.length - 1] === text) return prev
        return [...prev, text]
      })
    }
    setHistoryIndex(-1)
    setOriginalInput("")
  }

  const state: InputState = {
    input,
    setInput,
    cursorPosition,
    setCursorPosition,
    history,
    historyIndex,
    clearInput,
    insertAtCursor,
    handleBackspace,
    handleDelete,
    handleLeft,
    handleRight,
    handleUp,
    handleDown,
    handleHome,
    handleEnd,
    handleKillLine,
    handleKillLineBack,
    handleKillWord,
    addToHistory,
  }

  return (
    <InputContext.Provider value={state}>
      {props.children}
    </InputContext.Provider>
  )
}

export function useInput(): InputState {
  const input = useContext(InputContext)
  if (!input) {
    throw new Error("useInput must be used within an InputProvider")
  }
  return input
}
