import { spawn, type ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const FASTAPI_HOST = '127.0.0.1';
const FASTAPI_PORT = Number(process.env.FASTAPI_PORT || 8000);

let pythonProcess: ChildProcess | null = null;

function resolvePythonExecutable(): string {
  const venvPython = path.resolve(__dirname, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}

function startFastAPIBackend(): void {
  const pythonBin = resolvePythonExecutable();
  const backendDir = path.resolve(__dirname, 'backend');

  pythonProcess = spawn(
    pythonBin,
    ['-m', 'uvicorn', 'main:app', '--host', FASTAPI_HOST, '--port', String(FASTAPI_PORT)],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  pythonProcess.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[fastapi] ${chunk.toString()}`);
  });

  pythonProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[fastapi] ${chunk.toString()}`);
  });

  pythonProcess.on('exit', (code) => {
    console.error(`[fastapi] exited with code ${code}`);
  });
}

function proxyToFastAPI(targetPath: string): express.RequestHandler {
  return (req, res) => {
    const proxyReq = http.request(
      {
        hostname: FASTAPI_HOST,
        port: FASTAPI_PORT,
        path: targetPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${FASTAPI_HOST}:${FASTAPI_PORT}`,
        },
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        });
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(503).json({
          detail: 'Document analysis backend is starting up or unavailable. Please retry in a moment.',
          error: err.message,
        });
      }
    });

    req.pipe(proxyReq);
  };
}

async function waitForFastAPI(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://${FASTAPI_HOST}:${FASTAPI_PORT}/health`, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function bootstrap(): Promise<void> {
  startFastAPIBackend();
  await waitForFastAPI();

  const app = express();

  // Proxy both /api/* and direct FastAPI routes (/upload, /ask, /health)
  app.get('/health', proxyToFastAPI('/health'));
  app.post('/upload', proxyToFastAPI('/upload'));
  app.post('/ask', proxyToFastAPI('/ask'));

  app.get('/api/health', proxyToFastAPI('/health'));
  app.post('/api/upload', proxyToFastAPI('/upload'));
  app.post('/api/ask', proxyToFastAPI('/ask'));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`DocMind AI server running at http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close();
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill('SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start DocMind AI server:', err);
  process.exit(1);
});
