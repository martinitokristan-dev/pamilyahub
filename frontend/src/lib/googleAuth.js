/**
 * Shared Google Identity Services helper.
 *
 * Architecture:
 *  - initialize() is called ONCE per browser session (window flag, HMR-safe).
 *  - triggerGoogleSignIn() uses GSI's native popup via a hidden renderButton.
 *  - This avoids manual OAuth URL construction which can be blocked in production.
 *  - use_fedcm_for_prompt: true silences the deprecation warning for passive prompt.
 *  - revokeGoogleCredential never clears the initialized flag.
 */

const INIT_KEY = '__gsi_initialized__'
const CB_KEY = '__gsi_callback__'
const HIDDEN_BTN_KEY = '__gsi_hidden_btn__'

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
      ux_mode: 'popup',
      use_fedcm_for_prompt: true,
    })
    window[INIT_KEY] = true
  }

  window.google.accounts.id.disableAutoSelect()

  // Create a hidden container for GSI's rendered button.
  // We programmatically click it when the user hits our custom button.
  if (!window[HIDDEN_BTN_KEY]) {
    let container = document.getElementById('__gsi_hidden_container__')
    if (!container) {
      container = document.createElement('div')
      container.id = '__gsi_hidden_container__'
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;'
      document.body.appendChild(container)
    }
    window.google.accounts.id.renderButton(container, {
      type: 'icon',
      size: 'large',
    })
    window[HIDDEN_BTN_KEY] = container
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
 * Programmatically clicks the hidden GSI-rendered button to launch the native popup.
 * This is the officially supported method and works reliably in production.
 */
export function triggerGoogleSignIn() {
  const container = window[HIDDEN_BTN_KEY]
  if (container) {
    // GSI renders an iframe with a clickable button inside; find and click it
    const iframe = container.querySelector('iframe')
    if (iframe) {
      // Can't click inside cross-origin iframe; fall back to prompt()
      window.google?.accounts?.id?.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // prompt() was suppressed — fall back to OAuth code flow popup
          openGoogleOAuthPopup()
        }
      })
      return
    }
    // Try clicking a regular button if present (non-iframe render)
    const btn = container.querySelector('[role="button"]') || container.querySelector('div[tabindex]')
    if (btn) {
      btn.click()
      return
    }
  }
  // Fallback: use prompt(), then OAuth popup if prompt fails
  if (window.google?.accounts?.id) {
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        openGoogleOAuthPopup()
      }
    })
  } else {
    openGoogleOAuthPopup()
  }
}

/**
 * Fallback: manual OAuth popup using authorization code flow.
 * Only used when GSI prompt() is unavailable/suppressed.
 */
function openGoogleOAuthPopup() {
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

  // Listen for the callback postMessage
  const handler = (event) => {
    if (event.origin !== window.location.origin) return
    if (event.data?.type !== 'GOOGLE_AUTH') return
    window.removeEventListener('message', handler)
    const { idToken, error } = event.data
    if (idToken && window[CB_KEY]) {
      window[CB_KEY]({ credential: idToken })
    } else if (error) {
      console.warn('[googleAuth] OAuth callback error:', error)
    }
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