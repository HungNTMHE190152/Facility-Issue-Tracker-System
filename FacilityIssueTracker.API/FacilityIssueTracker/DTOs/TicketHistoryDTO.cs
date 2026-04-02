using System;

namespace FacilityIssueTracker.DTOs;

public class TicketHistoryDTO
{
    public int HistoryId { get; set; }
    public int TicketId { get; set; }
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public int ChangedBy { get; set; }
    public string ChangedByName { get; set; } = null!;
    public DateTime? ChangedAt { get; set; }
}

