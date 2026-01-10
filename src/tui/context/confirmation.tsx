import { createContext, useContext, createSignal, type ParentComponent, type Accessor, type Setter, createEffect, onCleanup } from "solid-js"
import { ConfirmationService, type ConfirmationOptions } from "../../utils/confirmation-service.js"

interface ConfirmationState {
  options: Accessor<ConfirmationOptions | null>
  setOptions: Setter<ConfirmationOptions | null>
  confirm: (dontAskAgain?: boolean) => void
  reject: (feedback?: string) => void
  autoEditEnabled: Accessor<boolean>
  setAutoEditEnabled: Setter<boolean>
  toggleAutoEdit: () => void
}

const ConfirmationContext = createContext<ConfirmationState>()

export const ConfirmationProvider: ParentComponent = (props) => {
  const confirmationService = ConfirmationService.getInstance()
  
  const [options, setOptions] = createSignal<ConfirmationOptions | null>(null)
  
  // Initialize autoEditEnabled based on current session flags
  const initialAutoEdit = confirmationService.getSessionFlags().allOperations
  const [autoEditEnabled, setAutoEditEnabled] = createSignal<boolean>(initialAutoEdit)

  // Listen for confirmation requests
  createEffect(() => {
    const handleConfirmationRequest = (opts: ConfirmationOptions) => {
      setOptions(opts)
    }

    confirmationService.on("confirmation-requested", handleConfirmationRequest)

    onCleanup(() => {
      confirmationService.off("confirmation-requested", handleConfirmationRequest)
    })
  })

  const confirm = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain)
    setOptions(null)
  }

  const reject = (feedback?: string) => {
    confirmationService.rejectOperation(feedback)
    setOptions(null)
  }

  const toggleAutoEdit = () => {
    const newState = !autoEditEnabled()
    setAutoEditEnabled(newState)
    
    if (newState) {
      confirmationService.setSessionFlag("allOperations", true)
    } else {
      confirmationService.resetSession()
    }
  }

  const state: ConfirmationState = {
    options,
    setOptions,
    confirm,
    reject,
    autoEditEnabled,
    setAutoEditEnabled,
    toggleAutoEdit,
  }

  return (
    <ConfirmationContext.Provider value={state}>
      {props.children}
    </ConfirmationContext.Provider>
  )
}

export function useConfirmation(): ConfirmationState {
  const confirmation = useContext(ConfirmationContext)
  if (!confirmation) {
    throw new Error("useConfirmation must be used within a ConfirmationProvider")
  }
  return confirmation
}
