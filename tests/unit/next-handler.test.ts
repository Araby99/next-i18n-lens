import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createI18nLensHandler } from '../../src/server/next-handler.js';
import { FileMutator } from '../../src/server/file-mutator.js';
import { promises as fs } from 'fs';

vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
  };
});

vi.mock('../../src/server/file-mutator.js', () => {
  return {
    FileMutator: vi.fn().mockImplementation(() => {
      return {
        updateLocaleKey: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe('createI18nLensHandler', () => {
  const config = { localesPath: '/project/locales' };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return 403 Forbidden when run in non-development mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const handler = createI18nLensHandler(config);
    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en', key: 'title', value: 'Hello' }),
    });

    const response = await handler(request);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 400 Bad Request when request body contains invalid JSON', async () => {
    const handler = createI18nLensHandler(config);
    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'POST',
      body: '{ invalid-json }',
    });

    const response = await handler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 400 Bad Request when locale formatting is invalid', async () => {
    const handler = createI18nLensHandler(config);

    const invalidLocales = ['e', 'english', 'en_US', 'en-US-extra'];
    for (const loc of invalidLocales) {
      const request = new Request('http://localhost:3000/api/mutate', {
        method: 'POST',
        body: JSON.stringify({ locale: loc, key: 'title', value: 'Hello' }),
      });
      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_LOCALE_FORMAT');
    }
  });

  it('should return 400 Bad Request when key formatting is invalid', async () => {
    const handler = createI18nLensHandler(config);

    const invalidKeys = ['', 'a'.repeat(201), 'key$name', 'key/name', 'key\\name'];
    for (const key of invalidKeys) {
      const request = new Request('http://localhost:3000/api/mutate', {
        method: 'POST',
        body: JSON.stringify({ locale: 'en', key, value: 'Hello' }),
      });
      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_KEY_FORMAT');
    }
  });

  it('should return 400 Bad Request when value formatting is invalid', async () => {
    const handler = createI18nLensHandler(config);

    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en', key: 'title', value: 'a'.repeat(10001) }),
    });
    const response = await handler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('INVALID_VALUE_FORMAT');
  });

  it('should call updateLocaleKey and return 200 OK when request payload is valid', async () => {
    const handler = createI18nLensHandler(config);
    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en', key: 'dashboard.title', value: 'Welcome Dashboard' }),
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.key).toBe('dashboard.title');
    expect(data.locale).toBe('en');

    const mutatorInstance = vi.mocked(FileMutator).mock.results[0]?.value;
    expect(mutatorInstance.updateLocaleKey).toHaveBeenCalledWith(
      config.localesPath,
      'en',
      'dashboard.title',
      'Welcome Dashboard'
    );
  });

  it('should return 500 when mutator throws an error', async () => {
    const handler = createI18nLensHandler(config);
    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en', key: 'title', value: 'Hello' }),
    });

    const mutatorInstance = vi.mocked(FileMutator).mock.results[0]?.value;
    vi.mocked(mutatorInstance.updateLocaleKey).mockRejectedValue(new Error('Disk Write Failure'));

    const response = await handler(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.code).toBe('INTERNAL_ERROR');
    expect(data.error).toBe('Disk Write Failure');
  });

  it('should return 204 and correct CORS headers for OPTIONS requests', async () => {
    const handler = createI18nLensHandler(config);
    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3010',
      },
    });

    const response = await handler(request);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3010');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('should accept empty string as a valid translation value', async () => {
    const handler = createI18nLensHandler(config);
    const request = new Request('http://localhost:3000/api/mutate', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en', key: 'title', value: '' }),
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should accept valid regional, script, and three-letter codes under loose regex validation', async () => {
    const handler = createI18nLensHandler(config);
    
    const validLocales = ['es-419', 'zh-Hans', 'zh-Hant', 'en-US', 'ar-EG', 'eng', 'ar'];
    for (const loc of validLocales) {
      const request = new Request('http://localhost:3000/api/mutate', {
        method: 'POST',
        body: JSON.stringify({ locale: loc, key: 'title', value: 'Hello' }),
      });

      const response = await handler(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    }
  });

  it('should handle GET requests and load flat locale JSON file', async () => {
    const handler = createI18nLensHandler(config);
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT')); // not a directory
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ greeting: 'Hello' }));

    const request = new Request('http://localhost:3000/api/mutate?locale=en', {
      method: 'GET',
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.greeting).toBe('Hello');
  });

  it('should handle GET requests and merge split namespace files when locale path is a directory', async () => {
    const handler = createI18nLensHandler(config);
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['common.json' as any, 'auth.json' as any]);
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify({ title: 'Welcome' })) // common.json
      .mockResolvedValueOnce(JSON.stringify({ login: 'Log In' }));  // auth.json

    const request = new Request('http://localhost:3000/api/mutate?locale=en', {
      method: 'GET',
    });

    const response = await handler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.common.title).toBe('Welcome');
    expect(data.auth.login).toBe('Log In');
  });
});
