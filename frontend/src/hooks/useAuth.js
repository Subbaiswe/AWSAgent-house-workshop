import { useState, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const AWS_REGION = import.meta.env.VITE_AWS_REGION
const CALLBACK_URL = `${window.location.origin}/callback`
const LOGOUT_URL = window.location.origin

export default function useAuth() {
  const [token, setToken] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isTokenExpired = (token) => {
    try {
      const decoded = jwtDecode(token)
      return decoded.exp * 1000 < Date.now() + 30000
    } catch (err) {
      console.error('Failed to decode token:', err)
      return true
    }
  }

  const getUserId = () => {
    try {
      const storedToken = localStorage.getItem('id_token')
      if (!storedToken) return null

      const decoded = jwtDecode(storedToken)
      return decoded.sub
    } catch (err) {
      console.error('Failed to decode token for user ID:', err)
      return null
    }
  }

  const logAccessToken = (token) => {
    try {
      const decoded = jwtDecode(token)
      console.log('Access Token (decoded):', JSON.stringify(decoded, null, 2))
    } catch (err) {
      console.error('Failed to decode access token:', err)
    }
  }

  const refreshToken = async () => {
    try {
      const storedRefreshToken = localStorage.getItem('refresh_token')
      if (!storedRefreshToken) {
        throw new Error('No refresh token available')
      }

      const tokenUrl = `https://${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com/oauth2/token`

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: storedRefreshToken
        })
      })

      if (!response.ok) {
        throw new Error('Token refresh failed')
      }

      const data = await response.json()

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('id_token', data.id_token)
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token)
      }

      setToken(data.id_token)
      setAccessToken(data.access_token)
      logAccessToken(data.access_token)
      return { idToken: data.id_token, accessToken: data.access_token }
    } catch (err) {
      console.error('Token refresh error:', err)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('id_token')
      redirectToLogin()
      throw err
    }
  }

  const getValidIdToken = async () => {
    const storedToken = localStorage.getItem('id_token')

    if (!storedToken) {
      redirectToLogin()
      return null
    }

    if (isTokenExpired(storedToken)) {
      console.log('Token expired, refreshing...')
      const tokens = await refreshToken()
      return tokens.idToken
    }

    return storedToken
  }

  const getValidAccessToken = async () => {
    const storedToken = localStorage.getItem('access_token')

    if (!storedToken) {
      redirectToLogin()
      return null
    }

    if (isTokenExpired(storedToken)) {
      console.log('Token expired, refreshing...')
      const tokens = await refreshToken()
      return tokens.accessToken
    }

    return storedToken
  }

  useEffect(() => {
    initAuth()
  }, [])

  const initAuth = async () => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        await exchangeCodeForToken(code)
        return
      }

      const storedIdToken = localStorage.getItem('id_token')
      const storedAccessToken = localStorage.getItem('access_token')

      if (storedIdToken && storedAccessToken) {
        if (isTokenExpired(storedIdToken)) {
          console.log('Stored tokens expired, attempting refresh...')
          try {
            await refreshToken()
            setLoading(false)
            return
          } catch (err) {
            return
          }
        }

        setToken(storedIdToken)
        setAccessToken(storedAccessToken)
        logAccessToken(storedAccessToken)
        setLoading(false)
        return
      }

      redirectToLogin()
    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const redirectToLogin = () => {
    const loginUrl =
      `https://${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`

    window.location.href = loginUrl
  }

  const exchangeCodeForToken = async (code) => {
    try {
      const tokenUrl = `https://${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com/oauth2/token`

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          code: code,
          redirect_uri: CALLBACK_URL
        })
      })

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`)
      }

      const data = await response.json()

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('id_token', data.id_token)

      setToken(data.id_token)
      setAccessToken(data.access_token)
      logAccessToken(data.access_token)
      setLoading(false)

      window.history.replaceState({}, document.title, '/')
    } catch (err) {
      console.error('Token exchange error:', err)
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('id_token')

    const logoutUrl =
      `https://${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com/logout` +
      `?client_id=${CLIENT_ID}` +
      `&logout_uri=${encodeURIComponent(LOGOUT_URL)}`

    window.location.href = logoutUrl
  }

  return {
    token,
    accessToken,
    loading,
    error,
    logout,
    isAuthenticated: !!token,
    getValidIdToken,
    getValidAccessToken,
    getUserId
  }
}
