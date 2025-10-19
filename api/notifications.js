const supabase = require('../supabase');
const { Resend } = require('resend');

// Initialize Resend only if API key exists
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY not configured - email notifications will be disabled');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { appointmentId, action, businessId } = req.body;

      console.log('Notification request received:', { appointmentId, action, businessId });

      if (!appointmentId || !action) {
        return res.status(400).json({ error: 'appointmentId and action are required' });
      }

      // Get appointment details with business email
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
        return res.status(400).json({ error: 'Appointment not found: ' + appointmentError.message });
      }

      console.log('Appointment found:', appointment.id);

      // Send email notification
      const emailResult = await sendAppointmentEmail(appointment, action);
      
      // Create in-app notification
      const notificationResult = await createInAppNotification(appointment, action);

      return res.status(200).json({ 
        success: true, 
        message: `Notification processed successfully`,
        emailSent: emailResult.success || false,
        emailError: emailResult.error,
        notificationCreated: notificationResult.success || false,
        notificationError: notificationResult.error
      });

    } catch (error) {
      console.error('Notification processing error:', error);
      return res.status(500).json({ error: 'Failed to process notification: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function sendAppointmentEmail(appointment, action) {
  try {
    const customerEmail = appointment.customers?.email;
    const customerName = appointment.customers?.name || 'Valued Customer';
    const businessName = appointment.businesses?.name || 'Salon';
    
    console.log('Attempting to send email to:', customerEmail);

    // Check if customer email exists
    if (!customerEmail) {
      console.warn('Customer email not found, skipping email notification');
      return { success: false, error: 'No customer email available', skipped: true };
    }

    // Check if Resend is configured
    if (!resend) {
      console.warn('Resend email service not configured, skipping email notification');
      return { success: false, error: 'Email service not configured', skipped: true };
    }

    const emailTemplate = generateEmailTemplate(appointment, action);
    
    console.log('Sending email via Resend...');
    
    const { data, error } = await resend.emails.send({
      from: 'Salon Booking <onboarding@resend.dev>', // Use default Resend domain
      to: customerEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (error) {
      console.error('Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully to:', customerEmail);
    return { success: true, data };

  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}

// Generate email content based on action
function generateEmailTemplate(appointment, action) {
  const customerName = appointment.customers?.name || 'Valued Customer';
  const businessName = appointment.businesses?.name || 'Our Salon';
  const serviceName = appointment.services?.name || appointment.service;
  const stylistName = appointment.stylists?.name || 'Not assigned';
  const appointmentDate = new Date(appointment.appointment_date);
  const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

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
      subject: `✅ Appointment Confirmed - ${businessName}`,
      html: generateConfirmedEmailHTML(baseData),
      text: generateConfirmedEmailText(baseData)
    },
    cancelled: {
      subject: `❌ Appointment Cancelled - ${businessName}`,
      html: generateCancelledEmailHTML(baseData),
      text: generateCancelledEmailText(baseData)
    },
    reminder: {
      subject: `⏰ Appointment Reminder - ${businessName}`,
      html: generateReminderEmailHTML(baseData),
      text: generateReminderEmailText(baseData)
    },
    completed: {
      subject: `✨ Thank You for Visiting ${businessName}`,
      html: generateCompletedEmailHTML(baseData),
      text: generateCompletedEmailText(baseData)
    }
  };

  return templates[action] || templates.confirmed;
}

// Email template generators (keep your existing templates)
function generateConfirmedEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8a4fff; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
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
            <h3>Appointment Details:</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Time:</strong> ${data.formattedTime}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
          </div>
          
          <p><strong>Business Information:</strong></p>
          <p>${data.businessName}</p>
          ${data.businessPhone ? `<p>📞 ${data.businessPhone}</p>` : ''}
          ${data.businessAddress ? `<p>📍 ${data.businessAddress}</p>` : ''}
          
          <p><em>Please arrive 5-10 minutes before your appointment time.</em></p>
        </div>
        <div class="footer">
          <p>Thank you for choosing ${data.businessName}!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateConfirmedEmailText(data) {
  return `
Appointment Confirmed! ✅

Hello ${data.customerName},

Your appointment has been confirmed! We look forward to seeing you.

APPOINTMENT DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}
Stylist: ${data.stylistName}

BUSINESS INFORMATION:
${data.businessName}
${data.businessPhone ? `Phone: ${data.businessPhone}` : ''}
${data.businessAddress ? `Address: ${data.businessAddress}` : ''}

Please arrive 5-10 minutes before your appointment time.

Thank you for choosing ${data.businessName}!
  `;
}

function generateCancelledEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff4757; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
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
            <h3>Cancelled Appointment Details:</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Time:</strong> ${data.formattedTime}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
          </div>
          
          <p>We hope to see you again soon!</p>
          
          <p><strong>Business Information:</strong></p>
          <p>${data.businessName}</p>
          ${data.businessPhone ? `<p>📞 ${data.businessPhone}</p>` : ''}
          ${data.businessAddress ? `<p>📍 ${data.businessAddress}</p>` : ''}
        </div>
        <div class="footer">
          <p>Thank you for considering ${data.businessName}!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCancelledEmailText(data) {
  return `
Appointment Cancelled ❌

Hello ${data.customerName},

Your appointment has been cancelled as requested.

CANCELLED APPOINTMENT DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}
Stylist: ${data.stylistName}

We hope to see you again soon!

BUSINESS INFORMATION:
${data.businessName}
${data.businessPhone ? `Phone: ${data.businessPhone}` : ''}
${data.businessAddress ? `Address: ${data.businessAddress}` : ''}

Thank you for considering ${data.businessName}!
  `;
}

function generateReminderEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffa502; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Reminder ⏰</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${data.customerName}</strong>,</p>
          <p>This is a friendly reminder about your upcoming appointment.</p>
          
          <div class="appointment-details">
            <h3>Appointment Details:</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Time:</strong> ${data.formattedTime}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
          </div>
          
          <p><em>Please arrive 5-10 minutes before your appointment time.</em></p>
          
          <p><strong>Business Information:</strong></p>
          <p>${data.businessName}</p>
          ${data.businessPhone ? `<p>📞 ${data.businessPhone}</p>` : ''}
          ${data.businessAddress ? `<p>📍 ${data.businessAddress}</p>` : ''}
        </div>
        <div class="footer">
          <p>We look forward to seeing you!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateReminderEmailText(data) {
  return `
Appointment Reminder ⏰

Hello ${data.customerName},

This is a friendly reminder about your upcoming appointment.

APPOINTMENT DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Time: ${data.formattedTime}
Stylist: ${data.stylistName}

Please arrive 5-10 minutes before your appointment time.

BUSINESS INFORMATION:
${data.businessName}
${data.businessPhone ? `Phone: ${data.businessPhone}` : ''}
${data.businessAddress ? `Address: ${data.businessAddress}` : ''}

We look forward to seeing you!
  `;
}

function generateCompletedEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2ed573; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .appointment-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You for Your Visit! ✨</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${data.customerName}</strong>,</p>
          <p>Thank you for visiting us! We hope you enjoyed your experience.</p>
          
          <div class="appointment-details">
            <h3>Service Details:</h3>
            <p><strong>Service:</strong> ${data.serviceName}</p>
            <p><strong>Date:</strong> ${data.formattedDate}</p>
            <p><strong>Stylist:</strong> ${data.stylistName}</p>
          </div>
          
          <p>We appreciate your business and look forward to serving you again!</p>
          
          <p><strong>Business Information:</strong></p>
          <p>${data.businessName}</p>
          ${data.businessPhone ? `<p>📞 ${data.businessPhone}</p>` : ''}
          ${data.businessAddress ? `<p>📍 ${data.businessAddress}</p>` : ''}
        </div>
        <div class="footer">
          <p>We hope to see you again soon!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCompletedEmailText(data) {
  return `
Thank You for Your Visit! ✨

Hello ${data.customerName},

Thank you for visiting us! We hope you enjoyed your experience.

SERVICE DETAILS:
Service: ${data.serviceName}
Date: ${data.formattedDate}
Stylist: ${data.stylistName}

We appreciate your business and look forward to serving you again!

BUSINESS INFORMATION:
${data.businessName}
${data.businessPhone ? `Phone: ${data.businessPhone}` : ''}
${data.businessAddress ? `Address: ${data.businessAddress}` : ''}

We hope to see you again soon!
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
      console.error('Failed to create in-app notification:', error);
      return { success: false, error: error.message };
    }
    
    console.log('In-app notification created successfully');
    return { success: true };
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    return { success: false, error: error.message };
  }
}

function getNotificationTitle(action) {
  const titles = {
    confirmed: 'Appointment Confirmed',
    cancelled: 'Appointment Cancelled',
    reminder: 'Appointment Reminder',
    completed: 'Appointment Completed'
  };
  return titles[action] || 'Appointment Update';
}

function getNotificationMessage(appointment, action) {
  const serviceName = appointment.services?.name || appointment.service;
  const date = new Date(appointment.appointment_date).toLocaleDateString();
  
  const messages = {
    confirmed: `Your ${serviceName} appointment on ${date} has been confirmed`,
    cancelled: `Your ${serviceName} appointment on ${date} has been cancelled`,
    reminder: `Reminder: Your ${serviceName} appointment is tomorrow`,
    completed: `Thank you for your ${serviceName} appointment!`
  };
  
  return messages[action] || `Your appointment status has been updated to ${action}`;
}