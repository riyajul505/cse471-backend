import Notification from '../models/notificationModels.js';

export const createNotification = async (notificationData) => {
  try {
    // Support both old format (for backward compatibility) and new format
    let notification;
    
    if (typeof notificationData === 'string') {
      // Old format: createNotification(userId, type, message, link)
      const [userId, type, message, link] = arguments;
      notification = new Notification({
        userId,
        type,
        message,
        link
      });
    } else {
      // New format: createNotification({ userId, type, message, data, link })
      notification = new Notification(notificationData);
    }
    
    await notification.save();
    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};

export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(notifications.map(notif => ({
      id: notif._id,
      type: notif.type,
      message: notif.message,
      data: notif.data,
      link: notif.link,
      read: notif.read,
      createdAt: notif.createdAt
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const unreadCount = await Notification.countDocuments({ 
      userId, 
      read: false 
    });
    
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 