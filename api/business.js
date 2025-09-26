const supabase = require('../supabase');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      // Register a new business
      const { name, email, phone, address, services } = req.body;
      
      console.log('Received business data:', { name, email });
      
      const { data, error } = await supabase
        .from('businesses')
        .insert([{ name, email, phone, address, services }])
        .select();
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(200).json({ business: data[0], success: true });
    }

    if (req.method === 'GET') {
      // Get business by ID
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Business ID is required' });
      }
      
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      
      if (!data) {
        return res.status(404).json({ error: 'Business not found' });
      }
      
      return res.status(200).json({ business: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};