using System;
using System.Collections.Generic;

namespace FacilityIssueTracker.Models;

public partial class Ticket
{
    public int TicketId { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string Location { get; set; } = null!;

    public int? Priority { get; set; }

    public string? Status { get; set; }

    public string? ImageBefore { get; set; }

    public string? ImageAfter { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? AssignedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime? ClosedAt { get; set; }

    public int ReporterId { get; set; }

    public int CategoryId { get; set; }

    public int? TechnicianId { get; set; }

    public int? DispatcherId { get; set; }

    public virtual Category Category { get; set; } = null!;

    public virtual User? Dispatcher { get; set; }

    public virtual User Reporter { get; set; } = null!;

    public virtual Review? Review { get; set; }

    public virtual User? Technician { get; set; }

    public virtual ICollection<TicketHistory> TicketHistories { get; set; } = new List<TicketHistory>();

    public virtual ICollection<TicketSupply> TicketSupplies { get; set; } = new List<TicketSupply>();
}
