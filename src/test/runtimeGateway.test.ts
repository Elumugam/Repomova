import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectFramework,
  computeLockfileHash,
  performHttpHealthCheck,
  allocateFreePort,
  releaseAppPort,
  stopAppInstance,
  startStaticServer,
  appPortRegistry,
  runningInstances,
  parseEnvExample,
} from '../server/runtimeGateway';

describe('runtimeGateway', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-test-'));
    // Clean registries between tests
    appPortRegistry.clear();
    for (const [id] of runningInstances) {
      stopAppInstance(id);
    }
  });

  afterEach(() => {
    for (const [id] of runningInstances) {
      stopAppInstance(id);
    }
    appPortRegistry.clear();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectFramework & command prefilling', () => {
    it('detects static sites (like 2048) with index.html and prefill commands', () => {
      fs.writeFileSync(path.join(tempDir, 'index.html'), '<!DOCTYPE html><html><body><h1>2048</h1></body></html>');
      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('static');
      expect(res.details).toContain('Static');
      expect(res.startCommand).toBe('Built-in Static Server');
      expect(res.buildCommand).toBe('None (Static files)');
      expect(res.commandSources?.startCommand).toContain('built-in static server');
      expect(res.commandSources?.buildCommand).toContain('no build step');
    });

    it('detects Next.js projects and prefills scripts from package.json', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: { next: '14.0.0', react: '18.0.0' },
          scripts: { dev: 'next dev', build: 'next build' },
        })
      );
      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('nextjs');
      expect(res.startCommand).toBe('npm run dev');
      expect(res.buildCommand).toBe('npm run build');
      expect(res.commandSources?.startCommand).toContain("scripts.dev");
      expect(res.commandSources?.buildCommand).toContain("scripts.build");
    });

    it('detects Vite projects and prefills scripts', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: { vite: '^5.0.0' },
          scripts: { start: 'vite', build: 'vite build' },
        })
      );
      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('vite');
      expect(res.startCommand).toBe('npm start');
      expect(res.buildCommand).toBe('npm run build');
    });

    it('detects Python projects with entry point commands', () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'fastapi==0.100.0\nuvicorn==0.22.0');
      fs.writeFileSync(path.join(tempDir, 'app.py'), 'print("hello")');
      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('python');
      expect(res.startCommand).toBe('python app.py');
    });

    it('detects Docker projects with docker commands', () => {
      fs.writeFileSync(path.join(tempDir, 'Dockerfile'), 'FROM node:20-alpine');
      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('docker');
      expect(res.startCommand).toBe('docker build & run');
    });

    it('detects Vue, Angular, and Svelte frontend framework projects', () => {
      // Vue
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: { vue: '^3.3.0' },
          scripts: { dev: 'vite' },
        })
      );
      let res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('vue');
      expect(res.hasWebInterface).toBe(true);
      expect(res.startCommand).toBe('npm run dev');

      // Angular
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: { '@angular/core': '^17.0.0' },
          scripts: { start: 'ng serve' },
        })
      );
      res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('angular');
      expect(res.hasWebInterface).toBe(true);
      expect(res.startCommand).toBe('npm start');

      // Svelte
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: { svelte: '^4.0.0' },
          scripts: { dev: 'vite dev' },
        })
      );
      res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('svelte');
      expect(res.hasWebInterface).toBe(true);
    });

    it('detects backend-only API services with hasWebInterface=false', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'payment-api-service',
          dependencies: { express: '^4.18.0', cors: '^2.8.5' },
          scripts: { start: 'node server.js' },
        })
      );
      fs.writeFileSync(path.join(tempDir, 'server.js'), 'const express = require("express");');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('backend');
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toBe('npm start');
      expect(res.details).toContain('Backend API');
    });

    it('detects CLI tools and libraries with hasWebInterface=false and appropriate metadata', () => {
      // CLI Tool with bin
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'repomova-cli-tool',
          bin: { 'my-cli': './bin/index.js' },
          scripts: { test: 'jest' },
        })
      );
      let res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('cli');
      expect(res.hasWebInterface).toBe(false);
      expect(res.details).toContain('CLI');

      // Library package
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'awesome-math-lib',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
        })
      );
      res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('library');
      expect(res.hasWebInterface).toBe(false);
      expect(res.details).toContain('Library');
    });

    it('handles projects with missing package configuration or non-web files without throwing', () => {
      // No package.json, just arbitrary files
      fs.writeFileSync(path.join(tempDir, 'data.csv'), 'id,name\n1,test');
      fs.writeFileSync(path.join(tempDir, 'script.sh'), '#!/bin/bash\necho "run"');

      const res = detectFramework(tempDir);
      expect(res.hasWebInterface).toBe(false);
      expect(res.runtimeType).toBe('unknown');
      expect(res.noWebEntry).toBe(true);
      expect(res.details).toContain('No web entry file found');
    });
  });

  describe('parseEnvExample', () => {
    it('parses variables without inventing credentials, identifies secrets and requirements', () => {
      fs.writeFileSync(
        path.join(tempDir, '.env.example'),
        '# Server configuration\nPORT=3000\nDATABASE_URL=\nAPI_SECRET_KEY=\nOPTIONAL_ANALYTICS_ID=optional\n'
      );
      const vars = parseEnvExample(tempDir);
      expect(vars).toHaveLength(4);

      const secretVar = vars.find((v) => v.key === 'API_SECRET_KEY');
      expect(secretVar).toBeDefined();
      expect(secretVar?.isSecret).toBe(true);
      expect(secretVar?.required).toBe(true); // empty in example -> required

      const dbVar = vars.find((v) => v.key === 'DATABASE_URL');
      expect(dbVar?.required).toBe(true);

      const optVar = vars.find((v) => v.key === 'OPTIONAL_ANALYTICS_ID');
      expect(optVar?.required).toBe(false);
    });

    it('returns empty array when no .env.example exists', () => {
      expect(parseEnvExample(tempDir)).toEqual([]);
    });
  });

  describe('Multi-app port allocation & idempotency (Bug 1)', () => {
    it('allocates distinct conflict-free ports when launching two apps at once', async () => {
      const port1 = await allocateFreePort('app-alpha');
      const port2 = await allocateFreePort('app-beta');

      expect(port1).toBeGreaterThanOrEqual(1024);
      expect(port2).toBeGreaterThanOrEqual(1024);
      expect(port1).not.toBe(port2);

      expect(appPortRegistry.get('app-alpha')).toBe(port1);
      expect(appPortRegistry.get('app-beta')).toBe(port2);
    });

    it('supports launching two static app servers simultaneously on different ports', async () => {
      fs.writeFileSync(path.join(tempDir, 'index.html'), '<h1>App 1</h1>');
      const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-test2-'));
      fs.writeFileSync(path.join(dir2, 'index.html'), '<h1>App 2</h1>');

      const port1 = await allocateFreePort('app-one');
      const port2 = await allocateFreePort('app-two');

      const server1 = await startStaticServer(tempDir, port1);
      runningInstances.set('app-one', {
        appId: 'app-one',
        port: port1,
        server: server1,
        runtimeType: 'static',
        startedAt: new Date().toISOString(),
      });

      const server2 = await startStaticServer(dir2, port2);
      runningInstances.set('app-two', {
        appId: 'app-two',
        port: port2,
        server: server2,
        runtimeType: 'static',
        startedAt: new Date().toISOString(),
      });

      // Both servers run simultaneously without EADDRINUSE
      const healthy1 = await performHttpHealthCheck(`http://127.0.0.1:${port1}`, 3, 50);
      const healthy2 = await performHttpHealthCheck(`http://127.0.0.1:${port2}`, 3, 50);

      expect(healthy1.healthy).toBe(true);
      expect(healthy2.healthy).toBe(true);

      fs.rmSync(dir2, { recursive: true, force: true });
    });

    it('is idempotent: reuses existing port for already running app', async () => {
      const port1 = await allocateFreePort('app-idempotent');
      runningInstances.set('app-idempotent', {
        appId: 'app-idempotent',
        port: port1,
        runtimeType: 'static',
        startedAt: new Date().toISOString(),
      });

      const port2 = await allocateFreePort('app-idempotent');
      expect(port2).toBe(port1);
    });

    it('releases port on stop, enabling clean relaunch', async () => {
      fs.writeFileSync(path.join(tempDir, 'index.html'), '<h1>Relaunch Test</h1>');
      const port = await allocateFreePort('app-relaunch');
      const server = await startStaticServer(tempDir, port);

      runningInstances.set('app-relaunch', {
        appId: 'app-relaunch',
        port,
        server,
        runtimeType: 'static',
        startedAt: new Date().toISOString(),
      });

      expect(runningInstances.has('app-relaunch')).toBe(true);

      // Stop app
      const stopped = stopAppInstance('app-relaunch');
      expect(stopped).toBe(true);
      expect(runningInstances.has('app-relaunch')).toBe(false);
      expect(appPortRegistry.has('app-relaunch')).toBe(false);

      // Relaunch app on same or fresh port without EADDRINUSE
      const newPort = await allocateFreePort('app-relaunch', port);
      const newServer = await startStaticServer(tempDir, newPort);
      expect(newServer).toBeDefined();
      await new Promise((r) => newServer.close(r));
    });

    it('cleans up on failed launch so retry succeeds', async () => {
      const port = await allocateFreePort('app-fail-retry');
      expect(port).toBeGreaterThanOrEqual(1024);
      expect(appPortRegistry.has('app-fail-retry')).toBe(true);

      // Simulate failure cleanup
      releaseAppPort('app-fail-retry');
      expect(appPortRegistry.has('app-fail-retry')).toBe(false);

      // Retry launch succeeds
      const retryPort = await allocateFreePort('app-fail-retry');
      expect(retryPort).toBeGreaterThanOrEqual(1024);
    });
  });

  describe('findEntryPoint & Subfolder Entry Detection', () => {
    it('finds entry point in root directory', async () => {
      const { findEntryPoint } = await import('../server/runtimeGateway');
      fs.writeFileSync(path.join(tempDir, 'index.html'), '<h1>Root</h1>');
      const entry = findEntryPoint(tempDir);
      expect(entry).not.toBeNull();
      expect(entry?.relativeDir).toBe('.');
      expect(entry?.serveDir).toBe(tempDir);
    });

    it('finds entry point in subdirectories (public, dist, build, docs, out)', async () => {
      const { findEntryPoint } = await import('../server/runtimeGateway');
      const subdirs = ['public', 'dist', 'build', 'docs', 'out'];
      for (const sub of subdirs) {
        const subPath = path.join(tempDir, sub);
        fs.mkdirSync(subPath, { recursive: true });
        fs.writeFileSync(path.join(subPath, 'index.html'), `<h1>In ${sub}</h1>`);

        const entry = findEntryPoint(tempDir);
        expect(entry).not.toBeNull();
        expect(entry?.serveDir).toBe(subPath);

        fs.rmSync(subPath, { recursive: true, force: true });
      }
    });

    it('returns null when no index.html exists anywhere', async () => {
      const { findEntryPoint } = await import('../server/runtimeGateway');
      fs.writeFileSync(path.join(tempDir, 'main.c'), '#include <stdio.h>');
      fs.writeFileSync(path.join(tempDir, 'Makefile'), 'all: clean');
      const entry = findEntryPoint(tempDir);
      expect(entry).toBeNull();
    });
  });

  describe('Static Serving & Gateway Prefix Stripping', () => {
    it('serves static files from subfolder and strips gateway prefix (/preview/:appId/)', async () => {
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body><h1>Subfolder App</h1></body></html>');

      const port = await allocateFreePort('app-subfolder');
      const server = await startStaticServer(distDir, port);
      await new Promise((r) => setTimeout(r, 50));

      // Direct request
      const resDirect = await fetch(`http://127.0.0.1:${port}/`);
      expect(resDirect.status).toBe(200);
      const textDirect = await resDirect.text();
      expect(textDirect).toContain('Subfolder App');

      // Proxied request with gateway prefix
      const resProxied = await fetch(`http://127.0.0.1:${port}/preview/app-subfolder/`);
      expect(resProxied.status).toBe(200);
      const textProxied = await resProxied.text();
      expect(textProxied).toContain('Subfolder App');

      await new Promise((r) => server.close(r));
    });

    it('returns 404 when index.html is missing in served directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      const port = await allocateFreePort('app-empty');
      const server = await startStaticServer(emptyDir, port);
      await new Promise((r) => setTimeout(r, 50));

      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).toContain('Not Found');

      await new Promise((r) => server.close(r));
    });
  });

  describe('Detection & Cubes2 reproduction (No web entry point)', () => {
    it('detects Cubes2 (C/Makefile) as unsupported with noWebEntry flag', () => {
      fs.writeFileSync(path.join(tempDir, 'main.c'), 'int main() { return 0; }');
      fs.writeFileSync(path.join(tempDir, 'makefile'), 'all: clean');
      fs.writeFileSync(path.join(tempDir, 'compile.sh'), 'gcc main.c');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('unknown');
      expect(res.noWebEntry).toBe(true);
      expect(res.details).toContain('Native desktop application');
    });

    it('detects projects needing build (has package.json build script and no dist folder)', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'needs-build-app',
          scripts: { build: 'tsc && vite build' },
        })
      );

      const res = detectFramework(tempDir);
      expect(res.hasBuildScript).toBe(true);
      expect(res.needsBuild).toBe(true);
      expect(res.buildCommand).toBe('npm run build');
    });
  });

  describe('computeLockfileHash', () => {
    it('computes sha256 hash of package-lock.json', () => {
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{"lockfileVersion": 3}');
      const hash1 = computeLockfileHash(tempDir);
      expect(hash1).toBeTruthy();
      expect(typeof hash1).toBe('string');

      // Unchanged lockfile gives same hash
      const hash2 = computeLockfileHash(tempDir);
      expect(hash2).toBe(hash1);

      // Modified lockfile gives different hash
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{"lockfileVersion": 3, "changed": true}');
      const hash3 = computeLockfileHash(tempDir);
      expect(hash3).not.toBe(hash1);
    });

    it('returns null if no lockfile exists', () => {
      expect(computeLockfileHash(tempDir)).toBeNull();
    });
  });

  describe('performHttpHealthCheck (Strict HTML 200 requirement)', () => {
    it('marks running ONLY when GET / returns 200 with HTML', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: async () => '<!doctype html><html><body><h1>Running</h1></body></html>',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await performHttpHealthCheck('http://127.0.0.1:4100', 3, 10);
      expect(result.healthy).toBe(true);
      expect(result.status).toBe(200);

      vi.unstubAllGlobals();
    });

    it('fails health check when GET / returns 404 (entry file missing)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Not Found',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await performHttpHealthCheck('http://127.0.0.1:4101', 2, 10);
      expect(result.healthy).toBe(false);
      expect(result.status).toBe(404);
      expect(result.reason).toContain('HTTP 404 Not Found');

      vi.unstubAllGlobals();
    });

    it('fails health check when GET / returns 500 server error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Internal Server Error',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await performHttpHealthCheck('http://127.0.0.1:4102', 2, 10);
      expect(result.healthy).toBe(false);
      expect(result.status).toBe(500);
      expect(result.reason).toContain('HTTP 500 Server Error');

      vi.unstubAllGlobals();
    });

    it('fails health check when 200 returns non-HTML content (e.g. JSON or plain text)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ message: 'API only' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await performHttpHealthCheck('http://127.0.0.1:4103', 2, 10);
      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('HTTP 200 returned non-HTML');

      vi.unstubAllGlobals();
    });

    it('retries and fails when fetch throws repeatedly (server not reachable)', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await performHttpHealthCheck('http://127.0.0.1:9999', 3, 10);
      expect(result.healthy).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.unstubAllGlobals();
    });
  });
});
