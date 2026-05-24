/**
 * Zero-dependency Static Web Server for CanvasFlow
 * Bypasses npm install node_modules file locking issues on Google Drive.
 * Runs on Node.js using built-in http, fs, and path modules.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Decode URL (handles Korean characters in path if any)
  const decodedUrl = decodeURIComponent(req.url);
  
  // Clean query parameters
  const urlPath = decodedUrl.split('?')[0];
  
  // Resolve file path
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  
  // Prevent directory traversal attacks
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }
  
  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: If not found, serve index.html (useful for SPAs)
      filePath = path.join(__dirname, 'index.html');
    }
    
    // Read and serve file
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 Internal Server Error: ${error.code}`);
        return;
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content, 'utf-8');
    });
  });
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` 하맘캔버스 Dev Server is running successfully!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
