'use strict';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 4xx other than 429 will not fix themselves on retry.
function isRetryable(status) {
  return status === 429 || status >= 500;
}

async function fetchText(url, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = 30000,
    retries = 3,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...headers,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        if (!isRetryable(res.status)) throw Object.assign(err, { fatal: true });
        throw err;
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if (err.fatal) break;
    }
  }
  throw new Error(`${url} — ${lastError.message}`);
}

async function fetchJson(url, options) {
  return JSON.parse(await fetchText(url, options));
}

module.exports = { fetchText, fetchJson, sleep, USER_AGENT };
