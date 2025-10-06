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
      const { businessId, name, description, price, duration } = req.body;

      if (!businessId || !name || !price || !duration) {
        return res.status(400).json({ error: 'Business ID, name, price, and duration are required' });
      }

      const { data, error } = await supabase
        .from('services')
        .insert([{ 
          business_id: businessId,
          name,
          description,
          price,
          duration
        }])
        .select();

      if (error) {
        console.error('Service creation error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        service: data[0], 
        success: true 
      });

    } catch (error) {
      console.error('Services API error:', error);
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
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) {
        console.error('Services fetch error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        services: data || [], 
        success: true 
      });

    } catch (error) {
      console.error('Services API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, name, description, price, duration } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Service ID is required' });
      }

      const { data, error } = await supabase
        .from('services')
        .update({ 
          name,
          description,
          price,
          duration,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Service update error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        service: data[0], 
        success: true 
      });

    } catch (error) {
      console.error('Services API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Service ID is required' });
      }

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Service deletion error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ 
        success: true,
        message: 'Service deleted successfully'
      });

    } catch (error) {
      console.error('Services API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};