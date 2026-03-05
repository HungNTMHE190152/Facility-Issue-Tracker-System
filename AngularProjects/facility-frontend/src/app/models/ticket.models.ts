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
}

export interface MyTicketFilters {
  search?: string;
  status?: string;
  priority?: number | null;
  categoryId?: number | null;
}
