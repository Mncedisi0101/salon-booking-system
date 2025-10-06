const supabase = require('../supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      // Create a new appointment
      const { businessId, userId, serviceId, appointmentDate, notes } = req.body;
      
      // First, create or get the user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          business_id: businessId,
          name: userId.name,
          email: userId.email,
          phone: userId.phone
        }, { onConflict: 'email,business_id' })
        .select()
        .single();
      
      if (userError) {
        return res.status(400).json({ error: userError.message });
      }
      
      // Get service details
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('name, price, duration')
        .eq('id', serviceId)
        .single();
      
      if (serviceError) {
        return res.status(400).json({ error: 'Invalid service selected' });
      }
      
      // Then create the appointment
      const { data, error } = await supabase
        .from('appointments')
        .insert([{ 
          business_id: businessId, 
          user_id: userData.id, 
          service_id: serviceId,
          service: serviceData.name, // Keep for backward compatibility
          appointment_date: appointmentDate, 
          notes 
        }])
        .select(`
          *,
          users (name, email, phone),
          services (name, description, price, duration)
        `);
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(200).json({ appointment: data[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
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