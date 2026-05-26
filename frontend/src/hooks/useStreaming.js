import { useState } from 'react'

export default function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false)

  const streamMessage = async (endpoint, message, accessToken, sessionId, onEvent, getValidAccessToken) => {
    setIsStreaming(true)

    try {
      const validToken = getValidAccessToken ? await getValidAccessToken() : accessToken

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId
      }

      let response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: message })
      })

      if (response.status === 401) {
        console.log('Received 401, refreshing token and retrying...')
        const freshToken = await getValidAccessToken()

        if (!freshToken) {
          throw new Error('Authentication failed')
        }

        headers['Authorization'] = `Bearer ${freshToken}`

        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: message })
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const event = JSON.parse(line)
            onEvent(event)
          } catch (err) {
            console.error('Failed to parse event:', line, err)
          }
        }
      }

      setIsStreaming(false)
    } catch (error) {
      console.error('Streaming error:', error)
      setIsStreaming(false)
      throw error
    }
  }

  const respondToInterrupt = async (endpoint, interruptId, response, accessToken, sessionId, onEvent, getValidAccessToken) => {
    setIsStreaming(true)

    try {
      const validToken = getValidAccessToken ? await getValidAccessToken() : accessToken

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
        'X-Amzn-Bedrock-AgentCore-Runtime-Custom-Interrupt-Id': interruptId
      }

      let apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: response })
      })

      if (apiResponse.status === 401) {
        console.log('Received 401 on interrupt response, refreshing token and retrying...')
        const freshToken = await getValidAccessToken()

        if (!freshToken) {
          throw new Error('Authentication failed')
        }

        headers['Authorization'] = `Bearer ${freshToken}`

        apiResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: response })
        })
      }

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`)
      }

      const reader = apiResponse.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const event = JSON.parse(line)
            onEvent(event)
          } catch (err) {
            console.error('Failed to parse event:', line, err)
          }
        }
      }

      setIsStreaming(false)
    } catch (error) {
      console.error('Interrupt response streaming error:', error)
      setIsStreaming(false)
      throw error
    }
  }

  return {
    streamMessage,
    respondToInterrupt,
    isStreaming
  }
}
