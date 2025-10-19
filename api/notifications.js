const supabase = require('../supabase');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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
        return res.status(400).json({ error: 'Appointment not found' });
      }

      // Send email using business's email as sender
      const emailResult = await sendAppointmentEmail(appointment, action);
      
      // Create in-app notification
      await createInAppNotification(appointment, action);

      return res.status(200).json({ 
        success: true, 
        message: `Notification sent successfully`,
        emailSent: emailResult,
        notificationCreated: true
      });

    } catch (error) {
      console.error('Notification error:', error);
      return res.status(500).json({ error: 'Failed to send notification' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function sendAppointmentEmail(appointment, action) {
  const customerEmail = appointment.customers?.email;
  const customerName = appointment.customers?.name || 'Valued Customer';
  const businessEmail = appointment.businesses?.email;
  const businessName = appointment.businesses?.name || 'Salon';
  
  if (!customerEmail) {
    throw new Error('Customer email not found');
  }

  if (!businessEmail) {
    throw new Error('Business email not found');
  }

  const emailTemplate = generateEmailTemplate(appointment, action);
  
  try {
    const { data, error } = await resend.emails.send({
      from: `${businessName} <onboarding@resend.dev>`, // Use test domain
      to: customerEmail,
      reply_to: businessEmail, // Replies go to business's email
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('Email sent successfully:', data);
    return data;

  } catch (error) {
    console.error('Resend error:', error);
    throw error;
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

// Email template generators
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
          <p>📞 ${data.businessPhone}</p>
          <p>📍 ${data.businessAddress}</p>
          
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
Phone: ${data.businessPhone}
Address: ${data.businessAddress}

Please arrive 5-10 minutes before your appointment time.

Thank you for choosing ${data.businessName}!
  `;
}

// Add similar functions for cancelled, reminder, completed emails...

async function createInAppNotification(appointment, action) {
  // Create notification in database for the customer to see when they login
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