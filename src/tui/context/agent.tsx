import { createContext, useContext, type ParentComponent } from "solid-js"
import type { GrokAgent } from "../../agent/grok-agent.js"

const AgentContext = createContext<GrokAgent>()

export const AgentProvider: ParentComponent<{ agent: GrokAgent }> = (props) => {
  return (
    <AgentContext.Provider value={props.agent}>
      {props.children}
    </AgentContext.Provider>
  )
}

export function useAgent(): GrokAgent {
  const agent = useContext(AgentContext)
  if (!agent) {
    throw new Error("useAgent must be used within an AgentProvider")
  }
  return agent
}
