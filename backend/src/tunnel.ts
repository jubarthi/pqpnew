import { spawn } from 'child_process';

let activeTunnelUrl: string | null = null;

export function getActiveTunnelUrl(): string | null {
  return activeTunnelUrl;
}

export function startTunnel(port = 5175): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 12000);

      const checkOutput = (data: Buffer) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          activeTunnelUrl = match[0];
          console.log(`\n======================================================`);
          console.log(`🌐 [PQP Tunnel] Conexão pública para celular ATIVA!`);
          console.log(`   Link Direto: ${activeTunnelUrl}`);
          console.log(`======================================================\n`);
          resolve(activeTunnelUrl);
        }
      };

      child.stdout?.on('data', checkOutput);
      child.stderr?.on('data', checkOutput);

      child.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });

      process.on('exit', () => {
        try {
          child.kill();
        } catch {
          // ignore
        }
      });
    } catch {
      resolve(null);
    }
  });
}
