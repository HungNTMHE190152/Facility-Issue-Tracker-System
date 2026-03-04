using System;
using System.Collections.Generic;

namespace FacilityIssueTracker.Models;

public partial class Supply
{
    public int SupplyId { get; set; }

    public string SupplyName { get; set; } = null!;

    public string? Unit { get; set; }

    public decimal? UnitPrice { get; set; }

    public int? StockQuantity { get; set; }

    public virtual ICollection<TicketSupply> TicketSupplies { get; set; } = new List<TicketSupply>();
}
