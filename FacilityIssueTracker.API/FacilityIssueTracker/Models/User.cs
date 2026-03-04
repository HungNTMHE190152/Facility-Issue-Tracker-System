using System;
using System.Collections.Generic;

namespace FacilityIssueTracker.Models;

public partial class User
{
    public int UserId { get; set; }

    public string FullName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public int RoleId { get; set; }

    public virtual Role Role { get; set; } = null!;

    public virtual ICollection<Ticket> TicketDispatchers { get; set; } = new List<Ticket>();

    public virtual ICollection<TicketHistory> TicketHistories { get; set; } = new List<TicketHistory>();

    public virtual ICollection<Ticket> TicketReporters { get; set; } = new List<Ticket>();

    public virtual ICollection<Ticket> TicketTechnicians { get; set; } = new List<Ticket>();
}
