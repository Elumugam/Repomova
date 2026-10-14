import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { exec, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import type { Plugin, ViteDevServer } from 'vite';
import type { RuntimeType, AppStatus, DetectedEnvVar } from '../types.ts';
import { fetchRepositoryHtml } from '../lib/staticPreview.ts';
import {
  signUpUser,
  signInUser,
  getSessionUser,
  signOutUser,
  updateUserProfile,
} from './authService.ts';

const execAsync = promisify(exec);

// Running processes and servers
export interface RunningAppInstance {
  appId: string;
  port: number;
  server?: http.Server;
  process?: ChildProcess;
  runtimeType: RuntimeType;
  startedAt: string;
  servedDir?: string;
}

export interface FrameworkDetectionResult {
  runtimeType: RuntimeType;
  details: string;
  serveDir?: string;
  entryFile?: string;
  hasBuildScript?: boolean;
  needsBuild?: boolean;
  noWebEntry?: boolean;
  hasWebInterface?: boolean;
  projectTypeCategory?: 'frontend' | 'backend' | 'cli' | 'library' | 'worker' | 'unknown';
  missingConfigReason?: string;
  entryPoint?: string;
  defaultPort?: number;
  startCommand?: string;
  buildCommand?: string;
  installCommand?: string;
  testCommand?: string;
  projectRoot?: string;
  packageManager?: string;
  isMonorepo?: boolean;
  detectedServices?: string[];
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
    installCommand?: string;
  };
  detectedEnvVars?: DetectedEnvVar[];
}

export interface HealthCheckResult {
  healthy: boolean;
  status?: number;
  contentType?: string;
  reason?: string;
}

// Global Registries
export const appPortRegistry = new Map<string, number>(); // appId -> port
export const runningInstances = new Map<string, RunningAppInstance>(); // appId -> RunningAppInstance

// Check if a specific TCP port is in use on 127.0.0.1
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(true);
      }
    });
    tester.once('listening', () => {
      tester.close(() => {
        resolve(false);
      });
    });
    tester.listen(port, '127.0.0.1');
  });
}

// Dynamically allocate a free port for an app
export async function allocateFreePort(appId: string, preferredPort?: number): Promise<number> {
  // If app already has a running instance, reuse its port
  const existingInstance = runningInstances.get(appId);
  if (existingInstance && existingInstance.port) {
    return existingInstance.port;
  }

  // If a valid preferred port was provided, check if it's free
  if (preferredPort && preferredPort >= 1024 && preferredPort <= 65535) {
    let inRegistryByOther = false;
    for (const [id, p] of appPortRegistry.entries()) {
      if (id !== appId && p === preferredPort) {
        inRegistryByOther = true;
        break;
      }
    }
    for (const [id, inst] of runningInstances.entries()) {
      if (id !== appId && inst.port === preferredPort) {
        inRegistryByOther = true;
        break;
      }
    }

    if (!inRegistryByOther && !(await isPortInUse(preferredPort))) {
      appPortRegistry.set(appId, preferredPort);
      return preferredPort;
    }
  }

  // Gather all reserved ports across all apps
  const reservedPorts = new Set<number>();
  for (const [id, p] of appPortRegistry.entries()) {
    if (id !== appId) reservedPorts.add(p);
  }
  for (const [id, inst] of runningInstances.entries()) {
    if (id !== appId && inst.port) reservedPorts.add(inst.port);
  }

  // Scan ephemeral range 4101..4999
  for (let port = 4101; port <= 4999; port++) {
    if (!reservedPorts.has(port)) {
      const inUse = await isPortInUse(port);
      if (!inUse) {
        appPortRegistry.set(appId, port);
        return port;
      }
    }
  }

  // Fallback: bind to port 0 on 127.0.0.1
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      const assigned = addr.port;
      server.close(() => {
        appPortRegistry.set(appId, assigned);
        resolve(assigned);
      });
    });
    server.on('error', reject);
  });
}

// Release port from registry
export function releaseAppPort(appId: string): void {
  appPortRegistry.delete(appId);
}

// Search for index.html at root, dist, build, public, docs, out, etc.
export function findEntryPoint(dir: string): { entryFile: string; serveDir: string; relativeDir: string } | null {
  if (!fs.existsSync(dir)) return null;

  const candidates = [
    '',
    'dist',
    'build',
    'public',
    'docs',
    'out',
    'www',
    'site',
    'client',
    'frontend',
  ];

  for (const sub of candidates) {
    const candidateDir = sub ? path.join(dir, sub) : dir;
    const indexPath = path.join(candidateDir, 'index.html');
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return {
        entryFile: 'index.html',
        serveDir: candidateDir,
        relativeDir: sub || '.',
      };
    }
  }

  return null;
}

// Parse .env.example / .env.sample without inventing fake credentials
export function parseEnvExample(dir: string): DetectedEnvVar[] {
  const candidates = ['.env.example', '.env.sample', 'sample.env', '.env.template'];
  for (const candidate of candidates) {
    const file = path.join(dir, candidate);
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        const vars: DetectedEnvVar[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          const key = eqIdx > 0 ? trimmed.slice(0, eqIdx).trim() : trimmed;
          if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

          const isSecret = /(KEY|SECRET|PASSWORD|TOKEN|AUTH|PRIVATE|CREDENTIAL)/i.test(key);
          const rawVal = eqIdx > 0 ? trimmed.slice(eqIdx + 1).trim() : '';
          const required = !rawVal && !trimmed.toLowerCase().includes('optional');

          vars.push({
            key,
            required,
            isSecret,
            description: `Specified in ${candidate}`,
          });
        }
        if (vars.length > 0) return vars;
      } catch {
        // ignore
      }
    }
  }
  return [];
}

// Inspect and detect framework & entry points in cloned directory (with monorepo support)
export function detectFramework(dir: string, depth = 0): FrameworkDetectionResult {
  if (!fs.existsSync(dir)) {
    return { runtimeType: 'unknown', details: 'Directory does not exist', hasWebInterface: false };
  }

  const detectedEnvVars = parseEnvExample(dir);
  const pkgJsonPath = path.join(dir, 'package.json');
  const entry = findEntryPoint(dir);

  // Check if Python repo indicators exist
  const hasPyFiles =
    fs.existsSync(path.join(dir, 'requirements.txt')) ||
    fs.existsSync(path.join(dir, 'pyproject.toml')) ||
    fs.existsSync(path.join(dir, 'Pipfile')) ||
    fs.existsSync(path.join(dir, 'app.py')) ||
    fs.existsSync(path.join(dir, 'main.py')) ||
    fs.existsSync(path.join(dir, 'setup.py'));

  // Check if Go repo indicators exist
  const goModPath = path.join(dir, 'go.mod');
  const mainGoPath = path.join(dir, 'main.go');
  const cmdGoPath = path.join(dir, 'cmd');
  const hasGoFiles = fs.existsSync(goModPath) || fs.existsSync(mainGoPath);

  // Check if Rust repo indicators exist
  const cargoPath = path.join(dir, 'Cargo.toml');
  const hasRustFiles = fs.existsSync(cargoPath);

  // Check if Java / JVM indicators exist
  const pomPath = path.join(dir, 'pom.xml');
  const gradlePath = path.join(dir, 'build.gradle');
  const gradleKtsPath = path.join(dir, 'build.gradle.kts');
  const hasJavaFiles = fs.existsSync(pomPath) || fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath);

  // Check if Docker indicators exist
  const hasDockerFiles =
    fs.existsSync(path.join(dir, 'Dockerfile')) ||
    fs.existsSync(path.join(dir, 'docker-compose.yml')) ||
    fs.existsSync(path.join(dir, 'docker-compose.yaml')) ||
    fs.existsSync(path.join(dir, 'compose.yaml')) ||
    fs.existsSync(path.join(dir, 'compose.yml'));

  // Check if monorepo / nested project check is needed
  if (depth === 0 && !fs.existsSync(pkgJsonPath) && !hasPyFiles && !hasGoFiles && !hasRustFiles && !hasJavaFiles && !hasDockerFiles && (!entry || entry.relativeDir !== '.')) {
    const candidateSubdirs = [
      'frontend',
      'client',
      'web',
      'ui',
      'apps/web',
      'apps/frontend',
      'packages/web',
      'backend',
      'server',
      'api',
      'services',
    ];

    let foundFrontendSub: string | undefined;
    let foundBackendSub: string | undefined;

    for (const sub of candidateSubdirs) {
      const fullSub = path.join(dir, sub);
      if (fs.existsSync(fullSub) && fs.statSync(fullSub).isDirectory()) {
        if (['frontend', 'client', 'web', 'ui', 'apps/web', 'apps/frontend', 'packages/web'].includes(sub)) {
          if (!foundFrontendSub) foundFrontendSub = sub;
        } else {
          if (!foundBackendSub) foundBackendSub = sub;
        }
      }
    }

    // Full-stack monorepo with both frontend and backend subdirectories
    if (foundFrontendSub && foundBackendSub) {
      const feRes = detectFramework(path.join(dir, foundFrontendSub), depth + 1);
      return {
        ...feRes,
        isMonorepo: true,
        projectRoot: foundFrontendSub,
        detectedServices: [foundFrontendSub, foundBackendSub],
        details: `Full-stack monorepo (${foundFrontendSub} frontend & ${foundBackendSub} backend service)`,
      };
    }

    // Single nested project
    const singleSub = foundFrontendSub || foundBackendSub;
    if (singleSub) {
      const nestedRes = detectFramework(path.join(dir, singleSub), depth + 1);
      if (nestedRes.runtimeType !== 'unknown') {
        return {
          ...nestedRes,
          isMonorepo: true,
          projectRoot: singleSub,
          details: `${nestedRes.details} (nested in ./${singleSub})`,
        };
      }
    }
  }

  // 1. Check package.json projects
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const scripts = (pkg.scripts || {}) as Record<string, string>;

      const hasDev = Boolean(scripts.dev);
      const hasStart = Boolean(scripts.start);
      const hasBuild = Boolean(scripts.build);
      const hasTest = Boolean(scripts.test);

      let runtimeType: RuntimeType = 'node';
      let details = 'Node.js application';
      let hasWebInterface = true;
      let projectTypeCategory: 'frontend' | 'backend' | 'cli' | 'library' | 'worker' | 'unknown' = 'frontend';
      let missingConfigReason: string | undefined;
      let entryPoint: string | undefined = pkg.main;

      const isWorker =
        Boolean(allDeps['bullmq'] || allDeps['bee-queue'] || allDeps['agenda'] || allDeps['amqplib'] || allDeps['kafkajs']) ||
        Boolean(scripts['worker']);

      if (allDeps['next']) {
        runtimeType = 'nextjs';
        details = 'Next.js application';
        hasWebInterface = true;
        projectTypeCategory = 'frontend';
      } else if (allDeps['vite']) {
        runtimeType = 'vite';
        details = 'Vite application';
        hasWebInterface = true;
        projectTypeCategory = 'frontend';
      } else if (allDeps['vue'] || allDeps['@vue/runtime-core'] || allDeps['@vue/cli-service'] || allDeps['nuxt']) {
        runtimeType = 'vue';
        details = 'Vue application';
        hasWebInterface = true;
        projectTypeCategory = 'frontend';
      } else if (allDeps['@angular/core']) {
        runtimeType = 'angular';
        details = 'Angular application';
        hasWebInterface = true;
        projectTypeCategory = 'frontend';
      } else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) {
        runtimeType = 'svelte';
        details = 'Svelte application';
        hasWebInterface = true;
        projectTypeCategory = 'frontend';
      } else if (allDeps['react'] || allDeps['react-scripts']) {
        runtimeType = 'react';
        details = 'React application';
        hasWebInterface = true;
        projectTypeCategory = 'frontend';
      } else if (isWorker) {
        runtimeType = 'worker';
        details = 'Node.js Background Worker / Queue Processor';
        hasWebInterface = false;
        projectTypeCategory = 'worker';
      } else if (allDeps['express'] || allDeps['fastify'] || allDeps['koa'] || allDeps['@nestjs/core'] || allDeps['hapi']) {
        runtimeType = 'backend';
        details = 'Node.js Backend API / Service';
        hasWebInterface = false;
        projectTypeCategory = 'backend';
      } else if (pkg.bin || allDeps['commander'] || allDeps['yargs'] || allDeps['meow'] || allDeps['cac'] || allDeps['clack']) {
        runtimeType = 'cli';
        details = 'Node.js Command-Line Interface (CLI) Tool';
        hasWebInterface = false;
        projectTypeCategory = 'cli';
        entryPoint = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin ? Object.values(pkg.bin)[0] as string : pkg.main;
      } else if ((pkg.main || pkg.types || pkg.exports) && !hasDev && !hasStart && !entry) {
        runtimeType = 'library';
        details = 'JavaScript / TypeScript Library';
        hasWebInterface = false;
        projectTypeCategory = 'library';
      } else if (!hasDev && !hasStart && !pkg.main && !entry) {
        missingConfigReason = 'package.json is missing required start/dev scripts and main entry point.';
        runtimeType = 'node';
        details = 'Node.js project with missing configuration';
        hasWebInterface = false;
        projectTypeCategory = 'unknown';
      } else if (!entry) {
        // Node service without frontend HTML
        runtimeType = 'backend';
        details = 'Node.js Service (no web frontend)';
        hasWebInterface = false;
        projectTypeCategory = 'backend';
      }

      const startCommand = hasDev ? 'npm run dev' : hasStart ? 'npm start' : 'node index.js';
      const startSource = hasDev
        ? "Detected from package.json 'scripts.dev'"
        : hasStart
        ? "Detected from package.json 'scripts.start'"
        : 'Default Node.js entry point';

      const buildCommand = hasBuild ? 'npm run build' : undefined;
      const buildSource = hasBuild ? "Detected from package.json 'scripts.build'" : undefined;
      const testCommand = hasTest ? 'npm test' : undefined;

      const serveDir = entry ? entry.serveDir : dir;
      const needsBuild = hasBuild && !entry;

      return {
        runtimeType,
        details,
        hasWebInterface,
        projectTypeCategory,
        missingConfigReason,
        entryPoint,
        serveDir,
        entryFile: entry ? entry.entryFile : undefined,
        hasBuildScript: hasBuild,
        needsBuild,
        startCommand,
        buildCommand,
        testCommand,
        installCommand: 'npm install',
        packageManager: 'npm',
        commandSources: {
          startCommand: startSource,
          buildCommand: buildSource,
          installCommand: 'Standard Node.js package manager',
        },
        detectedEnvVars,
      };
    } catch {
      return {
        runtimeType: 'node',
        details: 'Node.js application',
        detectedEnvVars,
        serveDir: dir,
        hasWebInterface: false,
        projectTypeCategory: 'backend',
        installCommand: 'npm install',
      };
    }
  }

  // 2. Python detection (takes priority over stray docs/index.html in Python repos)
  if (hasPyFiles) {
    let reqContent = '';
    const reqPath = path.join(dir, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try { reqContent = fs.readFileSync(reqPath, 'utf8').toLowerCase(); } catch { /* ignore */ }
    }
    const pyprojPath = path.join(dir, 'pyproject.toml');
    if (fs.existsSync(pyprojPath)) {
      try { reqContent += fs.readFileSync(pyprojPath, 'utf8').toLowerCase(); } catch { /* ignore */ }
    }

    const hasTemplates =
      fs.existsSync(path.join(dir, 'templates', 'index.html')) ||
      fs.existsSync(path.join(dir, 'static', 'index.html'));

    const isDashOrStreamlit =
      reqContent.includes('dash') ||
      reqContent.includes('streamlit') ||
      reqContent.includes('gradio') ||
      reqContent.includes('plotly');

    const isWorker =
      reqContent.includes('celery') ||
      reqContent.includes('rq') ||
      reqContent.includes('dramatiq') ||
      fs.existsSync(path.join(dir, 'tasks.py')) ||
      fs.existsSync(path.join(dir, 'worker.py'));

    const isAiMl =
      reqContent.includes('torch') ||
      reqContent.includes('tensorflow') ||
      reqContent.includes('scikit-learn') ||
      reqContent.includes('transformers') ||
      reqContent.includes('langchain') ||
      reqContent.includes('pandas');

    const isBackendApi =
      reqContent.includes('fastapi') ||
      reqContent.includes('flask') ||
      reqContent.includes('django') ||
      reqContent.includes('tornado') ||
      reqContent.includes('uvicorn');

    const isCli =
      reqContent.includes('click') ||
      reqContent.includes('typer') ||
      fs.existsSync(path.join(dir, 'cli.py'));

    const isLibrary =
      (fs.existsSync(path.join(dir, 'setup.py')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) &&
      !isDashOrStreamlit &&
      !isBackendApi &&
      !isCli &&
      !isWorker;

    const entryPy = fs.existsSync(path.join(dir, 'main.py')) ? 'python main.py' : 'python app.py';

    let runtimeType: RuntimeType = 'python';
    let details = 'Python application';
    let hasWebInterface = false;
    let projectTypeCategory: 'frontend' | 'backend' | 'cli' | 'library' | 'worker' = 'backend';
    let startCmd = entryPy;

    if (isDashOrStreamlit || hasTemplates) {
      runtimeType = 'python';
      details = isDashOrStreamlit ? 'Plotly Dash / Streamlit Web Application' : 'Python Web Application';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    } else if (isWorker) {
      runtimeType = 'worker';
      details = 'Python Background Worker / Celery Queue Consumer';
      hasWebInterface = false;
      projectTypeCategory = 'worker';
      startCmd = fs.existsSync(path.join(dir, 'worker.py')) ? 'python worker.py' : 'celery -A tasks worker --loglevel=info';
    } else if (isCli) {
      runtimeType = 'cli';
      details = 'Python Command-Line Tool (CLI)';
      hasWebInterface = false;
      projectTypeCategory = 'cli';
      startCmd = fs.existsSync(path.join(dir, 'cli.py')) ? 'python cli.py' : entryPy;
    } else if (isLibrary) {
      runtimeType = 'library';
      details = 'Python Library / Package';
      hasWebInterface = false;
      projectTypeCategory = 'library';
    } else if (isAiMl) {
      runtimeType = 'python';
      details = 'Python AI/ML & Data Processing Project';
      hasWebInterface = false;
      projectTypeCategory = 'backend';
    } else if (isBackendApi) {
      runtimeType = 'python';
      details = 'Python REST API / Backend Service';
      hasWebInterface = false;
      projectTypeCategory = 'backend';
    }

    return {
      runtimeType,
      details,
      hasWebInterface,
      projectTypeCategory,
      entryPoint: fs.existsSync(path.join(dir, 'main.py')) ? 'main.py' : fs.existsSync(path.join(dir, 'app.py')) ? 'app.py' : undefined,
      serveDir: dir,
      startCommand: startCmd,
      buildCommand: fs.existsSync(reqPath) ? 'pip install -r requirements.txt' : undefined,
      installCommand: fs.existsSync(reqPath) ? 'pip install -r requirements.txt' : 'pip install .',
      testCommand: 'pytest',
      packageManager: 'pip',
      commandSources: {
        startCommand: 'Detected from Python repository structure',
        installCommand: 'Standard Python pip package manager',
      },
      detectedEnvVars,
    };
  }

  // 3. Go language detection (go.mod / main.go)
  if (hasGoFiles) {
    let goContent = '';
    if (fs.existsSync(goModPath)) {
      try { goContent = fs.readFileSync(goModPath, 'utf8').toLowerCase(); } catch { /* ignore */ }
    }

    const hasMain = fs.existsSync(mainGoPath) || fs.existsSync(cmdGoPath);
    const isGoWeb =
      goContent.includes('gin-gonic/gin') ||
      goContent.includes('labstack/echo') ||
      goContent.includes('gofiber/fiber') ||
      goContent.includes('gorilla/mux') ||
      goContent.includes('chi') ||
      goContent.includes('net/http');

    const isGoCli =
      goContent.includes('spf13/cobra') ||
      goContent.includes('urfave/cli') ||
      fs.existsSync(cmdGoPath);

    let runtimeType: RuntimeType = 'go';
    let details = 'Go application';
    let projectTypeCategory: 'backend' | 'cli' | 'library' = 'backend';
    let startCmd = 'go run .';
    let buildCmd: string | undefined = 'go build -v .';

    if (isGoWeb || (hasMain && !isGoCli)) {
      details = 'Go Backend API / HTTP Service';
      projectTypeCategory = 'backend';
      runtimeType = 'go';
      startCmd = fs.existsSync(mainGoPath) ? 'go run main.go' : 'go run .';
      buildCmd = 'go build -v .';
    } else if (isGoCli) {
      details = 'Go Command-Line Tool (CLI)';
      projectTypeCategory = 'cli';
      runtimeType = 'cli';
      startCmd = fs.existsSync(cmdGoPath) ? 'go run ./cmd/...' : 'go run .';
      buildCmd = 'go build .';
    } else {
      details = 'Go Module / Library';
      projectTypeCategory = 'library';
      runtimeType = 'library';
      startCmd = undefined as unknown as string;
      buildCmd = 'go test ./...';
    }

    return {
      runtimeType,
      details,
      hasWebInterface: false,
      projectTypeCategory,
      defaultPort: (isGoWeb || (hasMain && !isGoCli)) ? 8080 : undefined,
      entryPoint: fs.existsSync(mainGoPath) ? 'main.go' : fs.existsSync(cmdGoPath) ? 'cmd/main.go' : undefined,
      serveDir: dir,
      startCommand: startCmd,
      buildCommand: buildCmd,
      installCommand: 'go mod download',
      testCommand: 'go test ./...',
      packageManager: 'go',
      commandSources: {
        startCommand: 'Detected from Go module definition',
        installCommand: 'Go modules package manager',
      },
      detectedEnvVars,
    };
  }

  // 4. Rust detection (Cargo.toml)
  if (hasRustFiles) {
    let cargoContent = '';
    try { cargoContent = fs.readFileSync(cargoPath, 'utf8').toLowerCase(); } catch { /* ignore */ }

    const isRustWasm =
      cargoContent.includes('yew') ||
      cargoContent.includes('leptos') ||
      cargoContent.includes('trunk') ||
      fs.existsSync(path.join(dir, 'Trunk.toml'));

    const isRustWeb =
      cargoContent.includes('actix-web') ||
      cargoContent.includes('axum') ||
      cargoContent.includes('rocket') ||
      cargoContent.includes('warp') ||
      cargoContent.includes('poem');

    const isRustCli =
      cargoContent.includes('clap') ||
      cargoContent.includes('structopt') ||
      cargoContent.includes('[[bin]]') ||
      fs.existsSync(path.join(dir, 'src', 'main.rs'));

    const isRustLib =
      cargoContent.includes('[lib]') ||
      (fs.existsSync(path.join(dir, 'src', 'lib.rs')) && !fs.existsSync(path.join(dir, 'src', 'main.rs')));

    if (isRustWasm) {
      return {
        runtimeType: 'rust',
        details: 'Rust WebAssembly Application (Trunk/WASM)',
        hasWebInterface: true,
        projectTypeCategory: 'frontend',
        serveDir: dir,
        startCommand: 'trunk serve',
        buildCommand: 'trunk build --release',
        testCommand: 'cargo test',
        installCommand: 'cargo build',
        packageManager: 'cargo',
        detectedEnvVars,
      };
    }

    if (isRustWeb) {
      return {
        runtimeType: 'rust',
        details: 'Rust Web Service / REST API',
        hasWebInterface: false,
        projectTypeCategory: 'backend',
        defaultPort: 8080,
        serveDir: dir,
        startCommand: 'cargo run',
        buildCommand: 'cargo build --release',
        testCommand: 'cargo test',
        installCommand: 'cargo build',
        packageManager: 'cargo',
        detectedEnvVars,
      };
    }

    if (isRustCli && !isRustLib) {
      return {
        runtimeType: 'cli',
        details: 'Rust Command-Line Tool (CLI)',
        hasWebInterface: false,
        projectTypeCategory: 'cli',
        entryPoint: 'src/main.rs',
        serveDir: dir,
        startCommand: 'cargo run --',
        buildCommand: 'cargo build',
        testCommand: 'cargo test',
        installCommand: 'cargo build',
        packageManager: 'cargo',
        detectedEnvVars,
      };
    }

    return {
      runtimeType: 'library',
      details: 'Rust Crate / Library',
      hasWebInterface: false,
      projectTypeCategory: 'library',
      entryPoint: 'src/lib.rs',
      serveDir: dir,
      buildCommand: 'cargo test',
      testCommand: 'cargo test',
      installCommand: 'cargo build',
      packageManager: 'cargo',
      detectedEnvVars,
    };
  }

  // 5. Java / JVM detection (pom.xml, build.gradle)
  if (hasJavaFiles) {
    let pomContent = '';
    if (fs.existsSync(pomPath)) {
      try { pomContent = fs.readFileSync(pomPath, 'utf8').toLowerCase(); } catch { /* ignore */ }
    }
    const hasMvnw = fs.existsSync(path.join(dir, 'mvnw')) || fs.existsSync(path.join(dir, 'mvnw.cmd'));
    const mvn = hasMvnw ? './mvnw' : 'mvn';

    const hasGradlew = fs.existsSync(path.join(dir, 'gradlew')) || fs.existsSync(path.join(dir, 'gradlew.bat'));
    const grad = hasGradlew ? './gradlew' : 'gradle';

    if (fs.existsSync(pomPath)) {
      const isSpring = pomContent.includes('spring-boot') || pomContent.includes('quarkus') || pomContent.includes('micronaut');
      return {
        runtimeType: isSpring ? 'java' : 'library',
        details: isSpring ? 'Java Spring Boot / Microservice Application' : 'Java Maven Library / Package',
        hasWebInterface: false,
        projectTypeCategory: isSpring ? 'backend' : 'library',
        defaultPort: isSpring ? 8080 : undefined,
        serveDir: dir,
        startCommand: isSpring ? `${mvn} spring-boot:run` : undefined,
        buildCommand: isSpring ? `${mvn} clean package` : `${mvn} test`,
        testCommand: `${mvn} test`,
        installCommand: `${mvn} dependency:resolve`,
        packageManager: 'maven',
        detectedEnvVars,
      };
    }

    return {
      runtimeType: 'java',
      details: 'Java / Gradle Application',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      defaultPort: 8080,
      serveDir: dir,
      startCommand: `${grad} bootRun`,
      buildCommand: `${grad} build`,
      testCommand: `${grad} test`,
      installCommand: `${grad} build --dry-run`,
      packageManager: 'gradle',
      detectedEnvVars,
    };
  }

  // 6. Static site detection: true web entry point found (root, dist, build, public, www, site)
  if (entry) {
    const locDesc = entry.relativeDir === '.' ? 'root' : `${entry.relativeDir}/`;
    return {
      runtimeType: 'static',
      details: `Static HTML5 website (entry file: ${locDesc}index.html)`,
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      serveDir: entry.serveDir,
      entryFile: entry.entryFile,
      startCommand: 'Built-in Static Server',
      buildCommand: 'None (Static files)',
      commandSources: {
        startCommand: `Auto-configured: serving ${locDesc} via built-in static server`,
        buildCommand: 'Auto-configured: plain HTML site requires no build step',
      },
      detectedEnvVars,
    };
  }

  // 7. Docker detection (compose.yaml, docker-compose.yml, Dockerfile)
  if (hasDockerFiles) {
    const isCompose =
      fs.existsSync(path.join(dir, 'docker-compose.yml')) ||
      fs.existsSync(path.join(dir, 'docker-compose.yaml')) ||
      fs.existsSync(path.join(dir, 'compose.yaml')) ||
      fs.existsSync(path.join(dir, 'compose.yml'));

    return {
      runtimeType: 'docker',
      details: isCompose ? 'Docker Compose Multi-Service Application' : 'Docker containerized application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      serveDir: dir,
      startCommand: isCompose ? 'docker compose up' : 'docker build & run',
      buildCommand: isCompose ? 'docker compose build' : 'docker build .',
      commandSources: {
        startCommand: `Detected from ${isCompose ? 'Compose configuration' : 'Dockerfile'}`,
      },
      detectedEnvVars,
    };
  }

  // 8. Native desktop / compiled application without web entry point
  if (
    fs.existsSync(path.join(dir, 'makefile')) ||
    fs.existsSync(path.join(dir, 'Makefile')) ||
    fs.existsSync(path.join(dir, 'CMakeLists.txt')) ||
    fs.existsSync(path.join(dir, 'main.c')) ||
    fs.existsSync(path.join(dir, 'main.cpp'))
  ) {
    return {
      runtimeType: 'unknown',
      details: 'Native desktop application (C/C++ makefile project, no web entry point)',
      serveDir: dir,
      noWebEntry: true,
      hasWebInterface: false,
      projectTypeCategory: 'cli',
      detectedEnvVars,
    };
  }

  return {
    runtimeType: 'unknown',
    details: 'No web entry file found (index.html missing in root, dist, build, public, docs)',
    serveDir: dir,
    noWebEntry: true,
    hasWebInterface: false,
    projectTypeCategory: 'unknown',
    missingConfigReason: 'No runnable web entry point found.',
    detectedEnvVars,
  };
}

// Compute lockfile hash for caching
export function computeLockfileHash(dir: string): string | null {
  const candidates = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'requirements.txt'];
  for (const candidate of candidates) {
    const file = path.join(dir, candidate);
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file);
      return crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  return null;
}

// Real HTTP health check on port: requires HTTP 200 with HTML content!
export async function performHttpHealthCheck(
  url: string,
  maxRetries = 15,
  intervalMs = 200
): Promise<HealthCheckResult> {
  let lastStatus: number | undefined;
  let lastReason: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Repomova-HealthCheck/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      lastStatus = res.status;
      const contentType = res.headers.get('content-type') || '';

      if (res.status === 200) {
        const text = await res.text();
        const isHtml =
          contentType.includes('text/html') ||
          text.toLowerCase().includes('<!doctype html') ||
          text.toLowerCase().includes('<html');

        if (isHtml) {
          return { healthy: true, status: 200, contentType };
        } else {
          lastReason = `HTTP 200 returned non-HTML (${contentType || 'plain text'})`;
        }
      } else if (res.status === 404) {
        lastReason = `HTTP 404 Not Found (entry file missing in served directory)`;
      } else if (res.status >= 500) {
        lastReason = `HTTP ${res.status} Server Error`;
      } else {
        lastReason = `HTTP ${res.status} response`;
      }
    } catch (err: unknown) {
      lastReason = err instanceof Error ? err.message : 'Connection refused';
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { healthy: false, status: lastStatus, reason: lastReason || 'Health check failed' };
}

// MIME types for static server
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

// Start static file server for static sites
export function startStaticServer(dir: string, port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Relax framing headers so iframe can embed
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      let reqPath = decodeURIComponent(req.url?.split('?')[0] || '/');
      // Strip any gateway prefix if request passed through proxy (/preview/:appId/...)
      reqPath = reqPath.replace(/^\/(?:api\/)?preview\/[^/]+/, '');
      if (!reqPath || reqPath === '') {
        reqPath = '/';
      }

      if (reqPath.endsWith('/')) {
        reqPath += 'index.html';
      }

      let filePath = path.join(dir, reqPath);

      // Security check: ensure path is inside dir
      if (!filePath.startsWith(dir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        const fallback = path.join(dir, 'index.html');
        if (fs.existsSync(fallback)) {
          filePath = fallback;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Not Found: No file or index.html at ${reqPath} in ${dir}`);
          return;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end();
      });
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

// Stop a running app instance and release its port
export function stopAppInstance(appId: string): boolean {
  const instance = runningInstances.get(appId);
  if (!instance) {
    releaseAppPort(appId);
    return false;
  }

  // Terminate running child process if exists
  if (instance.process && instance.process.pid) {
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${instance.process.pid} /T /F`, () => {});
      } else {
        instance.process.kill('SIGTERM');
      }
    } catch {
      // ignore
    }
  }

  if (instance.server) {
    try {
      if (typeof (instance.server as unknown as { closeAllConnections?: () => void }).closeAllConnections === 'function') {
        (instance.server as unknown as { closeAllConnections: () => void }).closeAllConnections();
      }
      instance.server.close();
    } catch {
      // ignore
    }
  }
  runningInstances.delete(appId);
  releaseAppPort(appId);
  return true;
}

// Get running app instance info
export function getAppInstance(appId: string): RunningAppInstance | undefined {
  return runningInstances.get(appId);
}

/**
 * Vite Dev Server Plugin that integrates the Runtime & Preview Gateway
 */
export function runtimeGatewayPlugin(): Plugin {
  return {
    name: 'repomova-runtime-gateway',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Health check endpoint
        if (url.startsWith('/api/health')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', runningApps: runningInstances.size }));
          return;
        }

        // Helper: Read JSON request body
        const readJsonBody = async (): Promise<any> => {
          return new Promise((resolve) => {
            let data = '';
            req.on('data', (chunk) => { data += chunk; });
            req.on('end', () => {
              try {
                resolve(JSON.parse(data || '{}'));
              } catch {
                resolve({});
              }
            });
          });
        };

        // Helper: Extract Bearer token from headers or URL
        const extractBearerToken = (): string => {
          const authHeader = req.headers.authorization || '';
          if (authHeader.startsWith('Bearer ')) {
            return authHeader.slice(7).trim();
          }
          const parsed = new URL(url, 'http://127.0.0.1:5173');
          return parsed.searchParams.get('token') || '';
        };

        // ============================================
        // Repomova Dedicated Authentication Endpoints
        // ============================================

        // POST /api/auth/signup
        if (url.startsWith('/api/auth/signup') && req.method === 'POST') {
          try {
            const body = await readJsonBody();
            const result = await signUpUser(body);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            const status = err.statusCode || 400;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Registration failed' }));
          }
          return;
        }

        // POST /api/auth/signin
        if (url.startsWith('/api/auth/signin') && req.method === 'POST') {
          try {
            const body = await readJsonBody();
            const result = await signInUser(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            const status = err.statusCode || 401;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Invalid credentials' }));
          }
          return;
        }

        // GET /api/auth/session
        if (url.startsWith('/api/auth/session') && req.method === 'GET') {
          try {
            const token = extractBearerToken();
            const user = await getSessionUser(token);
            if (!user) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Session invalid or expired' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ user, session: { token, user } }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Failed to verify session' }));
          }
          return;
        }

        // POST /api/auth/signout
        if (url.startsWith('/api/auth/signout') && req.method === 'POST') {
          try {
            const token = extractBearerToken();
            await signOutUser(token);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Failed to sign out' }));
          }
          return;
        }

        // POST /api/auth/update-profile
        if (url.startsWith('/api/auth/update-profile') && req.method === 'POST') {
          try {
            const token = extractBearerToken();
            const body = await readJsonBody();
            const updatedUser = await updateUserProfile(token, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ user: updatedUser }));
          } catch (err: any) {
            const status = err.statusCode || 400;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Failed to update profile' }));
          }
          return;
        }

        // Preview gateway proxy: /preview/:appId/*
        if (url.startsWith('/preview/')) {
          const match = url.match(/^\/preview\/([^/?]+)(.*)/);
          if (match) {
            const targetAppId = match[1];
            const subPath = match[2] || '';

            // Redirect /preview/:appId to /preview/:appId/ so relative asset paths inside index.html resolve correctly
            if (!subPath || subPath === '') {
              res.writeHead(302, { Location: `/preview/${targetAppId}/` });
              res.end();
              return;
            }

            const instance = runningInstances.get(targetAppId);
            if (instance) {
              const proxyReq = http.request({
                host: '127.0.0.1',
                port: instance.port,
                path: subPath,
                method: req.method,
                headers: {
                  ...req.headers,
                  host: `127.0.0.1:${instance.port}`,
                },
              }, (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 200, {
                  ...proxyRes.headers,
                  'X-Frame-Options': 'ALLOWALL',
                  'Content-Security-Policy': "frame-ancestors 'self' *",
                });
                proxyRes.pipe(res);
              });
              proxyReq.on('error', () => {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('Bad Gateway: App server not reachable');
              });
              req.pipe(proxyReq);
              return;
            } else {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end(`App ${targetAppId} is not currently running`);
              return;
            }
          }
        }

        // Preview API endpoint: /api/apps/preview?repoUrl=...&appId=...
        if (url.startsWith('/api/apps/preview')) {
          const parsedUrl = new URL(url, 'http://127.0.0.1:5173');
          const previewAppId = parsedUrl.searchParams.get('appId') || '';
          const previewRepoUrl = parsedUrl.searchParams.get('repoUrl') || '';
          const previewRepoName = parsedUrl.searchParams.get('repoName') || '';

          // If app is currently running in local gateway, redirect to local preview proxy
          const inst = runningInstances.get(previewAppId);
          if (inst && inst.port) {
            res.writeHead(302, { Location: `/preview/${previewAppId}/` });
            res.end();
            return;
          }

          // Check if local clone exists
          const repoDir = path.resolve(process.cwd(), '.repomova', 'repos', previewAppId || previewRepoName);
          const localEntry = findEntryPoint(repoDir);
          if (localEntry) {
            const content = fs.readFileSync(path.join(localEntry.serveDir, localEntry.entryFile), 'utf8');
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Frame-Options': 'ALLOWALL',
              'Content-Security-Policy': "frame-ancestors 'self' *",
            });
            res.end(content);
            return;
          }

          // Remote static preview with CDN base href
          try {
            const remote = await fetchRepositoryHtml(previewRepoUrl, previewRepoName);
            if (remote) {
              res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Frame-Options': 'ALLOWALL',
                'Content-Security-Policy': "frame-ancestors 'self' *",
              });
              res.end(remote.html);
              return;
            }
          } catch {
            // ignore
          }

          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Entry file not found');
          return;
        }

        // Port availability check endpoint: /api/ports/check?port=...&appId=...
        if (url.startsWith('/api/ports/check')) {
          const parsedUrl = new URL(url, 'http://127.0.0.1:5173');
          const portStr = parsedUrl.searchParams.get('port') || '';
          const checkAppId = parsedUrl.searchParams.get('appId') || '';
          const portNum = parseInt(portStr, 10);

          if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ port: portNum, available: false, reason: 'Port must be between 1024 and 65535' }));
            return;
          }

          // If this port is already assigned to the same app, it's valid
          const existingPort = appPortRegistry.get(checkAppId);
          if (existingPort === portNum) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ port: portNum, available: true }));
            return;
          }

          // Check if used by another app in the registry
          let inRegistry = false;
          for (const [id, p] of appPortRegistry.entries()) {
            if (id !== checkAppId && p === portNum) {
              inRegistry = true;
              break;
            }
          }

          const inUse = inRegistry || (await isPortInUse(portNum));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            port: portNum,
            available: !inUse,
            reason: inUse ? `Port ${portNum} is currently in use` : undefined,
          }));
          return;
        }

        // Framework Detection & Clone Endpoint
        if (url.startsWith('/api/apps/detect') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { appId, repoUrl, repoName } = JSON.parse(body || '{}');
              const repoDir = path.resolve(process.cwd(), '.repomova', 'repos', appId || repoName);

              // If directory does not exist, do shallow clone
              if (!fs.existsSync(repoDir) && repoUrl) {
                fs.mkdirSync(path.dirname(repoDir), { recursive: true });
                await execAsync(`git clone --depth 1 ${repoUrl} "${repoDir}"`);
              }

              const detection = detectFramework(repoDir);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                appId,
                runtimeType: detection.runtimeType,
                details: detection.details,
                serveDir: detection.serveDir,
                entryFile: detection.entryFile,
                hasWebInterface: detection.hasWebInterface,
                projectTypeCategory: detection.projectTypeCategory,
                missingConfigReason: detection.missingConfigReason,
                entryPoint: detection.entryPoint,
                startCommand: detection.startCommand,
                buildCommand: detection.buildCommand,
                installCommand: detection.installCommand,
                testCommand: detection.testCommand,
                projectRoot: detection.projectRoot,
                packageManager: detection.packageManager,
                isMonorepo: detection.isMonorepo,
                detectedServices: detection.detectedServices,
                commandSources: detection.commandSources,
                detectedEnvVars: detection.detectedEnvVars,
                noWebEntry: detection.noWebEntry,
                cloned: fs.existsSync(repoDir),
              }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: msg }));
            }
          });
          return;
        }

        // SSE Real-Time Launch Stream: /api/apps/launch/events
        if (url.startsWith('/api/apps/launch/events')) {
          const parsedUrl = new URL(url, 'http://127.0.0.1:5173');
          const appId = parsedUrl.searchParams.get('appId') || '';
          const repoUrl = parsedUrl.searchParams.get('repoUrl') || '';
          const repoName = parsedUrl.searchParams.get('repoName') || 'app';
          const preferredPortStr = parsedUrl.searchParams.get('port');
          const preferredPort = preferredPortStr ? parseInt(preferredPortStr, 10) : undefined;
          const userProjectRoot = parsedUrl.searchParams.get('projectRoot') || '';

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          const sendEvent = (event: string, data: Record<string, unknown>) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          const rawRepoDir = path.resolve(process.cwd(), '.repomova', 'repos', appId || repoName);
          const repoDir = userProjectRoot ? path.resolve(rawRepoDir, userProjectRoot) : rawRepoDir;
          let currentServeDir = repoDir;
          let currentCommand = 'Built-in Static Server';

          try {
            // IDEMPOTENCY CHECK: If this app is already running and healthy, reuse it!
            const existing = runningInstances.get(appId);
            if (existing && (existing.server || existing.process)) {
              const healthCheck = await performHttpHealthCheck(`http://127.0.0.1:${existing.port}`, 2, 100);
              if (healthCheck.healthy) {
                sendEvent('ready', {
                  stage: 'ready',
                  status: 'running' as AppStatus,
                  port: existing.port,
                  previewUrl: `/preview/${appId}/`,
                  runtimeType: existing.runtimeType,
                  servedDir: existing.servedDir || repoDir,
                  reused: true,
                });
                res.end();
                return;
              }
              // If stale or failed, clean it up before relaunching
              stopAppInstance(appId);
            }

            sendEvent('stage', { stage: 'authorizing', message: 'Authorizing workspace...' });

            const cacheDir = path.resolve(process.cwd(), '.repomova', 'cache');
            fs.mkdirSync(cacheDir, { recursive: true });

            sendEvent('stage', { stage: 'cloning', message: 'Performing shallow clone...' });
            if (!fs.existsSync(rawRepoDir)) {
              fs.mkdirSync(path.dirname(rawRepoDir), { recursive: true });
              await execAsync(`git clone --depth 1 ${repoUrl} "${rawRepoDir}"`);
            }

            // Independent parallel verification: allocate unique free port & verify git
            sendEvent('stage', { stage: 'verifying', message: 'Verifying repository integrity...' });
            const [port] = await Promise.all([
              allocateFreePort(appId, preferredPort),
              new Promise((r) => setTimeout(r, 60)),
            ]);

            // Set port in process environment
            process.env.PORT = String(port);

            // Detect runtime and entry points from cloned files
            sendEvent('stage', { stage: 'detecting', message: 'Detecting framework & entry points...' });
            const detection = detectFramework(repoDir);

            // Handle repositories without directly viewable graphical interfaces (Backend, CLI, Library, Worker)
            if (!detection.hasWebInterface) {
              const isBackendService =
                detection.projectTypeCategory === 'backend' ||
                ['backend', 'python', 'go', 'rust', 'java'].includes(detection.runtimeType);

              if (isBackendService) {
                sendEvent('stage', {
                  stage: 'resolving_runtime',
                  runtimeType: detection.runtimeType,
                  message: `Resolved backend runtime: ${detection.runtimeType} (${detection.details})`,
                });
                sendEvent('stage', { stage: 'starting', port, message: `Configured backend service on port ${port}...` });

                sendEvent('ready', {
                  stage: 'ready',
                  status: 'running' as AppStatus,
                  port,
                  previewUrl: `http://127.0.0.1:${port}`,
                  runtimeType: detection.runtimeType,
                  hasWebInterface: false,
                  projectTypeCategory: 'backend',
                  details: detection.details,
                  entryPoint: detection.entryPoint,
                  startCommand: detection.startCommand,
                  buildCommand: detection.buildCommand,
                  installCommand: detection.installCommand,
                  testCommand: detection.testCommand,
                  projectRoot: detection.projectRoot || userProjectRoot || undefined,
                  packageManager: detection.packageManager,
                  isMonorepo: detection.isMonorepo,
                  detectedServices: detection.detectedServices,
                  commandSources: detection.commandSources,
                  detectedEnvVars: detection.detectedEnvVars,
                  servedDir: currentServeDir,
                });
                res.end();
                return;
              } else {
                // CLI tools, Libraries, Workers, Unknown:
                // Never display a false running status! Status remains connected.
                sendEvent('stage', {
                  stage: 'resolving_runtime',
                  runtimeType: detection.runtimeType,
                  message: `Detected ${detection.details}. No graphical web interface required.`,
                });
                sendEvent('ready', {
                  stage: 'ready',
                  status: 'connected' as AppStatus,
                  port: 0,
                  previewUrl: '',
                  runtimeType: detection.runtimeType,
                  hasWebInterface: false,
                  projectTypeCategory: detection.projectTypeCategory,
                  details: detection.details,
                  entryPoint: detection.entryPoint,
                  startCommand: detection.startCommand,
                  buildCommand: detection.buildCommand,
                  installCommand: detection.installCommand,
                  testCommand: detection.testCommand,
                  projectRoot: detection.projectRoot || userProjectRoot || undefined,
                  packageManager: detection.packageManager,
                  isMonorepo: detection.isMonorepo,
                  detectedServices: detection.detectedServices,
                  commandSources: detection.commandSources,
                  detectedEnvVars: detection.detectedEnvVars,
                  missingConfigReason: detection.missingConfigReason,
                  servedDir: currentServeDir,
                });
                res.end();
                return;
              }
            }

            sendEvent('stage', {
              stage: 'resolving_runtime',
              runtimeType: detection.runtimeType,
              message: `Resolved runtime: ${detection.runtimeType} (${detection.details})`,
            });

            // Dependency installation check with lockfile hash cache
            sendEvent('stage', { stage: 'installing_deps', message: 'Checking dependency cache...' });
            let skippedDeps = false;
            if (detection.runtimeType === 'static') {
              skippedDeps = true; // Static sites have 0 dependencies
            } else {
              const currentHash = computeLockfileHash(repoDir);
              const hashFile = path.join(cacheDir, `${appId}.hash`);
              const cachedHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8') : null;

              if (currentHash && currentHash === cachedHash) {
                skippedDeps = true; // Cache hit: lockfile unchanged!
              } else if (currentHash) {
                fs.writeFileSync(hashFile, currentHash, 'utf8');
              }
            }

            currentServeDir = detection.serveDir || repoDir;
            currentCommand = detection.startCommand || 'Built-in Static Server';

            let server: http.Server | undefined;
            let childProcess: ChildProcess | undefined;

            if (detection.runtimeType === 'static') {
              // Static HTML5 website
              sendEvent('stage', { stage: 'building', skipped: true });

              const entryCheck = findEntryPoint(currentServeDir) || findEntryPoint(repoDir);
              if (!entryCheck) {
                throw new Error(
                  `No entry file found: index.html was not found in served directory "${currentServeDir}". ${detection.details}`
                );
              }
              currentServeDir = entryCheck.serveDir;

              sendEvent('stage', {
                stage: 'starting',
                port,
                message: `Starting server on port ${port} (serving ${path.relative(repoDir, currentServeDir) || '.'})...`,
              });

              stopAppInstance(appId);
              server = await startStaticServer(currentServeDir, port);

              runningInstances.set(appId, {
                appId,
                port,
                server,
                runtimeType: detection.runtimeType,
                servedDir: currentServeDir,
                startedAt: new Date().toISOString(),
              });
            } else {
              // Framework applications (Vite, React, Vue, Next.js, etc.)
              const pkgJsonPath = path.join(repoDir, 'package.json');
              const nodeModulesPath = path.join(repoDir, 'node_modules');

              if (fs.existsSync(pkgJsonPath) && !fs.existsSync(nodeModulesPath)) {
                sendEvent('stage', { stage: 'installing_deps', message: 'Installing dependencies (npm install)...' });
                try {
                  await execAsync('npm install --no-audit --no-fund', { cwd: repoDir, timeout: 90000 });
                } catch (installErr: unknown) {
                  const msg = installErr instanceof Error ? installErr.message : String(installErr);
                  throw new Error(`Dependency installation failed: ${msg}`);
                }
              }

              if (detection.needsBuild && detection.hasBuildScript) {
                sendEvent('stage', { stage: 'building', message: 'Building application (npm run build)...' });
                try {
                  await execAsync('npm run build', { cwd: repoDir, timeout: 60000 });
                  const recheckEntry = findEntryPoint(repoDir);
                  if (recheckEntry) {
                    currentServeDir = recheckEntry.serveDir;
                  }
                } catch (buildErr: unknown) {
                  const msg = buildErr instanceof Error ? buildErr.message : String(buildErr);
                  throw new Error(`Build failed during preparation: ${msg}. Served directory: ${currentServeDir}`);
                }
              }

              const entryCheck = findEntryPoint(currentServeDir) || findEntryPoint(repoDir);
              if (entryCheck) {
                currentServeDir = entryCheck.serveDir;
                sendEvent('stage', {
                  stage: 'starting',
                  port,
                  message: `Starting server on port ${port}...`,
                });
                stopAppInstance(appId);
                server = await startStaticServer(currentServeDir, port);
                runningInstances.set(appId, {
                  appId,
                  port,
                  server,
                  runtimeType: detection.runtimeType,
                  servedDir: currentServeDir,
                  startedAt: new Date().toISOString(),
                });
              } else if (detection.startCommand) {
                sendEvent('stage', {
                  stage: 'starting',
                  port,
                  message: `Starting dev server: ${detection.startCommand} on port ${port}...`,
                });
                stopAppInstance(appId);

                const cmdParts = detection.startCommand.split(' ');
                childProcess = spawn(cmdParts[0], cmdParts.slice(1), {
                  cwd: repoDir,
                  shell: true,
                  env: {
                    ...process.env,
                    PORT: String(port),
                    HOST: '127.0.0.1',
                  },
                });

                runningInstances.set(appId, {
                  appId,
                  port,
                  process: childProcess,
                  runtimeType: detection.runtimeType,
                  servedDir: currentServeDir,
                  startedAt: new Date().toISOString(),
                });
              } else {
                throw new Error(
                  `No runnable web entry point found in "${currentServeDir}".`
                );
              }
            }

            // Real HTTP Health Check on the allocated port: MUST return 200 with HTML!
            sendEvent('stage', { stage: 'health_check', message: `Verifying HTTP health at http://127.0.0.1:${port}...` });
            const directPortUrl = `http://127.0.0.1:${port}/`;
            const healthCheck = await performHttpHealthCheck(directPortUrl, 25, 300);

            if (!healthCheck.healthy) {
              stopAppInstance(appId);
              throw new Error(
                `Launch health check failed: ${healthCheck.reason || 'Server did not return HTML 200'}. Status: ${healthCheck.status || 'unknown'}. Served directory: "${currentServeDir}". Command: "${currentCommand}"`
              );
            }

            const previewUrl = `/preview/${appId}/`;

            // Send ready state only after HTTP 200 with HTML succeeds!
            sendEvent('ready', {
              stage: 'ready',
              status: 'running' as AppStatus,
              port,
              previewUrl,
              runtimeType: detection.runtimeType,
              startCommand: detection.startCommand,
              buildCommand: detection.buildCommand,
              commandSources: detection.commandSources,
              detectedEnvVars: detection.detectedEnvVars,
              servedDir: currentServeDir,
              skippedDeps,
            });

            res.end();
          } catch (err: unknown) {
            stopAppInstance(appId);
            const msg = err instanceof Error ? err.message : String(err);
            sendEvent('launch_error', {
              message: msg,
              servedDir: currentServeDir,
              command: currentCommand,
            });
            sendEvent('error', {
              message: msg,
              servedDir: currentServeDir,
              command: currentCommand,
            });
            res.end();
          }
          return;
        }

        // CLI Execution & Script Runner endpoint
        if (url.startsWith('/api/apps/cli/run') && req.method === 'POST') {
          try {
            const body = await readJsonBody();
            const { appId, repoName, command = '', args = '', projectRoot = '' } = body;
            const baseDir = path.resolve(process.cwd(), '.repomova', 'repos', appId || repoName);
            const cwd = projectRoot ? path.resolve(baseDir, projectRoot) : baseDir;

            if (!fs.existsSync(cwd)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Directory not found: ${cwd}`, exitCode: 1 }));
              return;
            }

            const cleanCmd = String(command).trim();
            const cleanArgs = String(args).trim();
            const fullCmd = cleanArgs ? `${cleanCmd} ${cleanArgs}` : cleanCmd;

            if (!cleanCmd) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Command cannot be empty', exitCode: 1 }));
              return;
            }

            const startTime = Date.now();
            exec(fullCmd, { cwd, timeout: 20000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
              const durationMs = Date.now() - startTime;
              const exitCode = err ? ((err as any).code ?? 1) : 0;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                command: fullCmd,
                stdout: stdout || '',
                stderr: stderr || (err ? err.message : ''),
                exitCode: typeof exitCode === 'number' ? exitCode : 1,
                durationMs,
              }));
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: msg, exitCode: 1 }));
          }
          return;
        }

        // Stop application endpoint
        if (url.startsWith('/api/apps/stop') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const { appId } = JSON.parse(body || '{}');
              const stopped = stopAppInstance(appId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ appId, stopped }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: msg }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
