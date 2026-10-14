import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectFramework,
  allocateFreePort,
  releaseAppPort,
  appPortRegistry,
} from '../server/runtimeGateway';
import { AppPreview } from '../components/AppPreview';
import { ConfigModal } from '../components/ConfigModal';
import type { ConnectedApp } from '../types';
import { runCliCommand } from '../lib/launchService';

describe('Intelligent Multi-Repository Runtime Support', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-multi-repo-'));
    appPortRegistry.clear();
  });

  afterEach(() => {
    appPortRegistry.clear();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Intelligent Detection for Diverse Repository Types', () => {
    it('detects Go backend service with Gin/Echo/Fiber and assigns port 8080', () => {
      fs.writeFileSync(
        path.join(tempDir, 'go.mod'),
        `module github.com/example/api\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.1\n`
      );
      fs.writeFileSync(path.join(tempDir, 'main.go'), 'package main\n\nfunc main() {}');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('go');
      expect(res.defaultPort).toBe(8080);
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toBe('go run main.go');
      expect(res.installCommand).toBe('go mod download');
      expect(res.details).toContain('HTTP Service');
    });

    it('detects Go CLI tool when Cobra or cmd directory is present', () => {
      fs.writeFileSync(
        path.join(tempDir, 'go.mod'),
        `module github.com/example/cli-tool\n\ngo 1.21\n\nrequire github.com/spf13/cobra v1.8.0\n`
      );
      fs.mkdirSync(path.join(tempDir, 'cmd'));
      fs.writeFileSync(path.join(tempDir, 'cmd', 'root.go'), 'package cmd');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('cli');
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toBe('go run ./cmd/...');
      expect(res.details).toContain('Command-Line Tool (CLI)');
    });

    it('detects Go library when no main package or server frameworks exist', () => {
      fs.writeFileSync(
        path.join(tempDir, 'go.mod'),
        `module github.com/example/mathlib\n\ngo 1.21\n`
      );
      fs.writeFileSync(path.join(tempDir, 'math.go'), 'package mathlib\n\nfunc Add(a, b int) int { return a + b }');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('library');
      expect(res.hasWebInterface).toBe(false);
      expect(res.testCommand).toBe('go test ./...');
      expect(res.details).toContain('Go Module / Library');
    });

    it('detects Rust backend service with Actix/Axum and assigns port 8080', () => {
      fs.writeFileSync(
        path.join(tempDir, 'Cargo.toml'),
        `[package]\nname = "rust-service"\nversion = "0.1.0"\n\n[dependencies]\naxum = "0.7"\ntokio = { version = "1.0", features = ["full"] }\n`
      );
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'main.rs'), 'fn main() {}');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('rust');
      expect(res.defaultPort).toBe(8080);
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toBe('cargo run');
      expect(res.installCommand).toBe('cargo build');
      expect(res.details).toContain('Rust Web Service');
    });

    it('detects Rust CLI tool when Clap is used or bin directory exists', () => {
      fs.writeFileSync(
        path.join(tempDir, 'Cargo.toml'),
        `[package]\nname = "rust-cli"\nversion = "0.1.0"\n\n[dependencies]\nclap = "4.4"\n`
      );

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('cli');
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toBe('cargo run --');
      expect(res.details).toContain('Rust Command-Line Tool (CLI)');
    });

    it('detects Java Spring Boot backend service with pom.xml and assigns port 8080', () => {
      fs.writeFileSync(
        path.join(tempDir, 'pom.xml'),
        `<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>`
      );

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('java');
      expect(res.defaultPort).toBe(8080);
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toBe('mvn spring-boot:run');
      expect(res.details).toContain('Java Spring Boot');
    });

    it('detects Python background worker with Celery or worker script', () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.txt'),
        'celery==5.3.6\nredis==5.0.1\n'
      );
      fs.writeFileSync(path.join(tempDir, 'worker.py'), 'import celery');

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('worker');
      expect(res.hasWebInterface).toBe(false);
      expect(res.startCommand).toContain('worker');
      expect(res.details).toContain('Python Background Worker');
    });

    it('detects Full-Stack Monorepo with frontend and backend subdirectories', () => {
      fs.mkdirSync(path.join(tempDir, 'client'));
      fs.writeFileSync(path.join(tempDir, 'client', 'index.html'), '<html><body>Monorepo Client</body></html>');
      fs.mkdirSync(path.join(tempDir, 'server'));
      fs.writeFileSync(
        path.join(tempDir, 'server', 'package.json'),
        JSON.stringify({ dependencies: { express: '4.18.2' } })
      );

      const res = detectFramework(tempDir);
      expect(res.isMonorepo).toBe(true);
      expect(res.projectRoot).toBe('client');
      expect(res.runtimeType).toBe('static');
      expect(res.hasWebInterface).toBe(true);
      expect(res.detectedServices).toContain('server');
    });

    it('detects Docker Compose containerized stack', () => {
      fs.writeFileSync(
        path.join(tempDir, 'compose.yaml'),
        `services:\n  web:\n    image: nginx\n    ports:\n      - "80:80"\n`
      );

      const res = detectFramework(tempDir);
      expect(res.runtimeType).toBe('docker');
      expect(res.startCommand).toBe('docker compose up');
      expect(res.details).toContain('Docker Compose');
    });
  });

  describe('Execution Isolation and Concurrent Port Allocation', () => {
    it('allocates distinct isolated ports for multiple concurrent running apps', async () => {
      const port1 = await allocateFreePort('app-1', 4000);
      const port2 = await allocateFreePort('app-2', 4000);
      const port3 = await allocateFreePort('app-3', 4000);

      expect(port1).not.toBe(port2);
      expect(port2).not.toBe(port3);
      expect(port1).not.toBe(port3);

      expect(appPortRegistry.get('app-1')).toBe(port1);
      expect(appPortRegistry.get('app-2')).toBe(port2);
      expect(appPortRegistry.get('app-3')).toBe(port3);

      releaseAppPort('app-1');
      expect(appPortRegistry.has('app-1')).toBe(false);
      expect(appPortRegistry.get('app-2')).toBe(port2);
    });
  });

  describe('Non-Frontend Execution Interfaces in AppPreview', () => {
    it('renders Backend API Explorer with method selector, path, and cURL snippet', () => {
      const backendApp: ConnectedApp = {
        id: 'test-backend-1',
        userId: 'test-user',
        repoOwner: 'octocat',
        repoName: 'order-api',
        repoFullName: 'octocat/order-api',
        repoUrl: 'https://github.com/octocat/order-api',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'node',
        hasWebInterface: false,
        status: 'running',
        port: 4001,
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={backendApp} />);

      // Must not render an iframe preview
      expect(document.querySelector('iframe')).toBeNull();

      // Explains non-browser interface
      expect(screen.getByText('Graphical Browser Interface Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/backend API or service/i)).toBeInTheDocument();

      // Renders API Explorer
      expect(screen.getByText(/API Explorer & Endpoint Tester/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument();
      expect(screen.getByText(/Copy cURL/i)).toBeInTheDocument();
    });

    it('renders CLI Execution Console with quick flags and argument input', () => {
      const cliApp: ConnectedApp = {
        id: 'test-cli-1',
        userId: 'test-user',
        repoOwner: 'developer',
        repoName: 'data-tool',
        repoFullName: 'developer/data-tool',
        repoUrl: 'https://github.com/developer/data-tool',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'cli',
        hasWebInterface: false,
        status: 'stopped',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={cliApp} />);

      expect(document.querySelector('iframe')).toBeNull();
      expect(screen.getByText(/CLI Execution Console/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Run/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '--help' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '--version' })).toBeInTheDocument();
    });

    it('renders Package Library workspace with package install snippet and test runner', () => {
      const libApp: ConnectedApp = {
        id: 'test-lib-1',
        userId: 'test-user',
        repoOwner: 'acme',
        repoName: 'utils-pkg',
        repoFullName: 'acme/utils-pkg',
        repoUrl: 'https://github.com/acme/utils-pkg',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'library',
        hasWebInterface: false,
        status: 'stopped',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={libApp} />);

      expect(document.querySelector('iframe')).toBeNull();
      expect(screen.getByText(/Package & Library Integration/i)).toBeInTheDocument();
      expect(screen.getByText('npm install utils-pkg')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Run Package Test Suite/i })).toBeInTheDocument();
    });

    it('renders Background Worker broker status card with guidance', () => {
      const workerApp: ConnectedApp = {
        id: 'test-worker-1',
        userId: 'test-user',
        repoOwner: 'acme',
        repoName: 'queue-processor',
        repoFullName: 'acme/queue-processor',
        repoUrl: 'https://github.com/acme/queue-processor',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'worker',
        hasWebInterface: false,
        status: 'stopped',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<AppPreview app={workerApp} />);

      expect(document.querySelector('iframe')).toBeNull();
      expect(screen.getByText(/Background Worker & Broker Status/i)).toBeInTheDocument();
      expect(screen.getByText(/No broker connection string detected/i)).toBeInTheDocument();
    });
  });

  describe('Configuration Modal Extension', () => {
    it('allows configuring Monorepo Project Root and Dependency Install Command', () => {
      const app: ConnectedApp = {
        id: 'cfg-app-1',
        userId: 'test-user',
        repoOwner: 'org',
        repoName: 'monorepo-app',
        repoFullName: 'org/monorepo-app',
        repoUrl: 'https://github.com/org/monorepo-app',
        defaultBranch: 'main',
        cloneStatus: 'cloned',
        runtimeType: 'react',
        hasWebInterface: true,
        status: 'stopped',
        projectRoot: 'packages/web',
        installCommand: 'pnpm install',
        lastOpened: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      render(<ConfigModal app={app} isOpen={true} onClose={() => {}} />);

      expect(screen.getByLabelText(/Project Root \/ Subdirectory/i)).toHaveValue('packages/web');
      expect(screen.getByLabelText(/Dependency Install Command/i)).toHaveValue('pnpm install');
    });
  });

  describe('CLI Command Execution Client Helper', () => {
    it('sends POST to /api/apps/cli/run and handles server response cleanly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stdout: 'Repomova CLI test output v1.0.0',
          stderr: '',
          exitCode: 0,
          durationMs: 42,
        }),
      } as Response);

      const result = await runCliCommand('app-cli-123', 'test-tool', 'bin/cli.js', '--version');
      expect(fetchSpy).toHaveBeenCalledWith('/api/apps/cli/run', expect.objectContaining({
        method: 'POST',
      }));
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('v1.0.0');

      fetchSpy.mockRestore();
    });
  });
});
