using FacilityIssueTracker.DTOs;
using FacilityIssueTracker.Models;
using FacilityIssueTracker.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IO;          
using ClosedXML.Excel;   
using ExcelDataReader;
using System.Threading.Tasks;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly AssContext _context;
    private readonly IEmailService _emailService;

    public TicketsController(AssContext context, IEmailService emailService)
    {
        _context = context;
        _emailService = emailService;
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            throw new InvalidOperationException("Invalid token user information");
        return userId;
    }

    private static int GetPriorityHoursAllowed(int? priority)
    {
        if (!priority.HasValue) return 36;
        if (priority.Value == 3) return 12;   // High
        if (priority.Value == 2) return 24;   // Medium
        return 36;                             // Low/default
    }

    private void FireAndForgetEmail(string? toEmail, string subject, string bodyHtml)
    {
        if (string.IsNullOrWhiteSpace(toEmail)) return;
        _ = Task.Run(() => _emailService.SendEmailAsync(toEmail, subject, bodyHtml));
    }

    private string BuildTicketStatusEmailBody(int ticketId, string title, string newStatus, DateTime? eventAt, string? note)
    {
        var when = eventAt.HasValue ? eventAt.Value.ToString("dd/MM/yyyy HH:mm") : "N/A";
        var safeTitle = System.Net.WebUtility.HtmlEncode(title);
        var safeStatus = System.Net.WebUtility.HtmlEncode(newStatus);
        var safeNote = string.IsNullOrWhiteSpace(note) ? "" : $"<p>{System.Net.WebUtility.HtmlEncode(note)}</p>";

        return $@"
<div style=""font-family:Arial,Helvetica,sans-serif;line-height:1.4"">
  <h2 style=""margin:0 0 12px 0"">Facility Issue Tracker</h2>
  <p><strong>Ticket #{ticketId}</strong></p>
  <p><strong>Tiêu đề:</strong> {safeTitle}</p>
  <p><strong>Trạng thái:</strong> {safeStatus}</p>
  <p><strong>Thời gian:</strong> {when}</p>
  {safeNote}
</div>";
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
        var prevStatusForEmail = ticket.Status?.ToUpper();
        string? newStatusForEmail = null;
        bool statusChangedForEmail = false;

        // Nếu là Reporter thì chỉ sửa được vé của chính mình, VÀ chỉ khi vé đang ở mức OPEN
        if (!isDispatcherOrAdmin)
        {
            if (ticket.ReporterId.ToString() != userIdStr)
                return Forbid();
            if (ticket.Status != null && ticket.Status.ToUpper() != "OPEN")
                return Forbid(); // Tránh Reporter sửa vé đã tiếp nhận
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
            newStatusForEmail = dto.Status.Trim().ToUpper();
            statusChangedForEmail = prevStatusForEmail != newStatusForEmail;
            ticket.Status = newStatusForEmail;
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

        // Email Notification (US-43): gửi khi dispatcher/admin cập nhật status qua UpdateTicket
        if (statusChangedForEmail && !string.IsNullOrWhiteSpace(newStatusForEmail))
        {
            var reporterEmail = await _context.Users
                .Where(u => u.UserId == ticket.ReporterId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync();

            string? technicianEmail = null;
            if (ticket.TechnicianId.HasValue)
            {
                technicianEmail = await _context.Users
                    .Where(u => u.UserId == ticket.TechnicianId.Value)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();
            }

            string? dispatcherEmail = null;
            if (ticket.DispatcherId.HasValue)
            {
                dispatcherEmail = await _context.Users
                    .Where(u => u.UserId == ticket.DispatcherId.Value)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();
            }

            DateTime? eventAt =
                newStatusForEmail == "ASSIGNED" ? ticket.AssignedAt :
                newStatusForEmail == "RESOLVED" ? ticket.ResolvedAt :
                newStatusForEmail == "CLOSED" ? ticket.ClosedAt :
                DateTime.Now;

            var subject = $"Facility Issue Tracker - Ticket #{ticket.TicketId} updated";
            var body = BuildTicketStatusEmailBody(ticket.TicketId, ticket.Title, newStatusForEmail, eventAt, null);

            if (newStatusForEmail == "ASSIGNED")
            {
                FireAndForgetEmail(technicianEmail, subject, body);
                FireAndForgetEmail(reporterEmail, subject, body);
            }
            else if (newStatusForEmail == "IN_PROGRESS" || newStatusForEmail == "RESOLVED")
            {
                FireAndForgetEmail(reporterEmail, subject, body);
            }
            else if (newStatusForEmail == "CLOSED")
            {
                FireAndForgetEmail(technicianEmail, subject, body);
                FireAndForgetEmail(dispatcherEmail, subject, body);
            }
        }

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
    [HttpPut("{id}/assign")]
    [Authorize(Roles = "Dispatcher")]
    public async Task<IActionResult> AssignTicket(int id, [FromBody] AssignTicketDTO dto)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        // Lấy ID của người duyệt (Dispatcher) từ Token
        var dispatcherId = GetCurrentUserId();

        ticket.TechnicianId = dto.TechnicianId;
        ticket.DispatcherId = dispatcherId;
        ticket.Status = "ASSIGNED";
        ticket.AssignedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Email Notification (US-43): gửi cho technician khi được phân công
        var technicianEmail = await _context.Users
            .Where(u => u.UserId == dto.TechnicianId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();
        var reporterEmail = await _context.Users
            .Where(u => u.UserId == ticket.ReporterId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();

        var subject = $"Facility Issue Tracker - Ticket #{ticket.TicketId} assigned";
        var body = BuildTicketStatusEmailBody(ticket.TicketId, ticket.Title, "ASSIGNED", ticket.AssignedAt, null);
        FireAndForgetEmail(technicianEmail, subject, body);
        FireAndForgetEmail(reporterEmail, subject, body);

        return Ok(new { message = "Đã phân công kỹ thuật viên thành công" });
    }
    // Nhấn Start
    [HttpPut("{id}/start")]
    [Authorize(Roles = "Technician")]
    public async Task<IActionResult> StartTicket(int id)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        var technicianId = GetCurrentUserId();
        if (!ticket.TechnicianId.HasValue || ticket.TechnicianId.Value != technicianId)
            return Forbid();

        var prevStatus = ticket.Status?.ToUpper();
        ticket.Status = "IN_PROGRESS";
        await _context.SaveChangesAsync();

        // Email Notification (US-43): báo cho reporter khi technician bắt đầu xử lý
        if (prevStatus != "IN_PROGRESS")
        {
            var reporterEmail = await _context.Users
                .Where(u => u.UserId == ticket.ReporterId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync();

            var subject = $"Facility Issue Tracker - Ticket #{ticket.TicketId} started";
            var body = BuildTicketStatusEmailBody(ticket.TicketId, ticket.Title, "IN_PROGRESS", DateTime.Now, null);
            FireAndForgetEmail(reporterEmail, subject, body);
        }

        return Ok(new { message = "Trạng thái: Đang sửa chữa" });
    }

    // Nhấn Resolve
    [HttpPut("{id}/resolve")]
    [Authorize(Roles = "Technician")]
    public async Task<IActionResult> ResolveTicket(int id, [FromBody] ResolveTicketDTO dto)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        var technicianId = GetCurrentUserId();
        if (!ticket.TechnicianId.HasValue || ticket.TechnicianId.Value != technicianId)
            return Forbid();

        var prevStatus = ticket.Status?.ToUpper();
        ticket.Status = "RESOLVED";
        ticket.ImageAfter = dto.ImageAfter;
        ticket.ResolvedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Email Notification (US-43): báo cho reporter khi đã resolve xong
        if (prevStatus != "RESOLVED")
        {
            var reporterEmail = await _context.Users
                .Where(u => u.UserId == ticket.ReporterId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync();

            var subject = $"Facility Issue Tracker - Ticket #{ticket.TicketId} resolved";
            var body = BuildTicketStatusEmailBody(ticket.TicketId, ticket.Title, "RESOLVED", ticket.ResolvedAt, null);
            FireAndForgetEmail(reporterEmail, subject, body);
        }

        return Ok(new { message = "Đã báo cáo hoàn thành sự cố" });
    }
    [HttpPost("{id}/close")]
    [Authorize(Roles = "Reporter")]
    public async Task<IActionResult> CloseTicket(int id, [FromBody] ReviewDTO dto)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        var reporterId = GetCurrentUserId();
        if (ticket.ReporterId != reporterId)
            return Forbid();

        var prevStatus = ticket.Status?.ToUpper();
        ticket.Status = "CLOSED";
        ticket.ClosedAt = DateTime.Now;

        // Tạo bản ghi đánh giá mới
        var review = new Review
        {
            TicketId = id,
            Rating = dto.Rating,
            Comment = dto.Comment,
            CreatedAt = DateTime.Now
        };
        _context.Reviews.Add(review);

        await _context.SaveChangesAsync();

        // Email Notification (US-43): báo cho technician & dispatcher khi ticket được đóng
        if (prevStatus != "CLOSED")
        {
            string? technicianEmail = null;
            if (ticket.TechnicianId.HasValue)
            {
                technicianEmail = await _context.Users
                    .Where(u => u.UserId == ticket.TechnicianId.Value)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();
            }

            string? dispatcherEmail = null;
            if (ticket.DispatcherId.HasValue)
            {
                dispatcherEmail = await _context.Users
                    .Where(u => u.UserId == ticket.DispatcherId.Value)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();
            }

            var subject = $"Facility Issue Tracker - Ticket #{ticket.TicketId} closed";
            var body = BuildTicketStatusEmailBody(ticket.TicketId, ticket.Title, "CLOSED", ticket.ClosedAt, null);
            FireAndForgetEmail(technicianEmail, subject, body);
            FireAndForgetEmail(dispatcherEmail, subject, body);
        }

        return Ok(new { message = "Đã đóng ticket và lưu đánh giá" });
    }

    [HttpGet("dashboard-stats")]
    [Authorize(Roles = "Dispatcher,Admin")] // Chỉ quản lý mới xem được thống kê
    public async Task<IActionResult> GetDashboardStats()
    {
        // 1. Thống kê theo loại sự cố (Pie Chart)
        var pieChartData = await _context.Tickets
            .GroupBy(t => t.Category.CategoryName)
            .Select(g => new { name = g.Key, value = g.Count() })
            .ToListAsync();

        // 2. Thống kê theo 12 tháng gần nhất (Line Chart)
        var now = DateTime.Now;
        var monthStarts = Enumerable.Range(0, 12)
            .Select(i => new DateTime(now.Year, now.Month, 1).AddMonths(-11 + i))
            .ToList();
        var startAt = monthStarts.First();
        var endAt = monthStarts.Last().AddMonths(1);

        var groupedByMonth = await _context.Tickets
            .Where(t => t.CreatedAt.HasValue && t.CreatedAt.Value >= startAt && t.CreatedAt.Value < endAt)
            .GroupBy(t => new { t.CreatedAt!.Value.Year, t.CreatedAt!.Value.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, count = g.Count() })
            .ToListAsync();

        var groupedLookup = groupedByMonth
            .ToDictionary(x => $"{x.Year:D4}-{x.Month:D2}", x => x.count);

        var lineChartData = monthStarts
            .Select(m =>
            {
                var key = $"{m.Year:D4}-{m.Month:D2}";
                return new { month = m.Month, count = groupedLookup.TryGetValue(key, out var c) ? c : 0 };
            })
            .ToList();

        // 3. Bảng xếp hạng kỹ thuật viên (Leaderboard)
        var leaderboard = await _context.Users
            .Where(u => u.Role.RoleName == "Technician")
            .Select(u => new {
                FullName = u.FullName,
                ResolvedCount = u.TicketTechnicians.Count(t => t.Status == "CLOSED"),
                AverageRating = u.TicketTechnicians
                    .Where(t => t.Review != null)
                    .Average(t => t.Review!.Rating) ?? 0
            })
            .OrderByDescending(x => x.ResolvedCount)
            .Take(5) // Lấy top 5
            .ToListAsync();

        return Ok(new { pieChartData, lineChartData, leaderboard });
    }

    [HttpPost("export-resolved-excel")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<IActionResult> ExportResolvedTickets()
    {
        var resolvedTickets = await _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Reporter)
            .Include(t => t.Technician)
            .AsNoTracking()
            .Where(t => t.Status != null && (t.Status.ToUpper() == "RESOLVED" || t.Status.ToUpper() == "CLOSED"))
            .OrderByDescending(t => t.ResolvedAt ?? t.ClosedAt ?? t.CreatedAt)
            .ToListAsync();

        using (var workbook = new XLWorkbook())
        {
            var worksheet = workbook.Worksheets.Add("Resolved Tickets");
            worksheet.Cell(1, 1).Value = "Ticket ID";
            worksheet.Cell(1, 2).Value = "Title";
            worksheet.Cell(1, 3).Value = "Category";
            worksheet.Cell(1, 4).Value = "Status";
            worksheet.Cell(1, 5).Value = "Reporter";
            worksheet.Cell(1, 6).Value = "Technician";
            worksheet.Cell(1, 7).Value = "Resolved At";
            worksheet.Cell(1, 8).Value = "Closed At";

            var headerRange = worksheet.Range("A1:H1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

            var row = 2;
            foreach (var t in resolvedTickets)
            {
                worksheet.Cell(row, 1).Value = t.TicketId;
                worksheet.Cell(row, 2).Value = t.Title;
                worksheet.Cell(row, 3).Value = t.Category?.CategoryName ?? string.Empty;
                worksheet.Cell(row, 4).Value = t.Status ?? string.Empty;
                worksheet.Cell(row, 5).Value = t.Reporter?.FullName ?? string.Empty;
                worksheet.Cell(row, 6).Value = t.Technician?.FullName ?? string.Empty;
                worksheet.Cell(row, 7).Value = t.ResolvedAt?.ToString("dd/MM/yyyy HH:mm") ?? string.Empty;
                worksheet.Cell(row, 8).Value = t.ClosedAt?.ToString("dd/MM/yyyy HH:mm") ?? string.Empty;
                row++;
            }

            worksheet.Columns().AdjustToContents();

            var fileName = $"ResolvedTickets_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "exports");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);
            var filePath = Path.Combine(folderPath, fileName);
            workbook.SaveAs(filePath);

            var fileUrl = $"{Request.Scheme}://{Request.Host}/exports/{fileName}";
            return Ok(new { url = fileUrl });
        }
    }

    [HttpPost("export-material-cost-excel")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<IActionResult> ExportMaterialCostReport()
    {
        var ticketSupplyRows = await _context.TicketSupplies
            .AsNoTracking()
            .Include(ts => ts.Ticket)
            .Include(ts => ts.Supply)
            .Where(ts => ts.Ticket.Status != null && (ts.Ticket.Status.ToUpper() == "RESOLVED" || ts.Ticket.Status.ToUpper() == "CLOSED"))
            .Select(ts => new
            {
                ts.TicketId,
                TicketTitle = ts.Ticket.Title,
                ts.QuantityUsed,
                SupplyName = ts.Supply.SupplyName,
                Unit = ts.Supply.Unit,
                UnitPrice = ts.Supply.UnitPrice ?? 0,
                Cost = (ts.Supply.UnitPrice ?? 0) * ts.QuantityUsed
            })
            .ToListAsync();

        using (var workbook = new XLWorkbook())
        {
            var detailSheet = workbook.Worksheets.Add("Material Cost Detail");
            detailSheet.Cell(1, 1).Value = "Ticket ID";
            detailSheet.Cell(1, 2).Value = "Ticket Title";
            detailSheet.Cell(1, 3).Value = "Supply";
            detailSheet.Cell(1, 4).Value = "Unit";
            detailSheet.Cell(1, 5).Value = "Quantity Used";
            detailSheet.Cell(1, 6).Value = "Unit Price";
            detailSheet.Cell(1, 7).Value = "Cost";

            var detailHeader = detailSheet.Range("A1:G1");
            detailHeader.Style.Font.Bold = true;
            detailHeader.Style.Fill.BackgroundColor = XLColor.LightGray;

            var detailRow = 2;
            foreach (var item in ticketSupplyRows)
            {
                detailSheet.Cell(detailRow, 1).Value = item.TicketId;
                detailSheet.Cell(detailRow, 2).Value = item.TicketTitle;
                detailSheet.Cell(detailRow, 3).Value = item.SupplyName;
                detailSheet.Cell(detailRow, 4).Value = item.Unit ?? string.Empty;
                detailSheet.Cell(detailRow, 5).Value = item.QuantityUsed;
                detailSheet.Cell(detailRow, 6).Value = item.UnitPrice;
                detailSheet.Cell(detailRow, 7).Value = item.Cost;
                detailRow++;
            }

            detailSheet.Column(6).Style.NumberFormat.Format = "#,##0.00";
            detailSheet.Column(7).Style.NumberFormat.Format = "#,##0.00";
            detailSheet.Columns().AdjustToContents();

            var summarySheet = workbook.Worksheets.Add("Summary");
            summarySheet.Cell(1, 1).Value = "Metric";
            summarySheet.Cell(1, 2).Value = "Value";
            var summaryHeader = summarySheet.Range("A1:B1");
            summaryHeader.Style.Font.Bold = true;
            summaryHeader.Style.Fill.BackgroundColor = XLColor.LightGray;

            var totalCost = ticketSupplyRows.Sum(x => x.Cost);
            summarySheet.Cell(2, 1).Value = "Total Material Cost";
            summarySheet.Cell(2, 2).Value = totalCost;
            summarySheet.Cell(2, 2).Style.NumberFormat.Format = "#,##0.00";
            summarySheet.Columns().AdjustToContents();

            var fileName = $"MaterialCost_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "exports");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);
            var filePath = Path.Combine(folderPath, fileName);
            workbook.SaveAs(filePath);

            var fileUrl = $"{Request.Scheme}://{Request.Host}/exports/{fileName}";
            return Ok(new { url = fileUrl });
        }
    }

    // Nhật ký bảo trì: ticket đã giải quyết + chi phí vật tư tương ứng
    [HttpPost("export-maintenance-log-excel")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<IActionResult> ExportMaintenanceLog()
    {
        var resolvedTickets = await _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Reporter)
            .Include(t => t.Technician)
            .AsNoTracking()
            .Where(t => t.Status != null && (t.Status.ToUpper() == "RESOLVED" || t.Status.ToUpper() == "CLOSED"))
            .OrderByDescending(t => t.ResolvedAt ?? t.ClosedAt ?? t.CreatedAt)
            .ToListAsync();

        var maintenanceCostRows = await _context.TicketSupplies
            .AsNoTracking()
            .Include(ts => ts.Ticket)
            .Include(ts => ts.Supply)
            .Where(ts => ts.Ticket != null && ts.Ticket.Status != null &&
                         (ts.Ticket.Status.ToUpper() == "RESOLVED" || ts.Ticket.Status.ToUpper() == "CLOSED"))
            .Select(ts => new
            {
                ts.TicketId,
                ts.Ticket.Title,
                TicketStatus = ts.Ticket.Status,
                ResolvedAt = ts.Ticket.ResolvedAt,
                ClosedAt = ts.Ticket.ClosedAt,
                CategoryName = ts.Ticket.Category.CategoryName,
                Reporter = ts.Ticket.Reporter.FullName,
                Technician = ts.Ticket.Technician != null ? ts.Ticket.Technician.FullName : "Chưa phân công",
                ts.Supply.SupplyName,
                Unit = ts.Supply.Unit,
                UnitPrice = ts.Supply.UnitPrice ?? 0,
                ts.QuantityUsed,
                Cost = (ts.Supply.UnitPrice ?? 0) * ts.QuantityUsed
            })
            .ToListAsync();

        using (var workbook = new XLWorkbook())
        {
            // Sheet 1: Resolved tickets
            var resolvedSheet = workbook.Worksheets.Add("Resolved Tickets");
            resolvedSheet.Cell(1, 1).Value = "Ticket ID";
            resolvedSheet.Cell(1, 2).Value = "Title";
            resolvedSheet.Cell(1, 3).Value = "Category";
            resolvedSheet.Cell(1, 4).Value = "Status";
            resolvedSheet.Cell(1, 5).Value = "Reporter";
            resolvedSheet.Cell(1, 6).Value = "Technician";
            resolvedSheet.Cell(1, 7).Value = "Resolved At";
            resolvedSheet.Cell(1, 8).Value = "Closed At";

            var headerRange = resolvedSheet.Range("A1:H1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

            var row = 2;
            foreach (var t in resolvedTickets)
            {
                resolvedSheet.Cell(row, 1).Value = t.TicketId;
                resolvedSheet.Cell(row, 2).Value = t.Title;
                resolvedSheet.Cell(row, 3).Value = t.Category?.CategoryName ?? string.Empty;
                resolvedSheet.Cell(row, 4).Value = t.Status ?? string.Empty;
                resolvedSheet.Cell(row, 5).Value = t.Reporter?.FullName ?? string.Empty;
                resolvedSheet.Cell(row, 6).Value = t.Technician?.FullName ?? string.Empty;
                resolvedSheet.Cell(row, 7).Value = t.ResolvedAt?.ToString("dd/MM/yyyy HH:mm") ?? string.Empty;
                resolvedSheet.Cell(row, 8).Value = t.ClosedAt?.ToString("dd/MM/yyyy HH:mm") ?? string.Empty;
                row++;
            }

            resolvedSheet.Columns().AdjustToContents();

            // Sheet 2: Material cost detail
            var costSheet = workbook.Worksheets.Add("Material Costs");
            costSheet.Cell(1, 1).Value = "Ticket ID";
            costSheet.Cell(1, 2).Value = "Ticket Title";
            costSheet.Cell(1, 3).Value = "Status";
            costSheet.Cell(1, 4).Value = "Resolved At";
            costSheet.Cell(1, 5).Value = "Closed At";
            costSheet.Cell(1, 6).Value = "Category";
            costSheet.Cell(1, 7).Value = "Reporter";
            costSheet.Cell(1, 8).Value = "Technician";
            costSheet.Cell(1, 9).Value = "Supply";
            costSheet.Cell(1, 10).Value = "Quantity Used";
            costSheet.Cell(1, 11).Value = "Unit Price";
            costSheet.Cell(1, 12).Value = "Cost";

            var costHeader = costSheet.Range("A1:L1");
            costHeader.Style.Font.Bold = true;
            costHeader.Style.Fill.BackgroundColor = XLColor.LightGray;

            var costRow = 2;
            foreach (var item in maintenanceCostRows)
            {
                costSheet.Cell(costRow, 1).Value = item.TicketId;
                costSheet.Cell(costRow, 2).Value = item.Title;
                costSheet.Cell(costRow, 3).Value = item.TicketStatus ?? string.Empty;
                costSheet.Cell(costRow, 4).Value = item.ResolvedAt?.ToString("dd/MM/yyyy HH:mm") ?? string.Empty;
                costSheet.Cell(costRow, 5).Value = item.ClosedAt?.ToString("dd/MM/yyyy HH:mm") ?? string.Empty;
                costSheet.Cell(costRow, 6).Value = item.CategoryName ?? string.Empty;
                costSheet.Cell(costRow, 7).Value = item.Reporter ?? string.Empty;
                costSheet.Cell(costRow, 8).Value = item.Technician ?? string.Empty;
                costSheet.Cell(costRow, 9).Value = item.SupplyName ?? string.Empty;
                costSheet.Cell(costRow, 10).Value = item.QuantityUsed;
                costSheet.Cell(costRow, 11).Value = item.UnitPrice;
                costSheet.Cell(costRow, 12).Value = item.Cost;
                costRow++;
            }

            costSheet.Column(11).Style.NumberFormat.Format = "#,##0.00";
            costSheet.Column(12).Style.NumberFormat.Format = "#,##0.00";
            costSheet.Columns().AdjustToContents();

            // Summary
            var totalCost = maintenanceCostRows.Sum(x => x.Cost);
            costSheet.Cell(maintenanceCostRows.Count + 3, 9).Value = "Total Cost";
            costSheet.Cell(maintenanceCostRows.Count + 3, 12).Value = totalCost;
            costSheet.Range($"I{maintenanceCostRows.Count + 3}:I{maintenanceCostRows.Count + 3}").Style.Font.Bold = true;

            var fileName = $"MaintenanceLog_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "exports");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);
            var filePath = Path.Combine(folderPath, fileName);
            workbook.SaveAs(filePath);

            var fileUrl = $"{Request.Scheme}://{Request.Host}/exports/{fileName}";
            return Ok(new { url = fileUrl });
        }
    }

    [HttpGet("technician-dashboard")]
    [Authorize(Roles = "Technician")]
    public async Task<IActionResult> GetTechnicianDashboard()
    {
        var technicianId = GetCurrentUserId();
        var currentYear = DateTime.Now.Year;
        var now = DateTime.Now;

        var ticketsQuery = _context.Tickets
            .AsNoTracking()
            .Where(t => t.TechnicianId == technicianId)
            .Include(t => t.Category);

        // Category Chart (Pie)
        var pieChartData = await ticketsQuery
            .GroupBy(t => t.Category.CategoryName)
            .Select(g => new { name = g.Key, value = g.Count() })
            .ToListAsync();

        // Monthly Chart (Line)
        var lineChartData = await ticketsQuery
            .Where(t => t.CreatedAt.HasValue && t.CreatedAt.Value.Year == currentYear)
            .GroupBy(t => t.CreatedAt!.Value.Month)
            .Select(g => new { month = g.Key, count = g.Count() })
            .OrderBy(x => x.month)
            .ToListAsync();

        // Track task progress (status + timestamps)
        var statusCounts = await ticketsQuery
            .GroupBy(t => (t.Status ?? "OPEN").ToUpper())
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToListAsync();

        var recentTicketsRaw = await ticketsQuery
            .OrderByDescending(t => t.CreatedAt)
            .Take(10)
            .Select(t => new
            {
                ticketId = t.TicketId,
                title = t.Title,
                status = t.Status ?? "OPEN",
                priority = t.Priority,
                categoryName = t.Category.CategoryName,
                createdAt = t.CreatedAt,
                assignedAt = t.AssignedAt,
                resolvedAt = t.ResolvedAt,
                closedAt = t.ClosedAt
            })
            .ToListAsync();

        var recentTickets = recentTicketsRaw.Select(t =>
        {
            DateTime? deadlineAt = null;
            if (t.assignedAt.HasValue && t.priority.HasValue)
            {
                deadlineAt = t.assignedAt.Value.AddHours(GetPriorityHoursAllowed(t.priority));
            }

            var normalized = (t.status ?? "OPEN").ToUpper();
            var isOverdue = deadlineAt.HasValue &&
                             deadlineAt.Value < now &&
                             normalized != "CLOSED" &&
                             normalized != "RESOLVED";

            return new
            {
                ticketId = t.ticketId,
                title = t.title,
                status = t.status,
                priority = t.priority,
                categoryName = t.categoryName,
                createdAt = t.createdAt,
                assignedAt = t.assignedAt,
                resolvedAt = t.resolvedAt,
                closedAt = t.closedAt,
                deadlineAt,
                isOverdue
            };
        }).ToList();

        // Notification list (derived from timestamps)
        var ticketsForNotifications = await ticketsQuery
            .OrderByDescending(t => t.CreatedAt)
            .Take(20)
            .Select(t => new
            {
                ticketId = t.TicketId,
                title = t.Title,
                assignedAt = t.AssignedAt,
                resolvedAt = t.ResolvedAt,
                closedAt = t.ClosedAt
            })
            .ToListAsync();

        var notifications = new List<TechnicianNotificationItem>();
        foreach (var t in ticketsForNotifications)
        {
            if (t.assignedAt.HasValue)
            {
                notifications.Add(new TechnicianNotificationItem
                {
                    historyId = 0,
                    ticketId = t.ticketId,
                    message = $"Ticket #{t.ticketId} assigned to you.",
                    type = "info",
                    changedAt = t.assignedAt.Value
                });
            }

            if (t.resolvedAt.HasValue)
            {
                notifications.Add(new TechnicianNotificationItem
                {
                    historyId = 0,
                    ticketId = t.ticketId,
                    message = $"Ticket #{t.ticketId} resolved.",
                    type = "success",
                    changedAt = t.resolvedAt.Value
                });
            }

            if (t.closedAt.HasValue)
            {
                notifications.Add(new TechnicianNotificationItem
                {
                    historyId = 0,
                    ticketId = t.ticketId,
                    message = $"Ticket #{t.ticketId} closed.",
                    type = "success",
                    changedAt = t.closedAt.Value
                });
            }
        }

        var notificationsOrdered = notifications
            .OrderByDescending(n => n.changedAt)
            .Take(20)
            .ToList();

        return Ok(new
        {
            pieChartData,
            lineChartData,
            taskProgress = new
            {
                statusCounts,
                recentTickets
            },
            notifications = notificationsOrdered
        });
    }

    //
    [HttpPost("export-excel")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<IActionResult> ExportTickets()
    {
        //Database
        var tickets = await _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Reporter)
            .Include(t => t.Technician)
            .AsNoTracking()
            .ToListAsync();

        using (var workbook = new ClosedXML.Excel.XLWorkbook())
        {
            var worksheet = workbook.Worksheets.Add("Danh Sách Sự Cố");

            //Header
            worksheet.Cell(1, 1).Value = "ID";
            worksheet.Cell(1, 2).Value = "Tiêu đề";
            worksheet.Cell(1, 3).Value = "Loại sự cố";
            worksheet.Cell(1, 4).Value = "Vị trí";
            worksheet.Cell(1, 5).Value = "Trạng thái";
            worksheet.Cell(1, 6).Value = "Mức độ ưu tiên";
            worksheet.Cell(1, 7).Value = "Người báo";
            worksheet.Cell(1, 8).Value = "Kỹ thuật viên";
            worksheet.Cell(1, 9).Value = "Ngày tạo";

            var headerRange = worksheet.Range("A1:I1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            int currentRow = 2;
            foreach (var t in tickets)
            {
                worksheet.Cell(currentRow, 1).Value = t.TicketId;
                worksheet.Cell(currentRow, 2).Value = t.Title;
                worksheet.Cell(currentRow, 3).Value = t.Category?.CategoryName;
                worksheet.Cell(currentRow, 4).Value = t.Location;
                worksheet.Cell(currentRow, 5).Value = t.Status;
                worksheet.Cell(currentRow, 6).Value = t.Priority;
                worksheet.Cell(currentRow, 7).Value = t.Reporter?.FullName;
                worksheet.Cell(currentRow, 8).Value = t.Technician?.FullName ?? "Chưa phân công";
                worksheet.Cell(currentRow, 9).Value = t.CreatedAt?.ToString("dd/MM/yyyy HH:mm");
                currentRow++;
            }

            worksheet.Columns().AdjustToContents();

            // save wwwroot
            var fileName = $"BaoCao_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "exports");

            if (!Directory.Exists(folderPath))
                Directory.CreateDirectory(folderPath);

            var filePath = Path.Combine(folderPath, fileName);
            workbook.SaveAs(filePath);

            // 5. Trả về URL để Frontend sử dụng window.open()
            var fileUrl = $"{Request.Scheme}://{Request.Host}/exports/{fileName}";

            return Ok(new { url = fileUrl });
        }
    }
    [HttpPost("import-supplies")]
    [Authorize(Roles = "Dispatcher,Admin")] // Chỉ cho phép quản lý nhập dữ liệu
    public async Task<IActionResult> ImportSupplies(IFormFile file)
    {
        // 1. Kiểm tra file đầu vào
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn một file Excel hợp lệ." });

        // Cập nhật theo tên vật tư (SupplyName). Nếu file trùng tên nhiều dòng thì lấy giá trị ở dòng cuối cùng.
        // Excel expected columns (header row is skipped):
        // - Col 0: SupplyName
        // - Col 1: StockQuantity
        // - Col 2 (optional): Unit
        // - Col 3 (optional): UnitPrice
        var importedStockByName = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var importedUnitByName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var importedUnitPriceByName = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        // 2. Đăng ký Encoding (Bắt buộc phải có dòng này để đọc được file Excel trong .NET Core)
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

        try
        {
            using (var stream = file.OpenReadStream())
            {
                // Tạo Reader để đọc file
                using (var reader = ExcelReaderFactory.CreateReader(stream))
                {
                    bool isHeaderSkipped = false;

                    while (reader.Read())
                    {
                        // Bỏ qua dòng tiêu đề (dòng 1) của file Excel
                        if (!isHeaderSkipped)
                        {
                            isHeaderSkipped = true;
                            continue;
                        }

                        // Đọc dữ liệu từng cột (Ví dụ: Cột 0 là tên, Cột 1 là số lượng)
                        var supplyNameRaw = reader.GetValue(0)?.ToString();
                        var supplyName = supplyNameRaw?.Trim();
                        if (string.IsNullOrWhiteSpace(supplyName))
                            continue;

                        var stockQty = int.TryParse(reader.GetValue(1)?.ToString(), out int qty) ? qty : 0;
                        importedStockByName[supplyName] = stockQty;

                        var unit = reader.GetValue(2)?.ToString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(unit))
                            importedUnitByName[supplyName] = unit;

                        var unitPriceStr = reader.GetValue(3)?.ToString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(unitPriceStr) && decimal.TryParse(unitPriceStr, out var unitPrice))
                            importedUnitPriceByName[supplyName] = unitPrice;
                    }
                }
            }

            // 3. Upsert vào Database (đã có thì update, chưa có thì insert)
            if (importedStockByName.Any())
            {
                var importNames = importedStockByName.Keys.ToList();
                var existingSupplies = await _context.Supplies
                    .Where(s => importNames.Contains(s.SupplyName))
                    .ToListAsync();

                var existingByName = existingSupplies
                    .ToDictionary(s => s.SupplyName.Trim(), s => s, StringComparer.OrdinalIgnoreCase);

                var updatedCount = 0;
                var insertedCount = 0;

                foreach (var item in importedStockByName)
                {
                    if (existingByName.TryGetValue(item.Key, out var existing))
                    {
                        existing.StockQuantity = item.Value;

                        if (importedUnitByName.TryGetValue(item.Key, out var unit))
                            existing.Unit = unit;

                        if (importedUnitPriceByName.TryGetValue(item.Key, out var unitPrice))
                            existing.UnitPrice = unitPrice;

                        updatedCount++;
                    }
                    else
                    {
                        importedUnitByName.TryGetValue(item.Key, out var unit);
                        importedUnitPriceByName.TryGetValue(item.Key, out var unitPrice);

                        _context.Supplies.Add(new Supply
                        {
                            SupplyName = item.Key,
                            StockQuantity = item.Value,
                            Unit = string.IsNullOrWhiteSpace(unit) ? null : unit,
                            UnitPrice = unitPrice
                        });
                        insertedCount++;
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new
                {
                    message = $"Import thành công. Thêm mới: {insertedCount}, cập nhật: {updatedCount}."
                });
            }

            return BadRequest(new { message = "File Excel trống hoặc không đúng định dạng." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi khi đọc file: " + ex.Message });
        }
    }

    private class TechnicianNotificationItem
    {
        // Lower camelCase để frontend lấy đúng key (JS case-sensitive).
        public int historyId { get; set; }
        public int ticketId { get; set; }
        public string message { get; set; } = string.Empty;
        public string type { get; set; } = "info";
        public DateTime changedAt { get; set; }
    }
}
