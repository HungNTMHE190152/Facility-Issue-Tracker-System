using System;

namespace FacilityIssueTracker.Models;

public class TicketHistoryDTO
{
    public int HistoryId { get; set; }
    public int TicketId { get; set; }
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public string? ChangedByName { get; set; }
    public DateTime? ChangedAt { get; set; }
}
