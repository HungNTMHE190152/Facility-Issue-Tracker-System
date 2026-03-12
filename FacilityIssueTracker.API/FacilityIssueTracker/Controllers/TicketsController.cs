using FacilityIssueTracker.DTOs;
using FacilityIssueTracker.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly AssContext _context;

    public TicketsController(AssContext context)
    {
        _context = context;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .AsNoTracking()
            .OrderBy(x => x.CategoryName)
            .Select(x => new CategoryOptionDTO
            {
                CategoryId = x.CategoryId,
                CategoryName = x.CategoryName
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketDTO dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var reporterId))
            return Unauthorized("Invalid token user information");

        var categoryExists = await _context.Categories
            .AnyAsync(x => x.CategoryId == dto.CategoryId);

        if (!categoryExists)
            return BadRequest("Category does not exist");

        var ticket = new Ticket
        {
            Title = dto.Title.Trim(),
            Description = dto.Description.Trim(),
            Location = dto.Location.Trim(),
            Priority = dto.Priority,
            CategoryId = dto.CategoryId,
            ReporterId = reporterId,
            ImageBefore = string.IsNullOrWhiteSpace(dto.ImageBefore) ? null : dto.ImageBefore.Trim(),
            Status = "OPEN",
            CreatedAt = DateTime.Now
        };

        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket created successfully",
            ticketId = ticket.TicketId
        });
    }

    [HttpGet("my-ticket")]
    [HttpGet("my")]
    public async Task<IActionResult> GetMyTickets([FromQuery] string? search, [FromQuery] string? status,
        [FromQuery] int? priority, [FromQuery] int? categoryId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var reporterId))
            return Unauthorized("Invalid token user information");

        var query = _context.Tickets
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Technician)
            .Where(x => x.ReporterId == userId || x.TechnicianId == userId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            query = query.Where(x =>
                x.Title.Contains(keyword) ||
                x.Description.Contains(keyword) ||
                x.Location.Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpper();
            query = query.Where(x => x.Status != null && x.Status.ToUpper() == normalizedStatus);
        }

        if (priority.HasValue)
            query = query.Where(x => x.Priority == priority.Value);

        if (categoryId.HasValue)
            query = query.Where(x => x.CategoryId == categoryId.Value);

        var tickets = await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new MyTicketItemDTO
            {
                TicketId = x.TicketId,
                Title = x.Title,
                Description = x.Description,
                Location = x.Location,
                Priority = x.Priority,
                Status = x.Status ?? "OPEN",
                CategoryId = x.CategoryId,
                CategoryName = x.Category.CategoryName,
                CreatedAt = x.CreatedAt,
                AssignedAt = x.AssignedAt,
                ResolvedAt = x.ResolvedAt,
                ClosedAt = x.ClosedAt,
                ImageBefore = x.ImageBefore,
                ImageAfter = x.ImageAfter,
                TechnicianName = x.Technician != null ? x.Technician.FullName : null,
                ReporterName = x.Reporter != null ? x.Reporter.FullName : null
            })
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpGet("all")]
    [Authorize(Roles = "Dispatcher, Admin")]
    public async Task<IActionResult> GetAllTickets([FromQuery] string? search, [FromQuery] string? status,
        [FromQuery] int? priority, [FromQuery] int? categoryId)
    {
        var query = _context.Tickets
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Technician)
            .Include(x => x.Reporter)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            query = query.Where(x =>
                x.Title.Contains(keyword) ||
                x.Description.Contains(keyword) ||
                x.Location.Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpper();
            query = query.Where(x => x.Status != null && x.Status.ToUpper() == normalizedStatus);
        }

        if (priority.HasValue)
            query = query.Where(x => x.Priority == priority.Value);

        if (categoryId.HasValue)
            query = query.Where(x => x.CategoryId == categoryId.Value);

        var tickets = await query
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new MyTicketItemDTO
            {
                TicketId = x.TicketId,
                Title = x.Title,
                Description = x.Description,
                Location = x.Location,
                Priority = x.Priority,
                Status = x.Status ?? "OPEN",
                CategoryId = x.CategoryId,
                CategoryName = x.Category != null ? x.Category.CategoryName : string.Empty,
                CreatedAt = x.CreatedAt,
                AssignedAt = x.AssignedAt,
                ResolvedAt = x.ResolvedAt,
                ClosedAt = x.ClosedAt,
                ImageBefore = x.ImageBefore,
                ImageAfter = x.ImageAfter,
                TechnicianName = x.Technician != null ? x.Technician.FullName : null,
                ReporterName = x.Reporter != null ? x.Reporter.FullName : null
            })
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTicketById(int id)
    {
        var ticket = await _context.Tickets
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Technician)
            .Include(x => x.Reporter)
            .FirstOrDefaultAsync(x => x.TicketId == id);

        if (ticket == null)
            return NotFound(new { message = "Ticket not found" });

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        bool isDispatcherOrAdmin = User.IsInRole("Dispatcher") || User.IsInRole("Admin");

        if (!isDispatcherOrAdmin && ticket.ReporterId.ToString() != userIdClaim && ticket.TechnicianId.ToString() != userIdClaim)
        {
            return Forbid();
        }

        var dto = new TicketDetailDTO
        {
            TicketId = ticket.TicketId,
            Title = ticket.Title,
            Description = ticket.Description,
            Location = ticket.Location,
            Priority = ticket.Priority,
            Status = ticket.Status ?? "OPEN",
            CategoryId = ticket.CategoryId,
            CategoryName = ticket.Category?.CategoryName ?? string.Empty,
            CreatedAt = ticket.CreatedAt,
            AssignedAt = ticket.AssignedAt,
            ResolvedAt = ticket.ResolvedAt,
            ClosedAt = ticket.ClosedAt,
            ImageBefore = ticket.ImageBefore,
            ImageAfter = ticket.ImageAfter,
            ReporterId = ticket.ReporterId,
            ReporterName = ticket.Reporter?.FullName ?? string.Empty,
            TechnicianId = ticket.TechnicianId,
            TechnicianName = ticket.Technician?.FullName
        };

        return Ok(dto);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateTicket(int id, [FromBody] UpdateTicketDTO dto)
    {
        var ticket = await _context.Tickets.FirstOrDefaultAsync(x => x.TicketId == id);
        if (ticket == null) return NotFound(new { message = "Ticket not found" });

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        bool isDispatcherOrAdmin = User.IsInRole("Dispatcher") || User.IsInRole("Admin");

        // Nếu là Reporter thì chỉ sửa được vé của chính mình, VÀ chỉ khi vé đang ở mức OPEN
        if (!isDispatcherOrAdmin)
        {
            // Nếu là Technician
            if (User.IsInRole("Technician"))
            {
                if (ticket.TechnicianId.ToString() != userIdStr)
                    return Forbid();
                
                // Nếu đang muốn ACCEPT (chuyển sang IN_PROGRESS)
                if (dto.Status?.ToUpper() == "IN_PROGRESS" && ticket.Status?.ToUpper() == "ASSIGNED")
                {
                    if (ticket.AssignedAt != null && DateTime.Now > ticket.AssignedAt.Value.AddHours(3))
                    {
                        return BadRequest(new { message = "Không thể tiếp nhận vé. Đã quá hạn 3 giờ kể từ khi được bàn giao (SLA Breach)." });
                    }
                }
            }
            else // Nếu là Reporter
            {
                if (ticket.ReporterId.ToString() != userIdStr)
                    return Forbid();
                if (ticket.Status != null && ticket.Status.ToUpper() != "OPEN")
                    return Forbid(); 
            }
        }

        if (int.TryParse(userIdStr, out var currentUserId) && isDispatcherOrAdmin)
        {
            ticket.DispatcherId = currentUserId;
        }

        if (dto.CategoryId.HasValue)
        {
            var categoryExists = await _context.Categories.AnyAsync(x => x.CategoryId == dto.CategoryId.Value);
            if (!categoryExists) return BadRequest(new { message = "Category does not exist" });
            ticket.CategoryId = dto.CategoryId.Value;
        }

        if (dto.Priority.HasValue)
            ticket.Priority = dto.Priority.Value;

        if (!string.IsNullOrWhiteSpace(dto.Status))
        {
            ticket.Status = dto.Status.Trim().ToUpper();
            if (ticket.Status == "ASSIGNED" && ticket.AssignedAt == null)
                ticket.AssignedAt = DateTime.Now;
            if (ticket.Status == "RESOLVED" && ticket.ResolvedAt == null)
                ticket.ResolvedAt = DateTime.Now;
            if (ticket.Status == "CLOSED" && ticket.ClosedAt == null)
                ticket.ClosedAt = DateTime.Now;
        }

        if (dto.TechnicianId.HasValue)
        {
            if (dto.TechnicianId.Value <= 0) 
            {
                ticket.TechnicianId = null;
            }
            else
            {
                var techExists = await _context.Users.Include(u => u.Role).AnyAsync(x => x.UserId == dto.TechnicianId.Value && x.Role.RoleName == "Technician");
                if (!techExists) return BadRequest(new { message = "Technician does not exist or invalid role" });
                ticket.TechnicianId = dto.TechnicianId.Value;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.Title))
            ticket.Title = dto.Title.Trim();
            
        if (!string.IsNullOrWhiteSpace(dto.Description))
            ticket.Description = dto.Description.Trim();
            
        if (!string.IsNullOrWhiteSpace(dto.Location))
            ticket.Location = dto.Location.Trim();

        _context.Tickets.Update(ticket);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Ticket updated successfully" });
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteTicket(int id)
    {
        var ticket = await _context.Tickets
            .Include(t => t.TicketHistories)
            .Include(t => t.TicketSupplies)
            .FirstOrDefaultAsync(x => x.TicketId == id);
            
        if (ticket == null) return NotFound(new { message = "Ticket not found" });

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        bool isDispatcherOrAdmin = User.IsInRole("Dispatcher") || User.IsInRole("Admin");

        if (!isDispatcherOrAdmin)
        {
            if (ticket.ReporterId.ToString() != userIdStr)
                return Forbid();
            if (ticket.Status != null && ticket.Status.ToUpper() != "OPEN")
                return Forbid();
        }

        if (ticket.TicketHistories.Any())
            _context.TicketHistories.RemoveRange(ticket.TicketHistories);
            
        if (ticket.TicketSupplies.Any())
            _context.TicketSupplies.RemoveRange(ticket.TicketSupplies);

        var review = await _context.Reviews.FirstOrDefaultAsync(r => r.TicketId == id);
        if (review != null)
            _context.Reviews.Remove(review);

        _context.Tickets.Remove(ticket);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Ticket deleted successfully" });
    }
}
