import { redis } from '../config/redis.js';

const TOKEN_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local maxTokens = tonumber(ARGV[1])
  local refillRate = tonumber(ARGV[2])
  local windowMs = tonumber(ARGV[3])
  local now = tonumber(ARGV[4])
  local tokensToConsume = tonumber(ARGV[5])
  
  local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
  local tokens = tonumber(bucket[1]) or maxTokens
  local lastRefill = tonumber(bucket[2]) or now
  
  local elapsed = now - lastRefill
  
  if elapsed > 0 then
    local tokensToAdd = math.floor((elapsed / windowMs) * refillRate)
    tokens = math.min(maxTokens, tokens + tokensToAdd)
    lastRefill = now
  end
  
  local allowed = 0
  if tokens >= tokensToConsume then
    tokens = tokens - tokensToConsume
    allowed = 1
  end
  
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, math.ceil((windowMs * 2) / 1000))
  
  local resetTime = now
  if allowed == 0 then
    local tokensNeeded = tokensToConsume - tokens
    local timeToWait = math.ceil((tokensNeeded / refillRate) * windowMs)
    resetTime = now + timeToWait
  end
  
  return {allowed, tokens, resetTime}
`;

function defaultKeyGenerator(req) {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = 'unknown';
  
  if (forwarded) {
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    ip = forwardedStr.split(',')[0].trim();
  } else {
    ip = req.ip || req.connection?.remoteAddress || 'unknown';
  }
  
  const method = req.method || 'GET';
  const path = req.path || req.url?.split('?')[0] || '/';
  
  return `${ip}:${method}:${path}`;
}

export function createRateLimiter(options = {}) {
  const {
    maxTokens = 100,
    refillRate = 10,
    windowMs = 1000,
    keyPrefix = 'ratelimit:',
    keyGenerator = defaultKeyGenerator,
    onLimitReached = null,
  } = options;

  if (maxTokens <= 0 || refillRate <= 0 || windowMs <= 0) {
    throw new Error('maxTokens, refillRate, and windowMs must be positive numbers');
  }

  let scriptSha = null;
  const loadScript = async () => {
    if (!scriptSha) {
      try {
        scriptSha = await redis.script('LOAD', TOKEN_BUCKET_SCRIPT);
      } catch (error) {
        console.error('Failed to load rate limiter script:', error);
        throw error;
      }
    }
    return scriptSha;
  };

  return async (req, res, next) => {
    try {
      const identifier = keyGenerator(req);
      const key = `${keyPrefix}${identifier}`;

      const sha = await loadScript();
      const now = Date.now();

      const result = await redis.evalsha(
        sha,
        1,
        key,
        maxTokens.toString(),
        refillRate.toString(),
        windowMs.toString(),
        now.toString(),
        '1'
      );

      const allowed = Array.isArray(result) ? result[0] : result;
      const remainingTokens = Array.isArray(result) ? parseInt(result[1], 10) || 0 : 0;
      const resetTime = Array.isArray(result) ? parseInt(result[2], 10) || now + windowMs : now + windowMs;
      const isAllowed = allowed === 1 || allowed === '1';

      res.setHeader('X-RateLimit-Limit', maxTokens.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remainingTokens).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      if (!isAllowed) {
        if (onLimitReached) {
          onLimitReached(req, res);
        }

        res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfterSeconds: Math.ceil((resetTime - now) / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

export default function rateLimiter(requests, windowMs) {
  if (typeof requests !== 'number' || requests <= 0) {
    throw new Error('requests must be a positive number');
  }
  
  if (typeof windowMs !== 'number' || windowMs <= 0) {
    throw new Error('windowMs must be a positive number (milliseconds)');
  }

  return createRateLimiter({
    maxTokens: requests,
    refillRate: requests,
    windowMs: windowMs,
  });
}
