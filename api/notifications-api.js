const supabase = require('../supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { userId, userType } = req.query;
      
      if (!userId || !userType) {
        return res.status(400).json({ error: 'userId and userType are required' });
      }

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('user_type', userType)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return res.status(200).json({ notifications });

    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { notificationId, isRead } = req.body;
      
      if (!notificationId) {
        return res.status(400).json({ error: 'notificationId is required' });
      }

      const { data: notification, error } = await supabase
        .from('notifications')
        .update({ 
          is_read: isRead,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({ notification });

    } catch (error) {
      console.error('Error updating notification:', error);
      return res.status(500).json({ error: 'Failed to update notification' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};