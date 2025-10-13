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
      const { businessId, userId, serviceId, appointmentDate, notes, stylistId } = req.body;

      if (!businessId || !serviceId || !appointmentDate) {
        return res.status(400).json({ error: 'businessId, serviceId, and appointmentDate are required' });
      }

      // Validate customer
      let customerId = null;

      if (typeof userId === 'string' || typeof userId === 'number') {
        // userId is expected to be an existing customers.id
        customerId = userId;
        const { data: customerCheck, error: customerCheckError } = await supabase
          .from('customers')
          .select('id')
          .eq('id', customerId)
          .eq('business_id', businessId)
          .single();
        if (customerCheckError || !customerCheck) {
          return res.status(400).json({ error: 'Invalid customer for this business' });
        }
      } else if (userId && typeof userId === 'object') {
        // Backward compatibility: create customer from object info
        const { name, email, phone } = userId;
        if (!name || !email) {
          return res.status(400).json({ error: 'Missing customer name or email' });
        }
        const { data: customerUpsert, error: customerUpsertError } = await supabase
          .from('customers')
          .upsert({
            business_id: businessId,
            name,
            email,
            phone
          }, { onConflict: 'email,business_id' })
          .select()
          .single();
        if (customerUpsertError) {
          return res.status(400).json({ error: customerUpsertError.message });
        }
        customerId = customerUpsert.id;
      } else {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Get service details
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, name, price, duration')
        .eq('id', serviceId)
        .eq('business_id', businessId)
        .single();

      if (serviceError || !serviceData) {
        return res.status(400).json({ error: 'Invalid service selected' });
      }

      // Create the appointment
      const { data, error } = await supabase
        .from('appointments')
        .insert([{ 
          business_id: businessId, 
          user_id: customerId, 
          service_id: serviceData.id,
          service: serviceData.name, // Backward compatibility
          appointment_date: appointmentDate, 
          notes,
          stylist_id: stylistId || null
        }])
        .select(`
          *,
          customers (name, email, phone),
          services (name, description, price, duration),
          stylists (name, specialization)
        `);

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ appointment: data[0] });
    } catch (error) {
      console.error('Appointments POST error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
      try {
          const { businessId, dateRange, startDate, endDate, status, stylist, page = 1, limit = 10 } = req.query;
          
          if (!businessId) {
              return res.status(400).json({ error: 'Business ID is required' });
          }

          let query = supabase
              .from('appointments')
              .select(`
                  *,
                  customers (name, email, phone),
                  services (name, description, price, duration),
                  stylists (name, specialization)
              `, { count: 'exact' })
              .eq('business_id', businessId);

          // Date range filtering
          if (dateRange === 'today') {
              const today = new Date().toISOString().split('T')[0];
              query = query.gte('appointment_date', today + 'T00:00:00')
                          .lte('appointment_date', today + 'T23:59:59');
          } else if (dateRange === 'tomorrow') {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];
              query = query.gte('appointment_date', tomorrowStr + 'T00:00:00')
                          .lte('appointment_date', tomorrowStr + 'T23:59:59');
          } else if (dateRange === 'week') {
              const startOfWeek = new Date();
              startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(endOfWeek.getDate() + 6);
              
              query = query.gte('appointment_date', startOfWeek.toISOString())
                          .lte('appointment_date', endOfWeek.toISOString());
          } else if (dateRange === 'month') {
              const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
              const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
              
              query = query.gte('appointment_date', startOfMonth.toISOString())
                          .lte('appointment_date', endOfMonth.toISOString());
          } else if (startDate && endDate) {
              query = query.gte('appointment_date', startDate + 'T00:00:00')
                          .lte('appointment_date', endDate + 'T23:59:59');
          }

          // Status filtering
          if (status && status !== 'all') {
              query = query.eq('status', status);
          }

          // Stylist filtering
          if (stylist && stylist !== 'all') {
              query = query.eq('stylist_id', stylist);
          }

          // Pagination
          const from = (page - 1) * limit;
          const to = from + parseInt(limit) - 1;
          
          query = query.order('appointment_date', { ascending: true })
                      .range(from, to);

          const { data, error, count } = await query;

          if (error) {
              console.error('Supabase query error:', error);
              return res.status(400).json({ error: error.message });
          }

          // Transform the data to match frontend expectations
          const transformedAppointments = data.map(appointment => ({
            id: appointment.id,
            business_id: appointment.business_id,
            user_id: appointment.user_id,
            service_id: appointment.service_id,
            service: appointment.services?.name || appointment.service, // Fallback to old service field
            appointment_date: appointment.appointment_date,
            status: appointment.status,
            notes: appointment.notes,
            created_at: appointment.created_at,
            stylist_id: appointment.stylist_id,
            // Customer data
            customers: appointment.customers ? {
              id: appointment.customers.id,
              name: appointment.customers.name,
              email: appointment.customers.email,
              phone: appointment.customers.phone
            } : null,
            // Service data
            services: appointment.services ? {
              id: appointment.services.id,
              name: appointment.services.name,
              description: appointment.services.description,
              price: appointment.services.price,
              duration: appointment.services.duration
            } : null,
            // Stylist data
            stylists: appointment.stylists ? {
              id: appointment.stylists.id,
              name: appointment.stylists.name,
              specialization: appointment.stylists.specialization
            } : null,
            // Backward compatibility fields
            customer_name: appointment.customers?.name,
            customer_email: appointment.customers?.email,
            customer_phone: appointment.customers?.phone,
            service_name: appointment.services?.name,
            service_price: appointment.services?.price,
            service_duration: appointment.services?.duration,
            stylist_name: appointment.stylists?.name
          }));

          return res.status(200).json({ 
              appointments: transformedAppointments,
              totalCount: count,
              currentPage: parseInt(page),
              totalPages: Math.ceil(count / limit)
          });
      } catch (error) {
          console.error('Appointments GET error:', error);
          return res.status(500).json({ error: 'Internal server error' });
      }
  }

  if (req.method === 'PUT') {
    try {
      // Update appointment status
      const { id, status, stylist_id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const updateData = {};
      if (status) updateData.status = status;
      if (stylist_id !== undefined) updateData.stylist_id = stylist_id;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { data, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          customers (name, email, phone),
          services (name, description, price, duration),
          stylists (name, specialization)
        `);

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Transform the response data
      const transformedAppointment = data[0] ? {
        ...data[0],
        customers: data[0].customers ? {
          id: data[0].customers.id,
          name: data[0].customers.name,
          email: data[0].customers.email,
          phone: data[0].customers.phone
        } : null,
        services: data[0].services ? {
          id: data[0].services.id,
          name: data[0].services.name,
          description: data[0].services.description,
          price: data[0].services.price,
          duration: data[0].services.duration
        } : null,
        stylists: data[0].stylists ? {
          id: data[0].stylists.id,
          name: data[0].stylists.name,
          specialization: data[0].stylists.specialization
        } : null,
        customer_name: data[0].customers?.name,
        service_name: data[0].services?.name,
        stylist_name: data[0].stylists?.name
      } : null;

      return res.status(200).json({ appointment: transformedAppointment });
    } catch (error) {
      console.error('Appointments PUT error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};