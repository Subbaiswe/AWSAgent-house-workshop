import { useState, useEffect, useRef } from 'react'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import useAuth from './hooks/useAuth'
import useStreaming from './hooks/useStreaming'

// Backend URL configuration
const LOCAL_BACKEND_URL = import.meta.env.VITE_LOCAL_BACKEND_URL
const DEPLOYED_BACKEND_URL = import.meta.env.VITE_DEPLOYED_BACKEND_URL

// Determine available backends
const getAvailableBackends = () => {
  const backends = []
  if (LOCAL_BACKEND_URL) {
    backends.push({ id: 'local', label: 'Local Agent', url: LOCAL_BACKEND_URL })
  }
  if (DEPLOYED_BACKEND_URL) {
    backends.push({ id: 'deployed', label: 'Deployed Agent', url: DEPLOYED_BACKEND_URL })
  }
  return backends
}

const AVAILABLE_BACKENDS = getAvailableBackends()

// Get initial backend from localStorage or default to first available
const getInitialBackend = () => {
  const stored = localStorage.getItem('selectedBackend')
  const found = AVAILABLE_BACKENDS.find(b => b.id === stored)
  return found || AVAILABLE_BACKENDS[0] || { id: 'none', label: 'No Backend', url: '' }
}

export default function App() {
  const { token, accessToken, loading, logout, isAuthenticated, getValidAccessToken } = useAuth()
  const { streamMessage, respondToInterrupt, isStreaming } = useStreaming()

  const [messages, setMessages] = useState([])
  const [currentMessage, setCurrentMessage] = useState(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [pendingInterrupt, setPendingInterrupt] = useState(null)
  const [respondedInterrupts, setRespondedInterrupts] = useState(new Map())
  const [selectedBackend, setSelectedBackend] = useState(getInitialBackend)

  // Persist backend selection
  const handleBackendChange = (backendId) => {
    const backend = AVAILABLE_BACKENDS.find(b => b.id === backendId)
    if (backend) {
      setSelectedBackend(backend)
      localStorage.setItem('selectedBackend', backendId)
    }
  }

  const BACKEND_URL = selectedBackend.url

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  useEffect(() => {
    scrollToBottomIfNeeded()
  }, [messages, currentMessage])

  const isNearBottom = () => {
    if (!chatContainerRef.current) return true

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    return distanceFromBottom < 100
  }

  const scrollToBottomIfNeeded = () => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async (message) => {
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    setTimeout(() => scrollToBottom(), 100)

    const assistantMessage = {
      role: 'assistant',
      content: '',
      contentBlocks: [],
      timestamp: new Date().toISOString()
    }
    setCurrentMessage(assistantMessage)

    const orderedBlocks = []
    const activeTools = new Map()
    let currentTextBuffer = ''
    let currentSubTextBlock = null

    try {
      await streamMessage(BACKEND_URL, message, accessToken, sessionId, (event) => {
        if (event.type === 'text') {
          currentSubTextBlock = null

          currentTextBuffer += event.content

          const lastBlock = orderedBlocks[orderedBlocks.length - 1]
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.content = currentTextBuffer
          } else {
            orderedBlocks.push({
              type: 'text',
              content: currentTextBuffer
            })
          }

          setCurrentMessage(prev => ({
            ...prev,
            contentBlocks: [...orderedBlocks]
          }))
        } else if (event.type === 'tool_start') {
          currentTextBuffer = ''

          activeTools.set(event.toolUseId, {
            name: event.name,
            input: null,
            toolUseId: event.toolUseId,
            isSubAgent: false
          })
        } else if (event.type === 'tool') {
          const toolBlock = {
            type: 'tool',
            toolBlock: {
              name: event.name,
              input: event.input,
              toolUseId: event.toolUseId,
              isSubAgent: false
            }
          }

          orderedBlocks.push(toolBlock)
          activeTools.delete(event.toolUseId)

          setCurrentMessage(prev => ({
            ...prev,
            contentBlocks: [...orderedBlocks]
          }))
        } else if (event.type === 'sub_text') {
          if (!currentSubTextBlock) {
            currentSubTextBlock = {
              type: 'sub_text',
              content: ''
            }
          }
          currentSubTextBlock.content += event.content
        } else if (event.type === 'sub_tool') {
          if (currentSubTextBlock && currentSubTextBlock.content) {
            orderedBlocks.push({ ...currentSubTextBlock })
            currentSubTextBlock = null
          }

          orderedBlocks.push({
            type: 'tool',
            toolBlock: {
              name: event.name,
              input: event.input,
              toolUseId: event.toolUseId || `sub-${Date.now()}`,
              isSubAgent: true
            }
          })

          setCurrentMessage(prev => ({
            ...prev,
            contentBlocks: [...orderedBlocks]
          }))
        } else if (event.type === 'interrupt') {
          setPendingInterrupt(event)

          orderedBlocks.push({
            type: 'interrupt',
            interrupt: event
          })

          setCurrentMessage(prev => ({
            ...prev,
            contentBlocks: [...orderedBlocks]
          }))
        } else if (event.type === 'error') {
          orderedBlocks.push({
            type: 'text',
            content: `\n\n**Error:** ${event.error}`
          })
          setCurrentMessage(prev => ({
            ...prev,
            contentBlocks: [...orderedBlocks]
          }))
        } else if (event.type === 'result') {
          currentSubTextBlock = null

          setMessages(prev => [...prev, {
            ...assistantMessage,
            contentBlocks: [...orderedBlocks],
            content: currentTextBuffer
          }])
          setCurrentMessage(null)
        }
      }, getValidAccessToken)
    } catch (err) {
      console.error('Streaming error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      }])
      setCurrentMessage(null)
    }
  }

  const handleApprove = async (interruptId) => {
    setRespondedInterrupts(prev => new Map(prev).set(interruptId, 'approved'))

    let textBuffer = ''

    try {
      await respondToInterrupt(
        BACKEND_URL,
        interruptId,
        'approve',
        accessToken,
        sessionId,
        (event) => {
          if (event.type === 'text') {
            textBuffer += event.content
            setCurrentMessage(prev => {
              const blocks = [...(prev?.contentBlocks || [])]
              const lastBlock = blocks[blocks.length - 1]
              if (lastBlock && lastBlock.type === 'text') {
                blocks[blocks.length - 1] = { ...lastBlock, content: textBuffer }
              } else {
                blocks.push({ type: 'text', content: textBuffer })
              }
              return { ...prev, contentBlocks: blocks }
            })
          } else if (event.type === 'result') {
            setCurrentMessage(prev => {
              if (prev) {
                setMessages(msgs => [...msgs, prev])
              }
              return null
            })
            setPendingInterrupt(null)
          }
        },
        getValidAccessToken
      )
    } catch (err) {
      console.error('Approval error:', err)
      setPendingInterrupt(null)
      setRespondedInterrupts(prev => {
        const newMap = new Map(prev)
        newMap.delete(interruptId)
        return newMap
      })
    }
  }

  const handleReject = async (interruptId) => {
    setRespondedInterrupts(prev => new Map(prev).set(interruptId, 'rejected'))

    let textBuffer = ''

    try {
      await respondToInterrupt(
        BACKEND_URL,
        interruptId,
        'reject',
        accessToken,
        sessionId,
        (event) => {
          if (event.type === 'text') {
            textBuffer += event.content
            setCurrentMessage(prev => {
              const blocks = [...(prev?.contentBlocks || [])]
              const lastBlock = blocks[blocks.length - 1]
              if (lastBlock && lastBlock.type === 'text') {
                blocks[blocks.length - 1] = { ...lastBlock, content: textBuffer }
              } else {
                blocks.push({ type: 'text', content: textBuffer })
              }
              return { ...prev, contentBlocks: blocks }
            })
          } else if (event.type === 'result') {
            setCurrentMessage(prev => {
              if (prev) {
                setMessages(msgs => [...msgs, prev])
              }
              return null
            })
            setPendingInterrupt(null)
          }
        },
        getValidAccessToken
      )
    } catch (err) {
      console.error('Rejection error:', err)
      setPendingInterrupt(null)
      setRespondedInterrupts(prev => {
        const newMap = new Map(prev)
        newMap.delete(interruptId)
        return newMap
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agent Chat</h1>
            <p className="text-sm text-gray-600">Chat with your agent</p>
          </div>
          <div className="flex items-center gap-4">
            {AVAILABLE_BACKENDS.length > 1 && (
              <select
                value={selectedBackend.id}
                onChange={(e) => handleBackendChange(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                title={selectedBackend.url}
              >
                {AVAILABLE_BACKENDS.map((backend) => (
                  <option key={backend.id} value={backend.id}>
                    {backend.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !currentMessage && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Start a Conversation</h2>
              <p className="text-gray-600">Ask me anything!</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg}
              isStreaming={false}
              onApprove={handleApprove}
              onReject={handleReject}
              respondedInterrupts={respondedInterrupts}
            />
          ))}

          {currentMessage && (
            <ChatMessage
              message={currentMessage}
              isStreaming={isStreaming}
              onApprove={handleApprove}
              onReject={handleReject}
              respondedInterrupts={respondedInterrupts}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming || pendingInterrupt !== null}
          />
        </div>
      </div>
    </div>
  )
}
