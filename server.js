const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = __dirname;
const JSON_FILE = path.join(DATA_DIR, 'portfolios.json');
const CSV_FILE = path.join(DATA_DIR, 'portfolios.csv');
const ADMIN_PASSWORD = 'dsaandcode';

// Initialize storage files with updated Name, USN, Portfolio_URL schema
function initStorage() {
  if (!fs.existsSync(JSON_FILE)) {
    fs.writeFileSync(JSON_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(CSV_FILE)) {
    const csvHeader = 'ID,Name,USN,Portfolio_URL,Platform,Submitted_At\n';
    fs.writeFileSync(CSV_FILE, csvHeader, 'utf8');
  }
}
initStorage();

function readPortfolios() {
  try {
    if (!fs.existsSync(JSON_FILE)) return [];
    const content = fs.readFileSync(JSON_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading JSON storage:', err.message);
    return [];
  }
}

function savePortfolios(list) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function appendToCsv(item) {
  const sanitize = (str) => {
    if (!str) return '""';
    const clean = String(str).replace(/"/g, '""').replace(/\r?\n|\r/g, ' ');
    return `"${clean}"`;
  };

  const line = [
    sanitize(item.id),
    sanitize(item.name || 'Anonymous'),
    sanitize(item.usn || 'N/A'),
    sanitize(item.url),
    sanitize(item.platform || 'GitHub'),
    sanitize(item.timestamp)
  ].join(',') + '\n';

  fs.appendFileSync(CSV_FILE, line, 'utf8');
}

function rewriteCsv(list) {
  const sanitize = (str) => {
    if (!str) return '""';
    const clean = String(str).replace(/"/g, '""').replace(/\r?\n|\r/g, ' ');
    return `"${clean}"`;
  };

  let content = 'ID,Name,USN,Portfolio_URL,Platform,Submitted_At\n';
  for (const item of list) {
    content += [
      sanitize(item.id),
      sanitize(item.name || 'Anonymous'),
      sanitize(item.usn || 'N/A'),
      sanitize(item.url),
      sanitize(item.platform || 'GitHub'),
      sanitize(item.timestamp)
    ].join(',') + '\n';
  }
  fs.writeFileSync(CSV_FILE, content, 'utf8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API: Admin password verification
  if (req.method === 'POST' && pathname === '/api/admin/verify') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.password === ADMIN_PASSWORD) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Admin verified' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid admin password' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Bad request' }));
      }
    });
    return;
  }

  // API: Get all portfolios (Admin view)
  if (req.method === 'GET' && pathname === '/api/portfolios') {
    const list = readPortfolios();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length, data: list }));
    return;
  }

  // API: Export CSV (Admin)
  if (req.method === 'GET' && pathname === '/api/export/csv') {
    if (fs.existsSync(CSV_FILE)) {
      const csvData = fs.readFileSync(CSV_FILE, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="portfolios.csv"'
      });
      res.end(csvData);
      return;
    }
  }

  // API: Submit new student portfolio (Public)
  if (req.method === 'POST' && pathname === '/api/portfolios') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const name = (payload.name || '').trim().toUpperCase();
        if (!name || !/^[A-Z\s]{2,60}$/.test(name)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Name must contain letters only (A-Z)' }));
          return;
        }

        const usn = (payload.usn || '').trim().toUpperCase();
        if (!usn || !/^[A-Z0-9]{4,20}$/.test(usn)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'USN must be a valid alphanumeric ID' }));
          return;
        }

        let cleanUrl = (payload.url || '').trim();
        if (!/^https?:\/\//i.test(cleanUrl)) {
          if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
          }
        }

        const isValidHttps = () => {
          if (!cleanUrl.startsWith('https://')) return false;
          try {
            const parsed = new URL(cleanUrl);
            if (parsed.protocol !== 'https:') return false;
            const host = parsed.hostname;
            if (!host || host.length < 3) return false;
            return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(host);
          } catch (e) {
            return false;
          }
        };

        if (!isValidHttps()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid URL. Must be a valid https:// URL (e.g. https://xyz.vercel.app)' }));
          return;
        }

        const newEntry = {
          id: 'pf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: name,
          usn: usn,
          url: cleanUrl,
          platform: payload.platform || (cleanUrl.toLowerCase().includes('vercel') ? 'Vercel' : (cleanUrl.includes('github.com') ? 'GitHub' : 'Web')),
          timestamp: new Date().toISOString()
        };

        const currentList = readPortfolios();
        currentList.unshift(newEntry);
        savePortfolios(currentList);
        appendToCsv(newEntry);

        console.log(`[+] Stored portfolio: ${newEntry.name} (${newEntry.usn}) -> ${newEntry.url}`);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: newEntry, total: currentList.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: Delete entry (Admin)
  if (req.method === 'DELETE' && pathname.startsWith('/api/portfolios/')) {
    const id = pathname.replace('/api/portfolios/', '');
    let list = readPortfolios();
    const prevLen = list.length;
    list = list.filter(item => item.id !== id);
    if (list.length !== prevLen) {
      savePortfolios(list);
      rewriteCsv(list);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length }));
    return;
  }

  // Serve static files
  let safePath = pathname === '/' ? '/index.html' : pathname;
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`✨ Portfolio Collector Server running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`🔐 Admin: Double-click top-left logo (Password: ${ADMIN_PASSWORD})`);
  console.log(`📁 Files automatically saved to:`);
  console.log(`   - JSON: ${JSON_FILE}`);
  console.log(`   - CSV:  ${CSV_FILE}`);
  console.log(`=======================================================`);
});
