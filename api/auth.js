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
      const { type, email, password, name, phone, businessId } = req.body;

      if (type === 'business_register') {
        // Business Registration
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
          .from('businesses')
          .insert([{ 
            name, 
            email, 
            phone, 
            password: hashedPassword,
            address: req.body.address,
            services: req.body.services 
          }])
          .select();
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        return res.status(200).json({ 
          business: data[0], 
          success: true,
          type: 'business'
        });

      } else if (type === 'business_login') {
        // Business Login
        const { data: business, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('email', email)
          .single();

        if (error || !business) {
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, business.password);
        if (!validPassword) {
          return res.status(400).json({ error: 'Invalid email or password' });
        }

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
          return res.status(400).json({ error: error.message });
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

        const { data: customer, error } = await supabase
          .from('customers')
          .select('*')
          .eq('email', email)
          .eq('business_id', businessId)
          .single();

        if (error || !customer) {
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
      console.error('Auth error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};