import { promises as fs } from 'fs';
import * as path from 'path';

class FileMutex {
  private queue: Promise<any> = Promise.resolve();

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    // Suppress errors on the main queue chain to prevent locking up the mutex
    this.queue = next.then(() => {}, () => {});
    return next;
  }
}

export class FileMutator {
  private fileLocks = new Map<string, FileMutex>();

  /**
   * Helper to serialize execution per file path
   */
  private async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    let lock = this.fileLocks.get(filePath);
    if (!lock) {
      lock = new FileMutex();
      this.fileLocks.set(filePath, lock);
    }
    return lock.acquire(fn);
  }

  /**
   * Updates a locale JSON file on disk atomically and safely.
   * Enforces development mode checks, path traversal mitigation, key depth restrictions,
   * structural JSON validation, and concurrency serialization.
   */
  async updateLocaleKey(
    basePath: string,
    locale: string,
    keyPath: string,
    newValue: string
  ): Promise<void> {
    // RULE GEN-001: DEVELOPMENT-ONLY ENFORCEMENT
    if (process.env['NODE_ENV'] !== 'development') {
      throw new Error('[i18n-lens] FileMutator can only be executed in development mode.');
    }

    // RULE SRV-002: PATH TRAVERSAL PREVENTION
    // Reject any locale string containing invalid characters
    if (
      locale.includes('..') ||
      locale.includes('/') ||
      locale.includes('\\') ||
      locale.includes('%') ||
      locale.includes('\0')
    ) {
      throw new Error(`[i18n-lens] Path traversal attempt detected in locale identifier: "${locale}"`);
    }

    const resolvedBasePath = path.resolve(basePath);
    const localeDir = path.resolve(resolvedBasePath, locale);
    
    let filePath = '';
    let mutationKeyPath = keyPath;
    let isNamespaceDir = false;

    try {
      const stats = await fs.stat(localeDir);
      if (stats.isDirectory()) {
        isNamespaceDir = true;
      }
    } catch {}

    if (isNamespaceDir) {
      const firstDot = keyPath.indexOf('.');
      if (firstDot !== -1) {
        const namespace = keyPath.substring(0, firstDot);
        mutationKeyPath = keyPath.substring(firstDot + 1);
        filePath = path.resolve(localeDir, `${namespace}.json`);
      } else {
        filePath = path.resolve(localeDir, `${keyPath}.json`);
        mutationKeyPath = '';
      }
    } else {
      filePath = path.resolve(resolvedBasePath, `${locale}.json`);
    }

    if (!filePath.startsWith(resolvedBasePath)) {
      throw new Error(`[i18n-lens] Path traversal attempt: Resolved file path must start with basePath.`);
    }

    // Perform atomic operation within a file lock to guarantee concurrency safety (RULE SRV-006)
    await this.withLock(filePath, async () => {
      let currentData: Record<string, any> = {};

      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        try {
          const parsed = JSON.parse(fileContent);
          
          // RULE SRV-004: JSON PARSE VALIDATION
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Root must be an object');
          }
          currentData = parsed;
        } catch (parseError: any) {
          throw new Error(
            `[i18n-lens] Invalid locale file: root must be an object. Code: INVALID_LOCALE. Original error: ${parseError.message}`
          );
        }
      } catch (err: any) {
        // If file does not exist, initialize it as empty object
        if (err.code !== 'ENOENT') {
          throw new Error(
            `[i18n-lens] Failed to read locale file at ${filePath}. Operation: read. Original error: ${err.message}`
          );
        }
      }

      // Update nested property using safe array traversal (RULE SEC-003 & RULE SRV-003)
      if (mutationKeyPath) {
        this.setNestedProperty(currentData, mutationKeyPath, newValue);
      } else {
        // Root value mutation inside split JSON files (rare but possible: e.g. key has no dot)
        throw new Error('[i18n-lens] Invalid namespace key path: must contain at least one nested key.');
      }

      // RULE SEC-004: VALIDATE JSON BEFORE WRITE
      let stringified: string;
      try {
        stringified = JSON.stringify(currentData, null, 2);
        JSON.parse(stringified); // Paranoid check
      } catch (err: any) {
        throw new Error(
          `[i18n-lens] Produced JSON is invalid or has circular references. Original error: ${err.message}`
        );
      }

      // RULE SRV-001: ATOMIC WRITES ONLY
      const tempPath = `${filePath}.tmp`;
      try {
        await fs.writeFile(tempPath, stringified, 'utf-8');
      } catch (err: any) {
        throw new Error(
          `[i18n-lens] Failed to write temp file at ${tempPath}. Operation: write. Original error: ${err.message}`
        );
      }

      try {
        await fs.rename(tempPath, filePath);
      } catch (err: any) {
        // Attempt clean up of temp file
        try {
          await fs.unlink(tempPath);
        } catch (unlinkErr) {
          // Ignore unlink error to bubble original rename error
        }
        throw new Error(
          `[i18n-lens] Failed to rename temp file to target at ${filePath}. Operation: rename. Original error: ${err.message}`
        );
      }

      // RULE SEC-001: NEVER LOG TRANSLATION VALUES
      console.log(`[i18n-lens] Updated key '${keyPath}' in locale '${locale}'`);
    });
  }

  /**
   * Traverse dynamic dot paths and insert/update property keys.
   * Limits key depth to 30 levels to prevent stack overflow.
   */
  private setNestedProperty(obj: Record<string, any>, keyPath: string, value: string): void {
    const keys = keyPath.split('.');
    
    // RULE SRV-003: KEY DEPTH LIMIT
    if (keys.length > 30) {
      throw new Error(`[i18n-lens] Key depth limit exceeded. Maximum depth is 30 levels.`);
    }

    let current = obj;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;

      // If we are at the target key leaf
      if (i === keys.length - 1) {
        current[key] = value;
        return;
      }

      // Handle intermediate object mapping
      if (!(key in current) || current[key] === null || typeof current[key] !== 'object' || Array.isArray(current[key])) {
        current[key] = {};
      }

      current = current[key];
    }
  }
}
