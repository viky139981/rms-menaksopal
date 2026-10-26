/**
 * Vercel serverless proxy.
 * Browser -> /api/gas -> Google Apps Script Web App.
 *
 * GAS_API_SECRET only exists server-side in Vercel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed.'
    });
  }

  const gasUrl = process.env.GAS_API_URL;
  const gasSecret = process.env.GAS_API_SECRET;

  if (!gasUrl || !gasSecret) {
    return res.status(500).json({
      success: false,
      message:
        'Vercel environment GAS_API_URL / GAS_API_SECRET belum dikonfigurasi.'
    });
  }

  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({
        success: false,
        message: 'Request JSON tidak valid.'
      });
    }
  }

  const action = String(body?.action || '').trim();
  const args = Array.isArray(body?.args) ? body.args : [];

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(action)) {
    return res.status(400).json({
      success: false,
      message: 'Action API tidak valid.'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);

  try {
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify({
        secret: gasSecret,
        action,
        args
      }),
      signal: controller.signal
    });

    const text = await upstream.text();

    let payload;

    try {
      payload = JSON.parse(text);
    } catch (_) {
      return res.status(502).json({
        success: false,
        message:
          'Backend Google Apps Script tidak mengembalikan JSON. ' +
          'Pastikan GAS sudah dideploy sebagai Web App /exec dengan akses Anyone.'
      });
    }

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json(payload);

  } catch (error) {
    const timeoutError = error?.name === 'AbortError';

    return res.status(timeoutError ? 504 : 502).json({
      success: false,
      message: timeoutError
        ? 'Backend Google Apps Script timeout.'
        : `Gagal menghubungi backend: ${error?.message || String(error)}`
    });

  } finally {
    clearTimeout(timeout);
  }
}
