const supabase = require('../supabase');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { type, email, password, name, phone, businessId, address, services } = req.body;

      console.log('Auth request received:', { type, email });

      if (type === 'business_register') {
        // Business Registration
        if (!email || !password || !name) {
          return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
          .from('businesses')
          .insert([{ 
            name, 
            email, 
            phone, 
            password: hashedPassword,
            address: address,
            services: services 
          }])
          .select();
        
        if (error) {
          console.error('Business registration error:', error);
          return res.status(400).json({ error: error.message });
        }
        
        if (!data || data.length === 0) {
          return res.status(400).json({ error: 'Failed to create business account' });
        }
        
        return res.status(200).json({ 
          business: data[0], 
          success: true,
          type: 'business'
        });

      } else if (type === 'business_login') {
        // Business Login
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        console.log('Business login attempt for:', email);
        
        const { data: business, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('email', email)
          .single();

        if (error) {
          console.error('Business login query error:', error);
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        if (!business) {
          console.error('Business not found for email:', email);
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        console.log('Business found, checking password...');
        
        const validPassword = await bcrypt.compare(password, business.password);
        if (!validPassword) {
          console.error('Invalid password for business:', email);
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        console.log('Business login successful for:', email);
        
        return res.status(200).json({
          user: business,
          type: 'business',
          success: true
        });

      } else if (type === 'customer_register') {
        // Customer Registration
        if (!businessId) {
          return res.status(400).json({ error: 'Business ID is required' });
        }

        if (!email || !password || !name) {
          return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
          .from('customers')
          .insert([{ 
            business_id: businessId,
            name, 
            email, 
            phone,
            password: hashedPassword
          }])
          .select();
        
        if (error) {
          console.error('Customer registration error:', error);
          return res.status(400).json({ error: error.message });
        }
        
        if (!data || data.length === 0) {
          return res.status(400).json({ error: 'Failed to create customer account' });
        }
        
        return res.status(200).json({ 
          customer: data[0], 
          success: true,
          type: 'customer'
        });

      } else if (type === 'customer_login') {
        // Customer Login
        if (!businessId) {
          return res.status(400).json({ error: 'Business ID is required' });
        }

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data: customer, error } = await supabase
          .from('customers')
          .select('*')
          .eq('email', email)
          .eq('business_id', businessId)
          .single();

        if (error || !customer) {
          console.error('Customer login error:', error);
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, customer.password);
        if (!validPassword) {
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        return res.status(200).json({
          user: customer,
          type: 'customer',
          success: true
        });

      } else {
        return res.status(400).json({ error: 'Invalid authentication type' });
      }

    } catch (error) {
      console.error('Auth server error:', error);
      return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};