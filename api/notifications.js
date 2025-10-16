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

  if (req.method === 'POST') {
    try {
      const { appointmentId, action, businessId } = req.body;

      // Get appointment details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          *,
          customers (*),
          services (*),
          businesses (*)
        `)
        .eq('id', appointmentId)
        .single();

      if (appointmentError) {
        return res.status(400).json({ error: 'Appointment not found' });
      }

      // Here you would integrate with your email/SMS service
      // For now, we'll just log the notification
      console.log('Sending notification:', {
        to: appointment.customers.email,
        customerName: appointment.customers.name,
        action: action,
        appointmentDate: appointment.appointment_date,
        service: appointment.services.name,
        business: appointment.businesses.name
      });

      // Simulate sending notification
      // In a real implementation, you would:
      // 1. Send email using Nodemailer, SendGrid, etc.
      // 2. Send SMS using Twilio, etc.
      
      return res.status(200).json({ 
        success: true, 
        message: `Notification sent for ${action} appointment` 
      });

    } catch (error) {
      console.error('Notification error:', error);
      return res.status(500).json({ error: 'Failed to send notification' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};