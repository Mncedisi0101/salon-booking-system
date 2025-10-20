const supabase = require('../supabase');
const nodemailer = require('nodemailer');

// Configure Nodemailer
let emailTransporter;
let emailConfigured = false;

// Check if Twilio is available
let twilioClient;
let twilioConfigured = false;

try {
  // Create Nodemailer transporter
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    // Verify connection configuration
    emailTransporter.verify(function(error, success) {
      if (error) {
        console.error('Nodemailer configuration error:', error);
      } else {
        emailConfigured = true;
        console.log('Nodemailer email service initialized and ready');
      }
    });
  } else {
    console.warn('SMTP configuration not complete - email notifications disabled');
    console.log('Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  }
} catch (error) {
  console.warn('Nodemailer package not available - email notifications disabled');
}

try {
  const twilio = require('twilio');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    twilioConfigured = true;
    console.log('Twilio SMS service initialized');
  } else {
    console.warn('Twilio credentials not fully configured - SMS notifications disabled');
    console.log('Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
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

async function sendAppointmentSMS(appointment, action) {
  try {
    const customerPhone = appointment.customers?.phone;
    const customerName = appointment.customers?.name || 'Valued Customer';
    const businessName = appointment.businesses?.name || 'Our Salon';
    
    console.log('Checking SMS requirements:', { 
      customerPhone, 
      hasTwilio: twilioConfigured,
      twilioSid: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Not set',
      twilioAuth: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Not set',
      twilioNumber: process.env.TWILIO_PHONE_NUMBER ? 'Set' : 'Not set'
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

async function sendAppointmentEmail(appointment, action) {
  try {
    const customerEmail = appointment.customers?.email;
    const customerName = appointment.customers?.name || 'Valued Customer';
    const businessName = appointment.businesses?.name || 'Our Salon';
    const businessEmail = appointment.businesses?.email || process.env.SMTP_USER || 'noreply@salonbookingsystem.com';
    
    console.log('Checking email requirements:', { 
      customerEmail, 
      hasNodemailer: emailConfigured,
      smtpHost: process.env.SMTP_HOST ? 'Set' : 'Not set',
      smtpUser: process.env.SMTP_USER ? 'Set' : 'Not set'
    });

    // Check if we can send email
    if (!customerEmail) {
      return { sent: false, reason: 'No customer email available' };
    }

    if (!emailConfigured || !emailTransporter) {
      return { sent: false, reason: 'Email service not configured. Check SMTP configuration.' };
    }

    // Generate email content
    const emailTemplate = generateEmailTemplate(appointment, action);
    
    console.log('Sending email via Nodemailer to:', customerEmail);
    
    // Prepare email message
    const mailOptions = {
      from: {
        name: businessName,
        address: businessEmail
      },
      to: customerEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    };

    // Send email using Nodemailer
    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log('Email sent successfully via Nodemailer. Message ID:', info.messageId);
    return { 
      sent: true, 
      messageId: info.messageId,
      response: info.response,
      message: 'Email sent via Nodemailer'
    };

  } catch (error) {
    console.error('Error in sendAppointmentEmail with Nodemailer:', error);
    
    let errorMessage = error.message;
    if (error.responseCode) {
      errorMessage = `SMTP error ${error.responseCode}: ${error.message}`;
    }
    
    return { 
      sent: false, 
      reason: 'Nodemailer error: ' + errorMessage 
    };
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
    },
    completed: {
      subject: `Thank You for Your Visit - ${businessName}`,
      html: generateCompletedEmailHTML(baseData),
      text: generateCompletedEmailText(baseData)
    }
  };

  return templates[action] || templates.confirmed;
}

function generateConfirmedEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8a4fff; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8a4fff; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; padding-top: 20px; border-top: 1px solid #eee; }
        .button { display: inline-block; background: #8a4fff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Confirmed! ✅</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${data.customerName}</strong>,</p>
          <p>Your appointment has been confirmed! We look forward to seeing you.</p>
          
          <div class="appointment-details">
            <h3 style="margin-top: 0; color: #8a4fff;">Appointment Details</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Time:</strong> ${data.formattedTime}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
            ${data.businessPhone ? `<p><strong>Contact:</strong> ${data.businessPhone}</p>` : ''}
          </div>
          
          <p><strong>Location:</strong><br>${data.businessName}<br>${data.businessAddress || 'Please contact us for address details'}</p>
          
          <div style="background: #e8f4ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📅 Reminder:</strong> Please arrive 5-10 minutes before your appointment time.</p>
          </div>
          
          <p>If you need to reschedule or have any questions, please contact us.</p>
        </div>
        <div class="footer">
          <p>Thank you for choosing ${data.businessName}!</p>
          <p><small>This is an automated message, please do not reply to this email.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateConfirmedEmailText(data) {
  return `
APPOINTMENT CONFIRMED

Hello ${data.customerName},

Your appointment has been confirmed! We look forward to seeing you.

APPOINTMENT DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}
Stylist: ${data.stylistName}
${data.businessPhone ? `Contact: ${data.businessPhone}` : ''}

LOCATION:
${data.businessName}
${data.businessAddress || 'Please contact us for address details'}

REMINDER: Please arrive 5-10 minutes before your appointment time.

If you need to reschedule or have any questions, please contact us.

Thank you for choosing ${data.businessName}!

This is an automated message, please do not reply to this email.
  `;
}

function generateCancelledEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff4757; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff4757; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; padding-top: 20px; border-top: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Cancelled ❌</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${data.customerName}</strong>,</p>
          <p>Your appointment has been cancelled as requested.</p>
          
          <div class="appointment-details">
            <h3 style="margin-top: 0; color: #ff4757;">Cancelled Appointment</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Time:</strong> ${data.formattedTime}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
          </div>
          
          <p>We hope to see you again soon! You can book a new appointment anytime.</p>
          
          <p><strong>Business Information:</strong><br>
          ${data.businessName}<br>
          ${data.businessPhone ? `Phone: ${data.businessPhone}<br>` : ''}
          ${data.businessAddress || ''}</p>
        </div>
        <div class="footer">
          <p>Thank you for considering ${data.businessName}!</p>
          <p><small>This is an automated message, please do not reply to this email.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCancelledEmailText(data) {
  return `
APPOINTMENT CANCELLED

Hello ${data.customerName},

Your appointment has been cancelled as requested.

CANCELLED APPOINTMENT:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}
Stylist: ${data.stylistName}

We hope to see you again soon! You can book a new appointment anytime.

BUSINESS INFORMATION:
${data.businessName}
${data.businessPhone ? `Phone: ${data.businessPhone}` : ''}
${data.businessAddress || ''}

Thank you for considering ${data.businessName}!

This is an automated message, please do not reply to this email.
  `;
}

function generateCompletedEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2ed573; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2ed573; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; padding-top: 20px; border-top: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You for Your Visit! ✨</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${data.customerName}</strong>,</p>
          <p>Thank you for visiting us! We hope you enjoyed your experience at ${data.businessName}.</p>
          
          <div class="appointment-details">
            <h3 style="margin-top: 0; color: #2ed573;">Service Details</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
          </div>
          
          <p>We appreciate your business and look forward to serving you again!</p>
          
          <p>Feel free to book your next appointment with us anytime.</p>
        </div>
        <div class="footer">
          <p>We hope to see you again soon at ${data.businessName}!</p>
          <p><small>This is an automated message, please do not reply to this email.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCompletedEmailText(data) {
  return `
THANK YOU FOR YOUR VISIT

Hello ${data.customerName},

Thank you for visiting us! We hope you enjoyed your experience at ${data.businessName}.

SERVICE DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Stylist: ${data.stylistName}

We appreciate your business and look forward to serving you again!

Feel free to book your next appointment with us anytime.

We hope to see you again soon at ${data.businessName}!

This is an automated message, please do not reply to this email.
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