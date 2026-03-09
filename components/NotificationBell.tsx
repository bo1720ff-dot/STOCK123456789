import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { notificationService } from '../services/supabase';
import { AppNotification, User } from '../types';

interface NotificationBellProps {
  currentUser: User;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!currentUser.id) return;
    try {
      const notifs = await notificationService.getForUser(currentUser.id);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser.id) return;
    try {
      await notificationService.markAllAsRead(currentUser.id);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile Overlay Backdrop (optional, but good for UX) */}
          <div className="fixed inset-0 bg-black/20 z-[90] sm:hidden" onClick={() => setIsOpen(false)} />
          
          <div className="fixed inset-x-0 bottom-0 top-16 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-full sm:w-80 bg-white sm:rounded-xl shadow-2xl sm:shadow-xl border-t sm:border border-gray-100 z-[100] flex flex-col sm:block overflow-hidden rounded-t-2xl sm:rounded-t-xl transition-transform transform duration-300 ease-in-out">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 text-lg sm:text-base">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center bg-emerald-50 px-2 py-1 rounded"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Mark all read
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full sm:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto sm:max-h-96">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center justify-center h-full">
                  <Bell className="w-8 h-8 text-gray-300 mb-2" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 pb-safe">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.is_read ? 'bg-blue-50/50' : ''}`}
                      onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {notification.message}
                        </p>
                        {!notification.is_read && (
                          <span className="w-2.5 h-2.5 bg-blue-600 rounded-full mt-1 flex-shrink-0 ml-3 shadow-sm"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 font-medium">
                        {new Date(notification.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
