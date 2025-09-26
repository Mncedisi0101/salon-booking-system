const QRCode = require('qrcode');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }
    
    const url = `https://${req.headers.host}/customer.html?business=${businessId}`;
    
    try {
      const qrCode = await QRCode.toDataURL(url);
      return res.status(200).json({ qrCode, url });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to generate QR code' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};