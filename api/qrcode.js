const QRCode = require('qrcode');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { businessId } = req.body;
      
      if (!businessId) {
        return res.status(400).json({ error: 'Business ID is required' });
      }
      
      // Generate URL for the booking page - Fix the URL construction
      const baseUrl = req.headers.origin || `https://${req.headers.host}`;
      const url = `${baseUrl}/customer.html?business=${businessId}`;
      
      console.log('Generating QR code for URL:', url);
      
      // Generate QR code
      const qrCode = await QRCode.toDataURL(url);
      
      return res.status(200).json({ 
        success: true, 
        qrCode, 
        url,
        businessId 
      });
    } catch (err) {
      console.error('QR code generation error:', err);
      return res.status(500).json({ 
        error: 'Failed to generate QR code: ' + err.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};