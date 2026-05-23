/**
 * Shared Google Identity Services helper.
 *
 * Architecture:
 *  - initialize() sets up the GSI callback (ONCE per browser session, HMR-safe).
 *  - triggerGoogleSignIn() opens an OAuth popup → /auth/google/callback → postMessage.
 *  - revokeGoogleCredential never clears the initialized flag.
 */

const INIT_KEY = '__gsi_initialized__'
const CB_KEY = '__gsi_callback__'

/**
 * Initialize Google Identity Services — idempotent and HMR-safe.
 * @param {Function} callback  Credential response handler (receives { credential: idToken })
 * @returns {boolean}          true if the GSI library is loaded
 */
export function initGoogleIdentity(callback) {
  if (!window.google?.accounts?.id) return false

  window[CB_KEY] = callback

  if (!window[INIT_KEY]) {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (window[CB_KEY]) window[CB_KEY](response)
      },
      use_fedcm_for_prompt: true,
    })
    window[INIT_KEY] = true
  }

  window.google.accounts.id.disableAutoSelect()
  return true
}

/**
 * Called when the user explicitly clicks "Sign in with Google".
 * Opens an OAuth popup → redirects to /auth/google/callback → postMessage back.
 */
export function triggerGoogleSignIn() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const redirectUri = window.location.origin + '/auth/google/callback'
  const nonce = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    prompt: 'select_account',
    nonce,
  })

  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    'google-auth',
    'width=500,height=600,left=200,top=100',
  )

  if (!popup) {
    console.warn('[googleAuth] Popup was blocked — allow popups for this site.')
  }

  const authChannel = new BroadcastChannel('google_auth_channel')
  let resolved = false

  const cleanUp = () => {
    resolved = true
    authChannel.close()
    window.removeEventListener('message', handler)
  }

  const handleCredential = (idToken, error) => {
    if (idToken && window[CB_KEY]) {
      window[CB_KEY]({ credential: idToken })
    } else if (error) {
      console.warn('[googleAuth] OAuth callback error:', error)
    }
  }

  // 1. BroadcastChannel listener (Primary)
  authChannel.onmessage = (event) => {
    if (resolved) return
    const { idToken, error } = event.data
    cleanUp()
    handleCredential(idToken, error)
  }

  // 2. window postMessage listener (Fallback)
  const handler = (event) => {
    if (resolved) return
    if (event.origin !== window.location.origin) return
    if (event.data?.type !== 'GOOGLE_AUTH') return
    const { idToken, error } = event.data
    cleanUp()
    handleCredential(idToken, error)
  }
  window.addEventListener('message', handler)
}

/**
 * Revoke Google credential on logout.
 * ⚠️  Never deletes window[INIT_KEY] — initialize() must only run once per page load.
 */
export function revokeGoogleCredential(email) {
  try {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
      if (email) window.google.accounts.id.revoke(email, () => { })
    }
  } catch { /* ignore */ }

  window[CB_KEY] = null
}