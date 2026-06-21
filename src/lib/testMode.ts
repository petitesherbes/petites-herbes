export const TEST_MODE_KEY = 'test_mode'

export function loadTestMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TEST_MODE_KEY) === 'true'
}

export function saveTestMode(val: boolean) {
  localStorage.setItem(TEST_MODE_KEY, String(val))
  window.dispatchEvent(new Event('test-mode-changed'))
}
