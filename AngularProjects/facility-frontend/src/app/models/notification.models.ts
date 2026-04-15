export interface Notification {
  notificationId: number;
  userId: number;
  ticketId?: number;
  message: string;
  type: string;
  severity: string;
  source?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}
