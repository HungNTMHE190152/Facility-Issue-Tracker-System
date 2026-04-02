export interface CategoryOption {
  categoryId: number;
  categoryName: string;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  location: string;
  priority?: number | null;
  categoryId: number;
  imageBefore?: string | null;
}

export interface UpdateTicketRequest {
  title: string;
  description: string;
  location: string;
  priority?: number | null;
  categoryId: number;
  imageBefore?: string | null;
}

export interface MyTicketItem {
  ticketId: number;
  title: string;
  description: string;
  location: string;
  priority?: number | null;
  status: string;
  categoryId: number;
  categoryName: string;
  createdAt?: string | null;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  imageBefore?: string | null;
  imageAfter?: string | null;
  technicianName?: string | null;
  technicianId?: number | null;
  reporterName?: string | null;
}

export interface MyTicketFilters {
  search?: string;
  status?: string;
  priority?: number | null;
  categoryId?: number | null;
}

export interface ResolveTicketRequest {
  imageAfter?: string | null;
}

export interface TicketHistory {
  historyId: number;
  ticketId: number;
  oldStatus: string;
  newStatus: string;
  changedByName: string;
  changedAt: string;
}
