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
            .Where(x => x.ReporterId == reporterId)
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
                TechnicianName = x.Technician != null ? x.Technician.FullName : null
            })
            .ToListAsync();

        return Ok(tickets);
    }
}