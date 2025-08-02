const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const hostname = 'localhost';
const port = 3000;

// Cache for static files
const staticCache = {};
const cacheMaxAge = 86400000; // 24 hours in ms

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = `.${parsedUrl.pathname}`;
  
  // Default to index.html for root and client-side routing
  if (pathname === './' || !path.extname(pathname)) {
    pathname = './src/index.html';
  }

  const extname = String(path.extname(pathname)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Check cache first
  if (staticCache[pathname] && extname !== '.html') {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${cacheMaxAge/1000}`
    });
    res.end(staticCache[pathname], 'utf-8');
    return;
  }

  fs.readFile(pathname, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Handle SPA routing - return index.html for all unknown paths
        if (extname === '.html' || extname === '') {
          fs.readFile('./src/index.html', (err, content) => {
            if (err) {
              res.writeHead(500);
              res.end(`Server Error: ${err.code}`);
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(`<h1>404 Not Found</h1><p>The requested URL ${pathname} was not found on this server.</p>`, 'utf-8');
        }
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Cache the file if it's not HTML
      if (extname !== '.html') {
        staticCache[pathname] = content;
      }

      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': extname === '.html' ? 'no-cache' : `public, max-age=${cacheMaxAge/1000}`
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});