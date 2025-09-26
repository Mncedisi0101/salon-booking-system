const supabase = require('../supabase');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      // Simple user authentication/creation
      const { businessId, name, email, phone } = req.body;
      
      const { data, error } = await supabase
        .from('users')
        .upsert({
          business_id: businessId,
          name,
          email,
          phone
        }, { onConflict: 'email,business_id' })
        .select()
        .single();
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(200).json({ user: data });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};