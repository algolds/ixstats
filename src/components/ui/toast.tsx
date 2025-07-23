"use client"

import * as React from "react"
import { createContext, useContext, useReducer } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckCircle, AlertTriangle, Info, X, AlertCircle } from "lucide-react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  id: string
  title: string
  description?: string
  type: ToastType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

type ToastState = {
  toasts: Toast[]
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; id: string }
  | { type: "REMOVE_ALL_TOASTS" }

const ToastContext = createContext<{
  state: ToastState
  dispatch: React.Dispatch<ToastAction>
  toast: (toast: Omit<Toast, "id">) => void
} | null>(null)

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, action.toast]
      }
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.id)
      }
    case "REMOVE_ALL_TOASTS":
      return {
        ...state,
        toasts: []
      }
    default:
      return state
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] })

  const toast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    
    dispatch({ type: "ADD_TOAST", toast: newToast })

    // Auto remove after duration (default 5 seconds)
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", id })
    }, toast.duration || 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ state, dispatch, toast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

function ToastContainer() {
  const { state, dispatch } = useToast()

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2 pointer-events-none">
      <AnimatePresence>
        {state.toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => dispatch({ type: "REMOVE_TOAST", id: toast.id })}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case "success":
        return "border-green-200 dark:border-green-800"
      case "error":
        return "border-red-200 dark:border-red-800"
      case "warning":
        return "border-yellow-200 dark:border-yellow-800"
      case "info":
        return "border-blue-200 dark:border-blue-800"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
      className={`relative flex w-full items-center space-x-4 rounded-md border ${getBorderColor()} bg-white p-4 shadow-lg dark:bg-gray-800 pointer-events-auto`}
    >
      <div className="flex-shrink-0">
        {getIcon()}
      </div>
      
      <div className="flex-1 space-y-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {toast.title}
        </div>
        {toast.description && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {toast.description}
          </div>
        )}
      </div>

      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          {toast.action.label}
        </button>
      )}

      <button
        onClick={onRemove}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

// Convenience functions
export const toast = {
  success: (title: string, description?: string, action?: Toast["action"]) => {
    const context = useToast()
    context.toast({ type: "success", title, description, action })
  },
  error: (title: string, description?: string, action?: Toast["action"]) => {
    const context = useToast()
    context.toast({ type: "error", title, description, action })
  },
  warning: (title: string, description?: string, action?: Toast["action"]) => {
    const context = useToast()
    context.toast({ type: "warning", title, description, action })
  },
  info: (title: string, description?: string, action?: Toast["action"]) => {
    const context = useToast()
    context.toast({ type: "info", title, description, action })
  },
}