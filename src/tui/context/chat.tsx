import { createContext, useContext, createSignal, type ParentComponent, type Accessor, type Setter } from "solid-js"
import type { ChatEntry } from "../../agent/grok-agent.js"

interface ChatState {
  history: Accessor<ChatEntry[]>
  setHistory: Setter<ChatEntry[]>
  isProcessing: Accessor<boolean>
  setIsProcessing: Setter<boolean>
  isStreaming: Accessor<boolean>
  setIsStreaming: Setter<boolean>
  tokenCount: Accessor<number>
  setTokenCount: Setter<number>
  processingTime: Accessor<number>
  setProcessingTime: Setter<number>
  addEntry: (entry: ChatEntry) => void
  updateLastEntry: (updater: (entry: ChatEntry) => ChatEntry) => void
  clearHistory: () => void
}

const ChatContext = createContext<ChatState>()

export const ChatProvider: ParentComponent = (props) => {
  const [history, setHistory] = createSignal<ChatEntry[]>([])
  const [isProcessing, setIsProcessing] = createSignal(false)
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [tokenCount, setTokenCount] = createSignal(0)
  const [processingTime, setProcessingTime] = createSignal(0)

  const addEntry = (entry: ChatEntry) => {
    setHistory((prev) => [...prev, entry])
  }

  const updateLastEntry = (updater: (entry: ChatEntry) => ChatEntry) => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = updater(updated[updated.length - 1])
      return updated
    })
  }

  const clearHistory = () => {
    setHistory([])
    setIsProcessing(false)
    setIsStreaming(false)
    setTokenCount(0)
    setProcessingTime(0)
  }

  const state: ChatState = {
    history,
    setHistory,
    isProcessing,
    setIsProcessing,
    isStreaming,
    setIsStreaming,
    tokenCount,
    setTokenCount,
    processingTime,
    setProcessingTime,
    addEntry,
    updateLastEntry,
    clearHistory,
  }

  return (
    <ChatContext.Provider value={state}>
      {props.children}
    </ChatContext.Provider>
  )
}

export function useChat(): ChatState {
  const chat = useContext(ChatContext)
  if (!chat) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return chat
}
