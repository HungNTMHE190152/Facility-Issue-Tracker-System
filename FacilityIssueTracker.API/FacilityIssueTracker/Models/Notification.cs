using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FacilityIssueTracker.Models
{
    public class Notification
    {
        [Key]
        public int NotificationId { get; set; }

        [Required]
        public int UserId { get; set; }

        public int? TicketId { get; set; }

        [Required]
        [MaxLength(500)]
        public string Message { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = "general";

        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = "info";

        [MaxLength(100)]
        public string? Source { get; set; }

        [MaxLength(300)]
        public string? ActionUrl { get; set; }

        public bool IsRead { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [ForeignKey("UserId")]
        public virtual User User { get; set; } = null!;

        [ForeignKey("TicketId")]
        public virtual Ticket? Ticket { get; set; }
    }
}
