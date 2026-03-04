using System;
using System.Collections.Generic;

namespace FacilityIssueTracker.Models;

public partial class TicketSupply
{
    public int TicketId { get; set; }

    public int SupplyId { get; set; }

    public int QuantityUsed { get; set; }

    public virtual Supply Supply { get; set; } = null!;

    public virtual Ticket Ticket { get; set; } = null!;
}
