/**
 * Shared Google Identity Services helper.
 *
 * Architecture:
 *  - initialize() is called ONCE per browser session (window flag, HMR-safe).
 *  - Button clicks go directly to the OAuth popup — reliable cross-browser.
 *  - prompt() is only used for passive One Tap on mount (optional, best-effort).
 *  - use_fedcm_for_prompt: true silences the deprecation warning for passive prompt.
 *  - revokeGoogleCredential never clears the initialized flag.
 */

const INIT_KEY = '__gsi_initialized__'
const CB_KEY = '__gsi_callback__'
const LISTENER_KEY = '__gsi_msg_listener__'
const CALLBACK_PATH = '/auth/google/callback'  // ← must match Google Cloud Console

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

  // Register postMessage listener for the OAuth popup callback (once only)
  if (!window[LISTENER_KEY]) {
    window[LISTENER_KEY] = true
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'GOOGLE_AUTH') return
      const { idToken, error } = event.data
      if (idToken && window[CB_KEY]) {
        window[CB_KEY]({ credential: idToken })
      } else if (error) {
        console.warn('[googleAuth] OAuth callback error:', error)
      }
    })
  }

  return true
}

/**
 * Passive One Tap prompt — called on mount, best-effort.
 * Silently does nothing if FedCM is unavailable or no Google session exists.
 * Do NOT call this on button click — use triggerGoogleSignIn() instead.
 */
export function triggerOneTap() {
  if (!window.google?.accounts?.id) return
  window.google.accounts.id.prompt()
}

/**
 * Called when the user explicitly clicks "Sign in with Google".
 * Opens a standard OAuth popup → redirects to /auth/google/callback → postMessage back.
 */
export function triggerGoogleSignIn() {
  openGoogleOAuthPopup()
}

function openGoogleOAuthPopup() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const redirectUri = window.location.origin + CALLBACK_PATH  // ← includes /auth/google/callback
  const nonce = crypto.randomUUID()

  console.log('[googleAuth] Redirect URI being sent:', redirectUri)

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