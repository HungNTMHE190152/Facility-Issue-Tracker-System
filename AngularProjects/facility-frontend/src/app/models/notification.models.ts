export interface Notification {
  notificationId: number;
  userId: number;
  ticketId?: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}
