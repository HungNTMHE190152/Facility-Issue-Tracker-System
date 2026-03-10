namespace FacilityIssueTracker.DTOs;

public class UpdateTicketDTO
{
    public string? Status { get; set; }
    public int? Priority { get; set; }
    public int? CategoryId { get; set; }
    public int? TechnicianId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Location { get; set; }
}
