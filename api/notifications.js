const supabase = require('../supabase');

// Check if Resend is available
let Resend;
let resend;
try {
  Resend = require('resend');
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('Resend email service initialized');
  } else {
    console.warn('RESEND_API_KEY not configured - email notifications disabled');
  }
} catch (error) {
  console.warn('Resend package not available - email notifications disabled');
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only handle POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Notification request received');
    
    // Parse request body
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    const { appointmentId, action, businessId } = body;

    console.log('Processing notification:', { appointmentId, action, businessId });

    // Validate required fields
    if (!appointmentId || !action) {
      return res.status(400).json({ 
        error: 'appointmentId and action are required',
        received: { appointmentId, action, businessId }
      });
    }

    // Get appointment details
    console.log('Fetching appointment details for:', appointmentId);
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (name, email, phone),
        services (name, description, price, duration),
        businesses (name, email, phone, address),
        stylists (name)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError) {
      console.error('Appointment not found:', appointmentError);
      return res.status(404).json({ 
        error: 'Appointment not found: ' + appointmentError.message,
        appointmentId: appointmentId
      });
    }

    if (!appointment) {
      console.error('No appointment data returned');
      return res.status(404).json({ 
        error: 'Appointment not found',
        appointmentId: appointmentId
      });
    }

    console.log('Appointment found:', appointment.id);

    // Process email notification
    const emailResult = await sendAppointmentEmail(appointment, action);
    console.log('Email result:', emailResult);
    
    // Process in-app notification
    const notificationResult = await createInAppNotification(appointment, action);
    console.log('Notification result:', notificationResult);

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Notification processed successfully',
      email: emailResult,
      notification: notificationResult
    });

  } catch (error) {
    console.error('Unexpected error in notifications API:', error);
    return res.status(500).json({ 
      error: 'Internal server error: ' + error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
};

async function sendAppointmentEmail(appointment, action) {
  try {
    const customerEmail = appointment.customers?.email;
    const customerName = appointment.customers?.name || 'Valued Customer';
    
    console.log('Checking email requirements:', { customerEmail, hasResend: !!resend });

    // Check if we can send email
    if (!customerEmail) {
      return { sent: false, reason: 'No customer email available' };
    }

    if (!resend) {
      return { sent: false, reason: 'Email service not configured' };
    }

    // Generate email content
    const emailTemplate = generateEmailTemplate(appointment, action);
    
    console.log('Sending email to:', customerEmail);
    
    // Send email
    const { data, error } = await resend.emails.send({
      from: 'Salon Booking <onboarding@resend.dev>',
      to: customerEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { sent: false, reason: 'Email service error: ' + error.message };
    }

    console.log('Email sent successfully');
    return { sent: true, data: data };

  } catch (error) {
    console.error('Error in sendAppointmentEmail:', error);
    return { sent: false, reason: 'Unexpected error: ' + error.message };
  }
}

function generateEmailTemplate(appointment, action) {
  const customerName = appointment.customers?.name || 'Valued Customer';
  const businessName = appointment.businesses?.name || 'Our Salon';
  const serviceName = appointment.services?.name || appointment.service;
  const stylistName = appointment.stylists?.name || 'Not assigned';
  
  // Format date safely
  let formattedDate = 'Unknown date';
  let formattedTime = 'Unknown time';
  
  try {
    const appointmentDate = new Date(appointment.appointment_date);
    formattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (dateError) {
    console.error('Error formatting date:', dateError);
  }

  const baseData = {
    customerName,
    businessName,
    serviceName,
    stylistName,
    formattedDate,
    formattedTime,
    businessPhone: appointment.businesses?.phone,
    businessAddress: appointment.businesses?.address,
    appointmentId: appointment.id
  };

  const templates = {
    confirmed: {
      subject: `Appointment Confirmed - ${businessName}`,
      html: generateConfirmedEmailHTML(baseData),
      text: generateConfirmedEmailText(baseData)
    },
    cancelled: {
      subject: `Appointment Cancelled - ${businessName}`,
      html: generateCancelledEmailHTML(baseData),
      text: generateCancelledEmailText(baseData)
    }
  };

  return templates[action] || templates.confirmed;
}

function generateConfirmedEmailHTML(data) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #8a4fff; color: white; padding: 20px; text-align: center;">
        <h1>Appointment Confirmed!</h1>
      </div>
      <div style="background: #f9f9f9; padding: 20px;">
        <p>Hello <strong>${data.customerName}</strong>,</p>
        <p>Your appointment has been confirmed! We look forward to seeing you.</p>
        
        <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3>Appointment Details:</h3>
          <p><strong>Service:</strong> ${data.serviceName}</p>
          <p><strong>Date:</strong> ${data.formattedDate}</p>
          <p><strong>Time:</strong> ${data.formattedTime}</p>
          <p><strong>Stylist:</strong> ${data.stylistName}</p>
        </div>
        
        <p><em>Please arrive 5-10 minutes before your appointment time.</em></p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Thank you for choosing ${data.businessName}!</p>
      </div>
    </div>
  `;
}

function generateConfirmedEmailText(data) {
  return `
Appointment Confirmed!

Hello ${data.customerName},

Your appointment has been confirmed! We look forward to seeing you.

APPOINTMENT DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}
Stylist: ${data.stylistName}

Please arrive 5-10 minutes before your appointment time.

Thank you for choosing ${data.businessName}!
  `;
}

function generateCancelledEmailHTML(data) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ff4757; color: white; padding: 20px; text-align: center;">
        <h1>Appointment Cancelled</h1>
      </div>
      <div style="background: #f9f9f9; padding: 20px;">
        <p>Hello <strong>${data.customerName}</strong>,</p>
        <p>Your appointment has been cancelled.</p>
        
        <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3>Cancelled Appointment:</h3>
          <p><strong>Service:</strong> ${data.serviceName}</p>
          <p><strong>Date:</strong> ${data.formattedDate}</p>
          <p><strong>Time:</strong> ${data.formattedTime}</p>
        </div>
        
        <p>We hope to see you again soon!</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Thank you for considering ${data.businessName}!</p>
      </div>
    </div>
  `;
}

function generateCancelledEmailText(data) {
  return `
Appointment Cancelled

Hello ${data.customerName},

Your appointment has been cancelled.

CANCELLED APPOINTMENT:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}

We hope to see you again soon!

Thank you for considering ${data.businessName}!
  `;
}

async function createInAppNotification(appointment, action) {
  try {
    console.log('Creating in-app notification for user:', appointment.user_id);
    
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: appointment.user_id,
        user_type: 'customer',
        title: getNotificationTitle(action),
        message: getNotificationMessage(appointment, action),
        type: action,
        related_id: appointment.id,
        related_type: 'appointment',
        is_read: false
      }]);

    if (error) {
      console.error('Error creating notification:', error);
      return { created: false, reason: error.message };
    }
    
    console.log('In-app notification created successfully');
    return { created: true };
  } catch (error) {
    console.error('Unexpected error creating notification:', error);
    return { created: false, reason: error.message };
  }
}

function getNotificationTitle(action) {
  const titles = {
    confirmed: 'Appointment Confirmed',
    cancelled: 'Appointment Cancelled'
  };
  return titles[action] || 'Appointment Update';
}

function getNotificationMessage(appointment, action) {
  const serviceName = appointment.services?.name || appointment.service;
  
  let date = 'Unknown date';
  try {
    date = new Date(appointment.appointment_date).toLocaleDateString();
  } catch (error) {
    console.error('Error formatting notification date:', error);
  }
  
  const messages = {
    confirmed: `Your ${serviceName} appointment on ${date} has been confirmed`,
    cancelled: `Your ${serviceName} appointment on ${date} has been cancelled`
  };
  
  return messages[action] || `Your appointment has been ${action}`;
}