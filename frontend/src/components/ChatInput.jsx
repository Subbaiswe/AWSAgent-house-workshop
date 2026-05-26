import { useState } from 'react'

export default function ChatInput({ onSend, disabled }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || disabled) return

    onSend(input)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="px-6 py-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Agent is thinking..." : "Type your message..."}
          className="flex-1 bg-white text-gray-900 rounded-full px-5 py-3 border border-gray-300
                   focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 placeholder-gray-400
                   transition-all"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600
                   text-white px-8 py-3 rounded-full font-medium shadow-md hover:shadow-lg
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md
                   transition-all duration-200"
        >
          {disabled ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Thinking...</span>
            </span>
          ) : (
            'Send'
          )}
        </button>
      </form>
    </div>
  )
}
