const supabase = require('../supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); // Added DELETE
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        // Create a new service
        const { businessId, name, description, price } = req.body; // Extract data from req.body

        if (!businessId || !name || !description || !price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('services')
            .insert([{ business_id: businessId, name, description, price }])
            .select();

        if (error) {
            console.error('Error creating service:', error);
            return res.status(500).json({ error: 'Failed to create service', details: error.message });
        }

        return res.status(201).json({ message: 'Service added successfully', data: data }); // Respond with the created service
    }

    if (req.method === 'GET') {
        // Get all services for a business
        const businessId = req.query.businessId; // Assuming you pass businessId as a query parameter

        if (!businessId) {
            return res.status(400).json({ error: 'Missing businessId parameter' });
        }

        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('business_id', businessId);

        if (error) {
            console.error('Error fetching services:', error);
            return res.status(500).json({ error: 'Failed to fetch services', details: error.message });
        }

        return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
        // Remove a service
        const serviceId = req.query.id; // Assuming you pass the service ID as a query parameter

        if (!serviceId) {
            return res.status(400).json({ error: 'Missing service ID' });
        }

        const { data, error } = await supabase
            .from('services')
            .delete()
            .eq('id', serviceId); // Assuming your service table has an 'id' column

        if (error) {
            console.error('Error deleting service:', error);
            return res.status(500).json({ error: 'Failed to delete service', details: error.message });
        }

        return res.status(200).json({ message: 'Service removed successfully' });
    }

    // If no method matches
    return res.status(405).json({ error: 'Method Not Allowed' });
};