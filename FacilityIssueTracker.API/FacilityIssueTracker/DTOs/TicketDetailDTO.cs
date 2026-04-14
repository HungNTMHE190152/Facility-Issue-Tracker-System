namespace FacilityIssueTracker.DTOs;

public class TicketDetailDTO
{
    public int TicketId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public int? Priority { get; set; }
    public string Status { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? ImageBefore { get; set; }
    public string? ImageAfter { get; set; }
    public int ReporterId { get; set; }
    public string ReporterName { get; set; } = string.Empty;
    public int? TechnicianId { get; set; }
    public string? TechnicianName { get; set; }
    public DateTime? DueAt { get; set; }
    public string SlaAlertLevel { get; set; } = "NONE";
    public int? SlaMinutesRemaining { get; set; }
}
