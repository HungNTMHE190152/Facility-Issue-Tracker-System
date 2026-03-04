using System;
using System.Collections.Generic;

namespace FacilityIssueTracker.Models;

public partial class TicketHistory
{
    public int HistoryId { get; set; }

    public int TicketId { get; set; }

    public string? OldStatus { get; set; }

    public string? NewStatus { get; set; }

    public int ChangedBy { get; set; }

    public DateTime? ChangedAt { get; set; }

    public virtual User ChangedByNavigation { get; set; } = null!;

    public virtual Ticket Ticket { get; set; } = null!;
}
