/* ===== VMC REAL MAIL SERVER - Node.js IMAP Proxy ===== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const PORT = 8000;
const ROOT = __dirname;

// MIME type map
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

// IMAP server configs by domain
const IMAP_SERVERS = {
  'gmail.com': { host: 'imap.gmail.com', port: 993, secure: true },
  'yahoo.com': { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  'outlook.com': { host: 'outlook.office365.com', port: 993, secure: true },
  'hotmail.com': { host: 'outlook.office365.com', port: 993, secure: true },
  'live.com': { host: 'outlook.office365.com', port: 993, secure: true },
  'aol.com': { host: 'imap.aol.com', port: 993, secure: true },
  'protonmail.com': { host: '127.0.0.1', port: 1143, secure: false }, // ProtonMail Bridge only
  'proton.me': { host: '127.0.0.1', port: 1143, secure: false },
  'icloud.com': { host: 'imap.mail.me.com', port: 993, secure: true },
  'zoho.com': { host: 'imap.zoho.com', port: 993, secure: true },
  'yandex.com': { host: 'imap.yandex.com', port: 993, secure: true },
  'mail.com': { host: 'imap.mail.com', port: 993, secure: true },
  'mail.ru': { host: 'imap.mail.ru', port: 993, secure: true },
  'gmx.com': { host: 'imap.gmx.com', port: 993, secure: true }
};

// Active IMAP connections cache
const activeConnections = new Map();

// ===== IMAP FUNCTIONS =====

async function imapLogin(email, password) {
  const domain = email.split('@')[1]?.toLowerCase();
  const serverConfig = IMAP_SERVERS[domain];
  
  if (!serverConfig) {
    return { success: false, error: `Unsupported email domain: ${domain}. Only major providers are supported.` };
  }

  try {
    const client = new ImapFlow({
      host: serverConfig.host,
      port: serverConfig.port,
      secure: serverConfig.secure,
      auth: {
        user: email,
        pass: password
      },
      logger: false,
      tls: {
        rejectUnauthorized: false // Allow self-signed certs for some providers
      }
    });

    // CRITICAL: Attach an error listener to prevent uncaught exceptions from crashing the server
    client.on('error', (err) => {
      console.error(`[IMAP client error for ${email}]:`, err.message);
    });

    await client.connect();
    
    // Store connection for later use
    activeConnections.set(email, { client, loginTime: Date.now() });

    // Fetch initial inbox messages
    const messages = await fetchInboxMessages(client, email, 50);

    return { 
      success: true, 
      token: 'imap-authenticated',
      messages: messages,
      account: email
    };
  } catch (err) {
    console.error(`IMAP login failed for ${email}:`, err.message);
    
    let errorMsg = err.message;
    if (errorMsg === 'Command failed') {
      errorMsg = 'AUTHENTICATION FAILED: Check email/app password. For Gmail, you MUST use a 16-character App Password (not your regular account password). Also make sure IMAP is turned ON in your Gmail settings.';
    } else if (errorMsg.includes('AUTHENTICATIONFAILED') || errorMsg.includes('Invalid credentials')) {
      errorMsg = 'AUTHENTICATION FAILED: Check email/app password. For Gmail, you MUST use a 16-character App Password (not your regular account password).';
    } else if (errorMsg.includes('ECONNREFUSED')) {
      errorMsg = `CONNECTION REFUSED: Cannot reach ${serverConfig.host}. Check network/firewall.`;
    } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
      errorMsg = `CONNECTION TIMEOUT: ${serverConfig.host} did not respond in time.`;
    }
    
    return { success: false, error: errorMsg };
  }
}

async function fetchInboxMessages(client, email, count = 50) {
  const messages = [];
  
  try {
    // Open INBOX
    const lock = await client.getMailboxLock('INBOX');
    
    try {
      // Get total message count
      const status = client.mailbox;
      const totalMessages = status.exists || 0;
      
      if (totalMessages === 0) {
        return messages;
      }

      // Fetch the latest N messages
      const startSeq = Math.max(1, totalMessages - count + 1);
      const range = `${startSeq}:*`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        source: true,
        uid: true,
        flags: true
      })) {
        try {
          const parsed = await simpleParser(msg.source);
          
          const fromAddr = parsed.from?.value?.[0]?.address || 
                          parsed.from?.text || 
                          msg.envelope?.from?.[0]?.address || 
                          'unknown@unknown.com';
          const fromName = parsed.from?.value?.[0]?.name || 
                          msg.envelope?.from?.[0]?.name || 
                          fromAddr;

          // Get the body content - prefer HTML, fallback to text
          let bodyContent = '';
          if (parsed.html) {
            bodyContent = parsed.html;
          } else if (parsed.textAsHtml) {
            bodyContent = parsed.textAsHtml;
          } else if (parsed.text) {
            bodyContent = parsed.text;
          }

          // Create a text preview from the body
          let preview = parsed.text || '';
          preview = preview.replace(/\s+/g, ' ').trim().substring(0, 200);

          messages.push({
            id: `msg_${msg.uid}_${Date.now()}`,
            uid: msg.uid,
            from: `${fromName} <${fromAddr}>`,
            fromAddress: fromAddr,
            fromName: fromName,
            subject: parsed.subject || msg.envelope?.subject || '(No Subject)',
            preview: preview,
            body: bodyContent,
            date: (parsed.date || msg.envelope?.date || new Date()).toISOString(),
            read: msg.flags?.has('\\Seen') || false,
            accountEmail: email,
            // Store the sender domain for "Search Previous Domain" feature
            senderDomain: fromAddr.split('@')[1] || ''
          });
        } catch (parseErr) {
          console.warn(`Failed to parse message UID ${msg.uid}:`, parseErr.message);
          // Still add a basic entry
          messages.push({
            id: `msg_${msg.uid}_${Date.now()}`,
            uid: msg.uid,
            from: msg.envelope?.from?.[0]?.address || 'unknown',
            fromAddress: msg.envelope?.from?.[0]?.address || 'unknown',
            fromName: msg.envelope?.from?.[0]?.name || 'Unknown',
            subject: msg.envelope?.subject || '(No Subject)',
            preview: 'Could not parse message body',
            body: '<p>Could not parse message body</p>',
            date: (msg.envelope?.date || new Date()).toISOString(),
            read: msg.flags?.has('\\Seen') || false,
            accountEmail: email,
            senderDomain: (msg.envelope?.from?.[0]?.address || '').split('@')[1] || ''
          });
        }
      }
    } finally {
      lock.release();
    }
  } catch (fetchErr) {
    console.error(`Failed to fetch inbox for ${email}:`, fetchErr.message);
  }

  // Sort by date descending (newest first)
  messages.sort((a, b) => new Date(b.date) - new Date(a.date));
  return messages;
}

async function refreshInbox(email) {
  const conn = activeConnections.get(email);
  if (!conn || !conn.client) {
    return { success: false, error: 'No active connection. Please login again.' };
  }

  try {
    const messages = await fetchInboxMessages(conn.client, email, 50);
    return { success: true, messages, account: email };
  } catch (err) {
    console.error(`Refresh failed for ${email}:`, err.message);
    // Connection might have timed out, remove it
    activeConnections.delete(email);
    return { success: false, error: 'Connection expired. Please login again.' };
  }
}

async function logoutAccount(email) {
  const conn = activeConnections.get(email);
  if (conn && conn.client) {
    try {
      await conn.client.logout();
    } catch(e) {
      // ignore
    }
  }
  activeConnections.delete(email);
  return { success: true };
}

// ===== HTTP SERVER =====

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // ===== API ROUTES =====

  if (urlPath === '/imap-proxy' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const body = await readBody(req);
      const json = JSON.parse(body);
      const { action, email, password } = json;

      let result;

      switch (action) {
        case 'login':
          console.log(`[IMAP] Login attempt: ${email}`);
          result = await imapLogin(email, password);
          console.log(`[IMAP] Login ${result.success ? 'SUCCESS' : 'FAILED'}: ${email} ${result.success ? `(${result.messages?.length || 0} messages)` : result.error}`);
          break;

        case 'fetch':
        case 'refresh':
          console.log(`[IMAP] Refresh inbox: ${email}`);
          result = await refreshInbox(email);
          console.log(`[IMAP] Refresh ${result.success ? 'SUCCESS' : 'FAILED'}: ${email} ${result.success ? `(${result.messages?.length || 0} messages)` : result.error}`);
          break;

        case 'logout':
          console.log(`[IMAP] Logout: ${email}`);
          result = await logoutAccount(email);
          break;

        default:
          result = { success: false, error: 'Unknown action. Use: login, fetch, refresh, logout' };
      }

      const jsonStr = JSON.stringify(result);
      res.writeHead(200);
      res.end(jsonStr);
    } catch (err) {
      console.error('[IMAP-PROXY ERROR]', err);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    
    return;
  }

  // ===== STATIC FILE SERVING =====
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(ROOT, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileData = fs.readFileSync(filePath);
      
      res.setHeader('Content-Type', contentType);
      res.writeHead(200);
      res.end(fileData);
    } else {
      res.writeHead(404);
      res.end('404 Not Found');
    }
  } catch (fileErr) {
    res.writeHead(500);
    res.end('500 Internal Server Error');
  }

  const logLine = `${req.method} ${urlPath} -> ${res.statusCode}`;
  if (!urlPath.match(/\.(css|js|png|jpg|svg|ico|woff|woff2)$/)) {
    console.log(logLine);
  }
});

// Cleanup connections on exit
process.on('SIGINT', async () => {
  console.log('\n[VMC] Shutting down...');
  for (const [email, conn] of activeConnections) {
    try { await conn.client.logout(); } catch(e) {}
  }
  activeConnections.clear();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  for (const [email, conn] of activeConnections) {
    try { await conn.client.logout(); } catch(e) {}
  }
  activeConnections.clear();
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     VMC MAIL SERVER - REAL IMAP ENGINE       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Server running at http://localhost:${PORT}/    ║`);
  console.log('║  IMAP proxy endpoint: /imap-proxy            ║');
  console.log('║  Press Ctrl+C to stop                        ║');
  console.log('╚══════════════════════════════════════════════╝');
});
