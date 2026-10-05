const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join('/tmp', 'portfolios.json');
const CSV_FILE = path.join('/tmp', 'portfolios.csv');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'dsaandcode';

// In-memory cache fallback for serverless execution
let memoryCache = [];

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content) {
        memoryCache = JSON.parse(content);
        return memoryCache;
      }
    }
  } catch (e) {}
  return memoryCache;
}

function saveData(data) {
  memoryCache = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '';

  // API: Get all portfolios (Admin view / sync)
  if (req.method === 'GET' && (url.includes('/portfolios') || url === '/api' || url === '/api/')) {
    const list = loadData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length, data: list }));
    return;
  }

  // API: Submit new portfolio
  if (req.method === 'POST' && url.includes('/portfolios')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const name = (payload.name || '').trim().toUpperCase();
        const usn = (payload.usn || '').trim().toUpperCase();
        let cleanUrl = (payload.url || '').trim();

        if (!/^https?:\/\//i.test(cleanUrl)) {
          cleanUrl = 'https://' + cleanUrl;
        }

        const newEntry = {
          id: 'pf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: name || 'ANONYMOUS',
          usn: usn || 'N/A',
          url: cleanUrl,
          platform: payload.platform || (cleanUrl.toLowerCase().includes('vercel') ? 'Vercel' : 'Web'),
          timestamp: new Date().toISOString()
        };

        const list = loadData();
        list.unshift(newEntry);
        saveData(list);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: newEntry, total: list.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: Admin password verification
  if (req.method === 'POST' && url.includes('/admin/verify')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
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

  // API: Export CSV
  if (req.method === 'GET' && url.includes('/export/csv')) {
    const list = loadData();
    const sanitize = (str) => `"${String(str || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`;
    let csv = 'ID,Name,USN,Portfolio_URL,Platform,Submitted_At\n';
    list.forEach(item => {
      csv += [
        sanitize(item.id),
        sanitize(item.name || 'Anonymous'),
        sanitize(item.usn || 'N/A'),
        sanitize(item.url),
        sanitize(item.platform || 'GitHub'),
        sanitize(item.timestamp)
      ].join(',') + '\n';
    });
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="portfolios.csv"'
    });
    res.end(csv);
    return;
  }

  // API: Delete entry
  if (req.method === 'DELETE' && url.includes('/portfolios/')) {
    const id = url.split('/portfolios/')[1] || '';
    let list = loadData();
    list = list.filter(item => item.id !== id);
    saveData(list);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length }));
    return;
  }

  // Default fallback
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: 'PortfolioDrop API Active' }));
};
