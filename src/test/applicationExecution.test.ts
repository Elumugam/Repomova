import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractGitHubRepoInfo,
  injectBaseHref,
  fetchRepositoryHtml,
} from '../lib/staticPreview';
import {
  detectFramework,
  allocateFreePort,
  stopAppInstance,
  startStaticServer,
  appPortRegistry,
  runningInstances,
  performHttpHealthCheck,
} from '../server/runtimeGateway';
import { useWorkspaceStore } from '../store';
import type { ConnectedApp } from '../types';

describe('Real Application Execution & Multi-Repository Management', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-exec-test-'));
    appPortRegistry.clear();
    for (const [id] of runningInstances) {
      stopAppInstance(id);
    }
    useWorkspaceStore.setState({
      connectedApps: [],
      openTabs: [],
      activeTabId: null,
      activeView: 'home',
    });
  });

  afterEach(() => {
    for (const [id] of runningInstances) {
      stopAppInstance(id);
    }
    appPortRegistry.clear();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('1. Genuine Static Application Resolution (2048 & Static Sites)', () => {
    it('extracts GitHub repository information accurately from URLs and short names', () => {
      const fromFull = extractGitHubRepoInfo('https://github.com/gabrielecirulli/2048.git');
      expect(fromFull).toEqual({ owner: 'gabrielecirulli', repo: '2048' });

      const fromNoGit = extractGitHubRepoInfo('https://github.com/gabrielecirulli/2048');
      expect(fromNoGit).toEqual({ owner: 'gabrielecirulli', repo: '2048' });

      const fromShort = extractGitHubRepoInfo('gabrielecirulli/2048');
      expect(fromShort).toEqual({ owner: 'gabrielecirulli', repo: '2048' });
    });

    it('injects CDN base href into HTML head so all relative assets resolve correctly without mock text', () => {
      const rawHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>2048</title><link href="style/main.css" rel="stylesheet"><script src="js/application.js"></script></head><body><div class="grid"></div></body></html>`;
      const baseHref = 'https://cdn.jsdelivr.net/gh/gabrielecirulli/2048@master/';
      const injected = injectBaseHref(rawHtml, baseHref);

      expect(injected).toContain('<base href="https://cdn.jsdelivr.net/gh/gabrielecirulli/2048@master/">');
      expect(injected).toContain('<title>2048</title>');
      expect(injected).toContain('style/main.css');
      expect(injected).toContain('js/application.js');
      // Crucial: strictly never include the mock status screen
      expect(injected).not.toContain('Running in Cloud Preview');
      expect(injected).not.toContain('Application services initialized and running');
    });

    it('fetches genuine 2048 repository files from GitHub and resolves playable application content', async () => {
      const result = await fetchRepositoryHtml('https://github.com/gabrielecirulli/2048.git', '2048');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.branch).toBe('master');
        expect(result.html).toContain('2048');
        expect(result.html).toContain('js/application.js');
        expect(result.html).toContain('style/main.css');
        expect(result.html).toContain('<base href="https://cdn.jsdelivr.net/gh/gabrielecirulli/2048@master/">');
        expect(result.previewUrl).toContain('data:text/html;charset=utf-8,');
        // Must NEVER contain generic placeholder text
        expect(result.html).not.toContain('Running in Cloud Preview');
      }
    });

    it('local static server serves real static files with correct CORS and frame headers', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'index.html'),
        '<!DOCTYPE html><html><body><div id="game-2048">Playable 2048 Game</div></body></html>'
      );
      fs.writeFileSync(path.join(tempDir, 'style.css'), 'body { background: #faf8ef; }');

      const port = await allocateFreePort('app-2048-local');
      const server = await startStaticServer(tempDir, port);

      runningInstances.set('app-2048-local', {
        appId: 'app-2048-local',
        port,
        server,
        runtimeType: 'static',
        servedDir: tempDir,
        startedAt: new Date().toISOString(),
      });

      const health = await performHttpHealthCheck(`http://127.0.0.1:${port}/`, 5, 50);
      expect(health.healthy).toBe(true);
      expect(health.status).toBe(200);

      // Verify asset serving
      const res = await fetch(`http://127.0.0.1:${port}/style.css`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('#faf8ef');
      expect(res.headers.get('content-type')).toContain('text/css');
      expect(res.headers.get('x-frame-options')).toBe('ALLOWALL');
    });
  });

  describe('2. Multi-Repository Concurrency & Port Allocation', () => {
    it('manages distinct isolated ports for multiple concurrent connected repositories', async () => {
      const portA = await allocateFreePort('app-alpha');
      const portB = await allocateFreePort('app-beta');
      const portC = await allocateFreePort('app-gamma');

      expect(portA).not.toBe(portB);
      expect(portB).not.toBe(portC);
      expect(portA).not.toBe(portC);

      expect(appPortRegistry.get('app-alpha')).toBe(portA);
      expect(appPortRegistry.get('app-beta')).toBe(portB);
      expect(appPortRegistry.get('app-gamma')).toBe(portC);
    });

    it('runs multiple application instances simultaneously without collision', async () => {
      const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-appA-'));
      const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-appB-'));
      fs.writeFileSync(path.join(dirA, 'index.html'), '<html><body>App Alpha 200</body></html>');
      fs.writeFileSync(path.join(dirB, 'index.html'), '<html><body>App Beta 200</body></html>');

      const portA = await allocateFreePort('appA');
      const portB = await allocateFreePort('appB');

      const serverA = await startStaticServer(dirA, portA);
      const serverB = await startStaticServer(dirB, portB);

      runningInstances.set('appA', {
        appId: 'appA',
        port: portA,
        server: serverA,
        runtimeType: 'static',
        startedAt: new Date().toISOString(),
      });
      runningInstances.set('appB', {
        appId: 'appB',
        port: portB,
        server: serverB,
        runtimeType: 'static',
        startedAt: new Date().toISOString(),
      });

      const checkA = await performHttpHealthCheck(`http://127.0.0.1:${portA}/`, 3, 50);
      const checkB = await performHttpHealthCheck(`http://127.0.0.1:${portB}/`, 3, 50);

      expect(checkA.healthy).toBe(true);
      expect(checkB.healthy).toBe(true);

      // Stopping App A leaves App B running untouched
      stopAppInstance('appA');
      expect(runningInstances.has('appA')).toBe(false);
      expect(runningInstances.has('appB')).toBe(true);

      const checkBAfter = await performHttpHealthCheck(`http://127.0.0.1:${portB}/`, 3, 50);
      expect(checkBAfter.healthy).toBe(true);

      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    });
  });

  describe('3. Workspace Tab Independence & Non-Duplication', () => {
    it('creates an empty workspace without duplicating running application when + is clicked', () => {
      const app1: ConnectedApp = {
        id: 'app-2048',
        userId: 'u1',
        repoOwner: 'gabrielecirulli',
        repoName: '2048',
        repoFullName: 'gabrielecirulli/2048',
        repoUrl: 'https://github.com/gabrielecirulli/2048',
        defaultBranch: 'master',
        cloneStatus: 'cloned',
        runtimeType: 'static',
        status: 'running',
        port: 3001,
        previewUrl: 'http://127.0.0.1:3001',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const store = useWorkspaceStore.getState();
      store.addConnectedApp(app1);
      store.openTab({
        id: 'tab-1',
        appId: app1.id,
        title: app1.repoName,
        status: 'running',
      });

      expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1');

      // Click + button (openNewWorkspace)
      const newTabId = useWorkspaceStore.getState().openNewWorkspace();
      const stateAfter = useWorkspaceStore.getState();

      expect(stateAfter.openTabs).toHaveLength(2);
      expect(stateAfter.activeTabId).toBe(newTabId);

      // Verify the new tab is EMPTY and does NOT duplicate app-2048
      const newTab = stateAfter.openTabs.find((t) => t.id === newTabId);
      expect(newTab).toBeDefined();
      expect(newTab?.appId).toBe('');
      expect(newTab?.title).toBe('New Workspace');

      // Previous app-2048 remains running and intact
      expect(stateAfter.connectedApps[0].status).toBe('running');
    });

    it('closing one workspace tab does not stop or affect other running applications', () => {
      const app1: ConnectedApp = {
        id: 'app-1',
        userId: 'u1',
        repoOwner: 'test',
        repoName: 'app-one',
        repoFullName: 'test/app-one',
        repoUrl: 'https://github.com/test/app-one',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'static',
        status: 'running',
        port: 4101,
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const app2: ConnectedApp = {
        id: 'app-2',
        userId: 'u1',
        repoOwner: 'test',
        repoName: 'app-two',
        repoFullName: 'test/app-two',
        repoUrl: 'https://github.com/test/app-two',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'static',
        status: 'running',
        port: 4102,
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const store = useWorkspaceStore.getState();
      store.addConnectedApp(app1);
      store.addConnectedApp(app2);
      store.openTab({ id: 'tab-1', appId: app1.id, title: app1.repoName, status: 'running' });
      store.openTab({ id: 'tab-2', appId: app2.id, title: app2.repoName, status: 'running' });

      // Close Tab 1
      store.closeTab('tab-1');

      const updated = useWorkspaceStore.getState();
      expect(updated.openTabs).toHaveLength(1);
      expect(updated.openTabs[0].id).toBe('tab-2');
      expect(updated.activeTabId).toBe('tab-2');

      // Both apps remain connected and running in the store
      const foundApp1 = updated.connectedApps.find((a) => a.id === 'app-1');
      const foundApp2 = updated.connectedApps.find((a) => a.id === 'app-2');
      expect(foundApp1?.status).toBe('running');
      expect(foundApp2?.status).toBe('running');
    });

    it('switching tabs does not restart the running application', () => {
      const store = useWorkspaceStore.getState();
      store.openTab({ id: 'tab-A', appId: 'app-A', title: 'A', status: 'running' });
      store.openTab({ id: 'tab-B', appId: 'app-B', title: 'B', status: 'running' });

      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-B');

      // Switch to Tab A
      store.setActiveTab('tab-A');
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-A');

      // Switch back to Tab B
      store.setActiveTab('tab-B');
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-B');
      expect(useWorkspaceStore.getState().openTabs[1].status).toBe('running');
    });
  });

  describe('4. Missing Configuration & Error Diagnostics', () => {
    it('detects required environment variables from .env.example accurately', () => {
      fs.writeFileSync(
        path.join(tempDir, '.env.example'),
        'API_KEY=\nDATABASE_URL=\nPORT=3000\nOPTIONAL_VAR=sample\n'
      );
      const res = detectFramework(tempDir);
      expect(res.detectedEnvVars).toBeDefined();

      const requiredVars = (res.detectedEnvVars || []).filter((v) => v.required);
      expect(requiredVars.map((v) => v.key)).toEqual(['API_KEY', 'DATABASE_URL']);

      const apiKeyVar = (res.detectedEnvVars || []).find((v) => v.key === 'API_KEY');
      expect(apiKeyVar?.isSecret).toBe(true);
    });

    it('reports missing configuration when package.json lacks dev/start scripts and main entry point', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'broken-package',
          version: '1.0.0',
        })
      );
      const res = detectFramework(tempDir);
      expect(res.missingConfigReason).toContain('package.json is missing required start/dev scripts');
      expect(res.hasWebInterface).toBe(false);
    });

    it('rejects health check if server does not respond with valid HTML 200', async () => {
      const port = await allocateFreePort('app-bad');
      const health = await performHttpHealthCheck(`http://127.0.0.1:${port}/`, 2, 50);
      expect(health.healthy).toBe(false);
      expect(health.reason).toBeDefined();
    });
  });
});
