import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FileMutator } from '../../src/server/file-mutator.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock the 'fs' promises module completely
vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
      unlink: vi.fn(),
      stat: vi.fn(),
    },
  };
});

describe('FileMutator', () => {
  let mutator: FileMutator;
  const BASE_PATH = '/project/locales';

  beforeEach(() => {
    mutator = new FileMutator();
    vi.stubEnv('NODE_ENV', 'development');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── Happy Path ────────────────────────────────────────────────────────────

  it('should update a flat key when path has one segment', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ greeting: 'Hello' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    await mutator.updateLocaleKey(BASE_PATH, 'en', 'greeting', 'Hi');

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('en.json.tmp'),
      JSON.stringify({ greeting: 'Hi' }, null, 2),
      'utf-8'
    );
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringContaining('en.json.tmp'),
      expect.stringContaining('en.json')
    );
  });

  it('should update a nested key when path has 3 segments', async () => {
    const initial = { dashboard: { header: { title: 'Old' } } };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(initial));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    await mutator.updateLocaleKey(BASE_PATH, 'ar', 'dashboard.header.title', 'New');

    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string);
    expect(written.dashboard.header.title).toBe('New');
  });

  it('should create intermediate objects when key path does not exist', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    await mutator.updateLocaleKey(BASE_PATH, 'en', 'a.b.c', 'value');

    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string);
    expect(written.a.b.c).toBe('value');
  });

  it('should preserve unrelated keys when updating a specific key', async () => {
    const initial = { a: 'keep', b: 'keep', c: 'change' };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(initial));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    await mutator.updateLocaleKey(BASE_PATH, 'en', 'c', 'changed');

    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string);
    expect(written.a).toBe('keep');
    expect(written.b).toBe('keep');
    expect(written.c).toBe('changed');
  });

  it('should initialize locale file as empty object when file does not exist', async () => {
    const readError: any = new Error('ENOENT');
    readError.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(readError);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    await mutator.updateLocaleKey(BASE_PATH, 'en', 'greeting', 'Hello');

    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0]![1] as string);
    expect(written).toEqual({ greeting: 'Hello' });
  });

  // ─── Error Cases ────────────────────────────────────────────────────────────

  it('should throw when running inside non-development environment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'en', 'greeting', 'Hi')
    ).rejects.toThrow(/development/i);
  });

  it('should throw when locale string contains path traversal characters', async () => {
    await expect(
      mutator.updateLocaleKey(BASE_PATH, '../etc/passwd', 'key', 'value')
    ).rejects.toThrow(/path traversal/i);

    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'sub/folder', 'key', 'value')
    ).rejects.toThrow(/path traversal/i);
  });

  it('should throw when key depth exceeds 30 levels', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));
    const deepKey = Array(31).fill('a').join('.'); // 31 segments
    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'en', deepKey, 'value')
    ).rejects.toThrow(/key depth/i);
  });

  it('should throw when locale file content is invalid JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{ not valid json }');
    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'en', 'greeting', 'Hi')
    ).rejects.toThrow(/invalid locale file/i);
  });

  it('should throw when locale file parses to an array root', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(['item1', 'item2']));
    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'en', 'greeting', 'Hi')
    ).rejects.toThrow(/must be an object/i);
  });

  it('should throw when file reading fails with non-ENOENT code', async () => {
    const error: any = new Error('Permission Denied');
    error.code = 'EACCES';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'en', 'greeting', 'Hi')
    ).rejects.toThrow(/failed to read/i);
  });

  it('should clean up .tmp file when file renaming fails', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ k: 'v' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockRejectedValue(new Error('disk full'));
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await expect(
      mutator.updateLocaleKey(BASE_PATH, 'en', 'k', 'new')
    ).rejects.toThrow('disk full');

    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('en.json.tmp'));
  });

  it('should serialise concurrent updates to the same locale file path', async () => {
    const callOrder: number[] = [];
    
    vi.mocked(fs.readFile)
      .mockImplementationOnce(async () => {
        // First call takes longer to simulate disk operation delay
        await new Promise(resolve => setTimeout(resolve, 20));
        callOrder.push(1);
        return JSON.stringify({ count: 0 });
      })
      .mockImplementationOnce(async () => {
        // Second call executes
        callOrder.push(2);
        return JSON.stringify({ count: 1 });
      });

    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    const p1 = mutator.updateLocaleKey(BASE_PATH, 'en', 'count', '1');
    const p2 = mutator.updateLocaleKey(BASE_PATH, 'en', 'count', '2');

    await Promise.all([p1, p2]);

    expect(callOrder).toEqual([1, 2]);
  });

  it('should update key inside a namespace file when locale is a directory', async () => {
    // Mock stat to say locales/en is a directory
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ title: 'Old' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);

    await mutator.updateLocaleKey(BASE_PATH, 'en', 'common.title', 'New');

    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('en', 'common.json')),
      'utf-8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('en', 'common.json.tmp')),
      JSON.stringify({ title: 'New' }, null, 2),
      'utf-8'
    );
  });
});
