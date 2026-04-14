using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FacilityIssueTracker.Models;
using System.Security.Claims;

namespace FacilityIssueTracker.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly AssContext _context;

        public NotificationsController(AssContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Notification>>> GetMyNotifications([FromQuery] bool unreadOnly = false, [FromQuery] string? type = null)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId))
                return Unauthorized();

            var query = _context.Notifications
                .Where(n => n.UserId == userId)
                .AsQueryable();

            if (unreadOnly)
                query = query.Where(n => !n.IsRead);

            if (!string.IsNullOrWhiteSpace(type))
            {
                var normalizedType = type.Trim().ToLower();
                query = query.Where(n => n.Type.ToLower() == normalizedType);
            }

            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(20)
                .ToListAsync();

            if (!notifications.Any())
            {
                await BootstrapNotificationsFromHistoryAsync(userId);

                notifications = await query
                    .OrderByDescending(n => n.CreatedAt)
                    .Take(20)
                    .ToListAsync();
            }

            return notifications;
        }

        private async Task BootstrapNotificationsFromHistoryAsync(int userId)
        {
            var roleName = await _context.Users
                .AsNoTracking()
                .Where(u => u.UserId == userId)
                .Select(u => u.Role.RoleName)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(roleName))
                return;

            var role = roleName.Trim().ToLower();

            var historyQuery = _context.TicketHistories
                .AsNoTracking()
                .Include(h => h.Ticket)
                .AsQueryable();

            if (role == "reporter")
            {
                historyQuery = historyQuery.Where(h => h.Ticket.ReporterId == userId);
            }
            else if (role == "technician")
            {
                historyQuery = historyQuery.Where(h => h.Ticket.TechnicianId == userId);
            }

            var histories = await historyQuery
                .OrderByDescending(h => h.ChangedAt)
                .Take(12)
                .Select(h => new
                {
                    h.TicketId,
                    h.OldStatus,
                    h.NewStatus,
                    h.ChangedAt,
                    TicketTitle = h.Ticket.Title
                })
                .ToListAsync();

            if (!histories.Any())
                return;

            var actionBase = (role == "dispatcher" || role == "admin")
                ? "/ticket-management"
                : "/tickets/my";

            var generated = histories
                .Take(5)
                .Select(h => new Notification
                {
                    UserId = userId,
                    TicketId = h.TicketId,
                    Message = $"Ticket #{h.TicketId} ({h.TicketTitle}) changed status: {h.OldStatus ?? "UNKNOWN"} -> {h.NewStatus ?? "UNKNOWN"}",
                    Type = "ticket_update",
                    Severity = "info",
                    Source = "history-bootstrap",
                    ActionUrl = $"{actionBase}?ticketId={h.TicketId}",
                    IsRead = false,
                    CreatedAt = h.ChangedAt ?? DateTime.Now
                })
                .ToList();

            _context.Notifications.AddRange(generated);
            await _context.SaveChangesAsync();
        }

        [HttpGet("unread-count")]
        public async Task<ActionResult<int>> GetUnreadCount()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId))
                return Unauthorized();

            return await _context.Notifications
                .CountAsync(n => n.UserId == userId && !n.IsRead);
        }

        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound();

            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId) || notification.UserId != userId)
                return Forbid();

            notification.IsRead = true;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId))
                return Unauthorized();

            var unread = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var n in unread)
            {
                n.IsRead = true;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
