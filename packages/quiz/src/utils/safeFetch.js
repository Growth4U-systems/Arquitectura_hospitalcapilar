/**
 * safeFetch — fetch wrapper with timeout and retry for critical API calls.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {object} config
 * @param {number} config.timeoutMs - Timeout in ms (default 15000)
 * @param {number} config.retries - Number of retries on network error (default 1)
 * @param {string} config.label - Label for logging (e.g. 'GHL', 'Stripe')
 * @returns {Promise<Response>}
 */
export async function safeFetch(url, options = {}, config = {}) {
  const { timeoutMs = 15000, retries = 1, label = 'API' } = config;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (err.name === 'AbortError') {
        console.error(`[${label}] Request timed out after ${timeoutMs}ms (attempt ${attempt + 1}/${retries + 1})`);
      } else {
        console.error(`[${label}] Network error (attempt ${attempt + 1}/${retries + 1}):`, err.message);
      }

      // Don't retry on abort (timeout) — the server might have received the request
      if (err.name === 'AbortError') break;

      // Wait briefly before retrying
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
