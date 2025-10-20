const supabase = require('../supabase');
const emailjs = require('@emailjs/nodejs');

// EmailJS configuration
let emailjsConfigured = false;

// Initialize EmailJS
try {
  if (process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY && process.env.EMAILJS_SERVICE_ID) {
    emailjs.init({
      publicKey: process.env.EMAILJS_PUBLIC_KEY,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
    });
    emailjsConfigured = true;
    console.log('EmailJS service initialized');
  } else {
    console.warn('EmailJS configuration not complete - email notifications disabled');
    console.log('Required: EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID');
  }
} catch (error) {
  console.warn('EmailJS package not available - email notifications disabled');
}

// Check if Twilio is available for SMS
let twilioClient;
let twilioConfigured = false;

try {
  const twilio = require('twilio');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    twilioConfigured = true;
    console.log('Twilio SMS service initialized');
  } else {
    console.warn('Twilio credentials not fully configured - SMS notifications disabled');
  }
} catch (error) {
  console.warn('Twilio package not available - SMS notifications disabled');
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

    // Get appointment details with business information
    console.log('Fetching appointment details for:', appointmentId);
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (name, email, phone),
        services (name, description, price, duration),
        businesses (name, email, phone, address, emailjs_template_id),
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

    // Process email notification using EmailJS
    const emailResult = await sendAppointmentEmailJS(appointment, action);
    console.log('EmailJS result:', emailResult);
    
    // Process SMS notification (only for confirmed appointments)
    const smsResult = action === 'confirmed' ? await sendAppointmentSMS(appointment, action) : { sent: false, reason: 'SMS only sent for confirmed appointments' };
    console.log('SMS result:', smsResult);
    
    // Process in-app notification
    const notificationResult = await createInAppNotification(appointment, action);
    console.log('Notification result:', notificationResult);

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Notification processed successfully',
      email: emailResult,
      sms: smsResult,
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

// EmailJS function for sending appointment emails
async function sendAppointmentEmailJS(appointment, action) {
  try {
    const customerEmail = appointment.customers?.email;
    const customerName = appointment.customers?.name || 'Valued Customer';
    const businessName = appointment.businesses?.name || 'Our Salon';
    const businessEmail = appointment.businesses?.email;
    
    console.log('Checking EmailJS requirements:', { 
      customerEmail, 
      hasEmailJS: emailjsConfigured,
      publicKey: process.env.EMAILJS_PUBLIC_KEY ? 'Set' : 'Not set',
      privateKey: process.env.EMAILJS_PRIVATE_KEY ? 'Set' : 'Not set',
      serviceId: process.env.EMAILJS_SERVICE_ID ? 'Set' : 'Not set'
    });

    // Check if we can send email
    if (!customerEmail) {
      return { sent: false, reason: 'No customer email available' };
    }

    if (!emailjsConfigured) {
      return { sent: false, reason: 'EmailJS service not configured. Check EmailJS configuration.' };
    }

    // Get business-specific template ID or use default
    const templateId = appointment.businesses?.emailjs_template_id || process.env.EMAILJS_TEMPLATE_ID;
    if (!templateId) {
      return { sent: false, reason: 'No EmailJS template ID configured' };
    }

    // Prepare email data for EmailJS
    const emailData = prepareEmailJSData(appointment, action);
    
    console.log('Sending email via EmailJS to:', customerEmail);
    console.log('Using template:', templateId);
    
    // Send email using EmailJS
    const result = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      templateId,
      emailData
    );

    console.log('Email sent successfully via EmailJS. Status:', result.status, 'Text:', result.text);
    return { 
      sent: true, 
      status: result.status,
      text: result.text,
      message: 'Email sent via EmailJS'
    };

  } catch (error) {
    console.error('Error in sendAppointmentEmailJS:', error);
    
    let errorMessage = error.message;
    if (error.status) {
      errorMessage = `EmailJS error ${error.status}: ${error.message}`;
    }
    
    return { 
      sent: false, 
      reason: 'EmailJS error: ' + errorMessage 
    };
  }
}

// Prepare data for EmailJS templates
function prepareEmailJSData(appointment, action) {
  const customerName = appointment.customers?.name || 'Valued Customer';
  const businessName = appointment.businesses?.name || 'Our Salon';
  const serviceName = appointment.services?.name || appointment.service;
  const stylistName = appointment.stylists?.name || 'Not assigned';
  
  // Format date safely
  let formattedDate = 'Unknown date';
  let formattedTime = 'Unknown time';
  let fullFormattedDate = 'Unknown date';
  
  try {
    const appointmentDate = new Date(appointment.appointment_date);
    formattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    fullFormattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (dateError) {
    console.error('Error formatting date:', dateError);
  }

  const baseData = {
    customer_name: customerName,
    business_name: businessName,
    service_name: serviceName,
    stylist_name: stylistName,
    appointment_date: formattedDate,
    appointment_time: formattedTime,
    full_appointment_date: fullFormattedDate,
    business_phone: appointment.businesses?.phone || '',
    business_address: appointment.businesses?.address || '',
    business_email: appointment.businesses?.email || '',
    appointment_id: appointment.id,
    action: action,
    to_email: appointment.customers?.email,
    customer_email: appointment.customers?.email,
    customer_phone: appointment.customers?.phone || ''
  };

  // Add action-specific fields
  if (action === 'confirmed') {
    baseData.email_subject = `Appointment Confirmed - ${businessName}`;
    baseData.status_message = 'confirmed';
    baseData.status_emoji = '✅';
  } else if (action === 'cancelled') {
    baseData.email_subject = `Appointment Cancelled - ${businessName}`;
    baseData.status_message = 'cancelled';
    baseData.status_emoji = '❌';
  } else if (action === 'completed') {
    baseData.email_subject = `Thank You for Your Visit - ${businessName}`;
    baseData.status_message = 'completed';
    baseData.status_emoji = '✨';
  }

  return baseData;
}

// SMS function remains the same as before
async function sendAppointmentSMS(appointment, action) {
  try {
    const customerPhone = appointment.customers?.phone;
    const customerName = appointment.customers?.name || 'Valued Customer';
    const businessName = appointment.businesses?.name || 'Our Salon';
    
    console.log('Checking SMS requirements:', { 
      customerPhone, 
      hasTwilio: twilioConfigured
    });

    // Check if we can send SMS
    if (!customerPhone) {
      return { sent: false, reason: 'No customer phone number available' };
    }

    if (!twilioConfigured || !twilioClient) {
      return { sent: false, reason: 'SMS service not configured. Check Twilio credentials.' };
    }

    // Validate phone number format (basic check)
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { sent: false, reason: 'Invalid phone number format' };
    }

    // Generate SMS content
    const smsTemplate = generateSMSTemplate(appointment, action);
    
    console.log('Sending SMS via Twilio to:', customerPhone);
    
    // Prepare Twilio message
    const message = await twilioClient.messages.create({
      body: smsTemplate,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: customerPhone
    });
    
    console.log('SMS sent successfully via Twilio. SID:', message.sid);
    return { 
      sent: true, 
      sid: message.sid,
      status: message.status,
      message: 'SMS sent via Twilio'
    };

  } catch (error) {
    console.error('Error in sendAppointmentSMS with Twilio:', error);
    
    let errorMessage = error.message;
    if (error.code) {
      errorMessage = `Twilio error ${error.code}: ${error.message}`;
    }
    
    return { 
      sent: false, 
      reason: 'Twilio error: ' + errorMessage 
    };
  }
}

function generateSMSTemplate(appointment, action) {
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
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (dateError) {
    console.error('Error formatting date:', dateError);
  }

  const businessPhone = appointment.businesses?.phone;

  if (action === 'confirmed') {
    return `Hi ${customerName}! Your ${serviceName} appointment at ${businessName} is confirmed for ${formattedDate} at ${formattedTime} with ${stylistName}. Please arrive 5-10 mins early. Reply STOP to unsub.${businessPhone ? ` Questions? Call ${businessPhone}` : ''}`;
  }
  
  if (action === 'cancelled') {
    return `Hi ${customerName}! Your ${serviceName} appointment at ${businessName} for ${formattedDate} has been cancelled. We hope to see you soon!${businessPhone ? ` Call ${businessPhone} to reschedule.` : ''}`;
  }

  return `Hi ${customerName}! Your appointment at ${businessName} has been ${action}.${businessPhone ? ` Call ${businessPhone} for details.` : ''}`;
}

// In-app notification function remains the same
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
    cancelled: 'Appointment Cancelled',
    completed: 'Appointment Completed'
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
    cancelled: `Your ${serviceName} appointment on ${date} has been cancelled`,
    completed: `Thank you for your ${serviceName} appointment! We hope to see you again soon.`
  };
  
  return messages[action] || `Your appointment has been ${action}`;
}