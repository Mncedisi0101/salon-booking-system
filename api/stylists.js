const supabase = require('../supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { businessId, name, email, phone, specialization, bio, imageUrl } = req.body;

      if (!businessId || !name) {
        return res.status(400).json({ error: 'Business ID and name are required' });
      }

      const { data, error } = await supabase
        .from('stylists')
        .insert([{ 
          business_id: businessId,
          name,
          email,
          phone,
          specialization,
          bio,
          image_url: imageUrl
        }])
        .select();

      if (error) {
        console.error('Stylist creation error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        stylist: data[0], 
        success: true 
      });

    } catch (error) {
      console.error('Stylists API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { businessId } = req.query;

      if (!businessId) {
        return res.status(400).json({ error: 'Business ID is required' });
      }

      const { data, error } = await supabase
        .from('stylists')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) {
        console.error('Stylists fetch error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        stylists: data || [], 
        success: true 
      });

    } catch (error) {
      console.error('Stylists API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, name, email, phone, specialization, bio, imageUrl, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Stylist ID is required' });
      }

      const { data, error } = await supabase
        .from('stylists')
        .update({ 
          name,
          email,
          phone,
          specialization,
          bio,
          image_url: imageUrl,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Stylist update error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        stylist: data[0], 
        success: true 
      });

    } catch (error) {
      console.error('Stylists API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Stylist ID is required' });
      }

      const { error } = await supabase
        .from('stylists')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Stylist deletion error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        success: true,
        message: 'Stylist deleted successfully'
      });

    } catch (error) {
      console.error('Stylists API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};