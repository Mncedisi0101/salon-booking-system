const supabase = require('../supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Create a new appointment
    const { businessId, userId, service, appointmentDate, notes } = req.body;
    
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ business_id: businessId, user_id: userId, service, appointment_date: appointmentDate, notes }])
      .select();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ appointment: data[0] });
  }

  if (req.method === 'GET') {
    // Get appointments for a business
    const { businessId } = req.query;
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        users (name, email, phone)
      `)
      .eq('business_id', businessId)
      .order('appointment_date', { ascending: true });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ appointments: data });
  }

  if (req.method === 'PUT') {
    // Update appointment status
    const { id, status } = req.body;
    
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ appointment: data[0] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};