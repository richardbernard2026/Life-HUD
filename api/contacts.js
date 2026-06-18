// api/contacts.js — Vercel Blob proxy for cross-device contact sync
// GET: reads contacts from blob store
// POST: writes contacts to blob store (token stays server-side)

const { put, list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: 'contacts.json', token });
      if (blobs.length === 0) return res.json([]);
      const r = await fetch(blobs[0].url);
      if (!r.ok) return res.json([]);
      const data = await r.json();
      return res.json(data);
    } catch (e) {
      console.error('GET contacts:', e.message);
      return res.json([]);
    }
  }

  if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const contacts = JSON.parse(body);
      if (!Array.isArray(contacts)) return res.status(400).json({ error: 'Expected array' });

      await put('contacts.json', body, {
        access: 'public',
        addRandomSuffix: false,
        token,
        contentType: 'application/json',
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error('POST contacts:', e.message);
      return res.status(500).json({ error: 'Failed to save' });
    }
  }

  res.status(405).end();
};
