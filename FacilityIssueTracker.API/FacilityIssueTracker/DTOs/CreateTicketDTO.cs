using System.ComponentModel.DataAnnotations;

namespace FacilityIssueTracker.DTOs;

public class CreateTicketDTO
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Location { get; set; } = string.Empty;

    public int? Priority { get; set; }

    [Required]
    public int CategoryId { get; set; }

    [MaxLength(2000000)]
    public string? ImageBefore { get; set; }
}