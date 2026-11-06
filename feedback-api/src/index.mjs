const MAX_BODY_BYTES = 8_192;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_BUILD_LENGTH = 64;
const CATEGORIES = new Set(['bug', 'idea', 'usability', 'other']);

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = String(env.ALLOWED_ORIGINS ?? 'https://babelshelf.com')
    .split(',')
    .map((value) => value.trim());
  return allowed.includes(origin);
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function requestError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function readBoundedBody(request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw requestError('too-large', 413);
  }
  if (!request.body) throw requestError('missing-body', 400);

  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        throw requestError('too-large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function normalizedText(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

function validateFeedback(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const category = normalizedText(input.category);
  const message = normalizedText(input.message);
  const build = normalizedText(input.build);
  if (
    !CATEGORIES.has(category)
    || !message
    || message.length > MAX_MESSAGE_LENGTH
    || build.length > MAX_BUILD_LENGTH
    || !/^[a-zA-Z0-9._-]{0,64}$/.test(build)
  ) {
    return null;
  }

  return { category, message, build };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/v1/feedback') return json({ error: 'not-found' }, 404);

    const origin = request.headers.get('origin') ?? '';
    if (!isAllowedOrigin(origin, env)) return json({ error: 'origin-not-allowed' }, 403);
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') {
      return json({ error: 'method-not-allowed' }, 405, { allow: 'POST, OPTIONS', ...headers });
    }
    if (!String(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return json({ error: 'json-required' }, 415, headers);
    }

    try {
      const input = JSON.parse(await readBoundedBody(request));
      const feedback = validateFeedback(input);
      if (!feedback) return json({ error: 'invalid-feedback' }, 400, headers);

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO feedback (id, created_at, category, message, app_build) VALUES (?, ?, ?, ?, ?)',
      ).bind(id, createdAt, feedback.category, feedback.message, feedback.build || null).run();

      return json({ ok: true }, 201, headers);
    } catch (error) {
      if (error?.status === 413) return json({ error: 'feedback-too-large' }, 413, headers);
      if (error instanceof SyntaxError || error instanceof TypeError) {
        return json({ error: 'invalid-feedback' }, 400, headers);
      }
      return json({ error: 'feedback-unavailable' }, 503, headers);
    }
  },
};
