using FacilityIssueTracker.DTOs;
using FacilityIssueTracker.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IO;          
using ClosedXML.Excel;   
using ExcelDataReader;

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
    [HttpPut("{id}/assign")]
    [Authorize(Roles = "Dispatcher")]
    public async Task<IActionResult> AssignTicket(int id, [FromBody] AssignTicketDTO dto)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        // Lấy ID của người duyệt (Dispatcher) từ Token
        var dispatcherId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        ticket.TechnicianId = dto.TechnicianId;
        ticket.DispatcherId = dispatcherId;
        ticket.Status = "ASSIGNED";
        ticket.AssignedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã phân công kỹ thuật viên thành công" });
    }
    // Nhấn Start
    [HttpPut("{id}/start")]
    [Authorize(Roles = "Technician")]
    public async Task<IActionResult> StartTicket(int id)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        ticket.Status = "IN_PROGRESS";
        await _context.SaveChangesAsync();
        return Ok(new { message = "Trạng thái: Đang sửa chữa" });
    }

    // Nhấn Resolve
    [HttpPut("{id}/resolve")]
    [Authorize(Roles = "Technician")]
    public async Task<IActionResult> ResolveTicket(int id, [FromBody] ResolveTicketDTO dto)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

        ticket.Status = "RESOLVED";
        ticket.ImageAfter = dto.ImageAfter;
        ticket.ResolvedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Đã báo cáo hoàn thành sự cố" });
    }
    [HttpPost("{id}/close")]
    [Authorize(Roles = "Reporter")]
    public async Task<IActionResult> CloseTicket(int id, [FromBody] ReviewDTO dto)
    {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) return NotFound();

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

        // 2. Thống kê theo tháng trong năm nay (Line Chart)
        var currentYear = DateTime.Now.Year;
        var lineChartData = await _context.Tickets
            .Where(t => t.CreatedAt.HasValue && t.CreatedAt.Value.Year == currentYear)
            .GroupBy(t => t.CreatedAt.Value.Month)
            .Select(g => new { month = g.Key, count = g.Count() })
            .OrderBy(x => x.month)
            .ToListAsync();

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

    //
    [HttpPost("export-excel")]
    [Authorize(Roles = "Dispatcher,Admin")] // Thường chỉ quản lý mới xuất báo cáo
    public async Task<IActionResult> ExportTickets()
    {
        // 1. Lấy dữ liệu cần xuất (kèm theo các bảng liên quan để lấy tên Category, User)
        var tickets = await _context.Tickets
            .Include(t => t.Category)
            .Include(t => t.Reporter)
            .Include(t => t.Technician)
            .AsNoTracking()
            .ToListAsync();

        // 2. Tạo Workbook mới
        using (var workbook = new ClosedXML.Excel.XLWorkbook())
        {
            var worksheet = workbook.Worksheets.Add("Danh Sach Su Co");

            // 3. Tạo tiêu đề cột (Header)
            worksheet.Cell(1, 1).Value = "ID";
            worksheet.Cell(1, 2).Value = "Tiêu đề";
            worksheet.Cell(1, 3).Value = "Loại sự cố";
            worksheet.Cell(1, 4).Value = "Vị trí";
            worksheet.Cell(1, 5).Value = "Trạng thái";
            worksheet.Cell(1, 6).Value = "Mức độ ưu tiên";
            worksheet.Cell(1, 7).Value = "Người báo";
            worksheet.Cell(1, 8).Value = "Kỹ thuật viên";
            worksheet.Cell(1, 9).Value = "Ngày tạo";

            // Định dạng Header (In đậm, màu nền)
            var headerRange = worksheet.Range("A1:I1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            // 4. Đổ dữ liệu vào các dòng
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

            // Tự động căn chỉnh độ rộng cột
            worksheet.Columns().AdjustToContents();

            // 5. Trả file về phía client
            using (var stream = new MemoryStream())
            {
                workbook.SaveAs(stream);
                var content = stream.ToArray();

                return Ok(File(
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"BaoCaoSuCo_{DateTime.Now:yyyyMMdd}.xlsx"
                ));
            }
        }
    }
    [HttpPost("import-supplies")]
    [Authorize(Roles = "Dispatcher,Admin")] // Chỉ cho phép quản lý nhập dữ liệu
    public async Task<IActionResult> ImportSupplies(IFormFile file)
    {
        // 1. Kiểm tra file đầu vào
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn một file Excel hợp lệ." });

        var listSupplies = new List<Supply>();

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
                        var supply = new Supply
                        {
                            SupplyName = reader.GetValue(0)?.ToString() ?? "Unknown",
                            StockQuantity = int.TryParse(reader.GetValue(1)?.ToString(), out int qty) ? qty : 0
                        };

                        listSupplies.Add(supply);
                    }
                }
            }

            // 3. Lưu vào Database
            if (listSupplies.Any())
            {
                _context.Supplies.AddRange(listSupplies);
                await _context.SaveChangesAsync();
                return Ok(new { message = $"Đã nhập thành công {listSupplies.Count} vật tư vào hệ thống." });
            }

            return BadRequest(new { message = "File Excel trống hoặc không đúng định dạng." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lỗi khi đọc file: " + ex.Message });
        }
    }
}
