using FacilityIssueTracker.Models;
using FacilityIssueTracker.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace FacilityIssueTracker.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Dispatcher, Admin")] // Chỉ Dispatcher và Admin mới được quản lý users
    public class UsersController : ControllerBase
    {
        private readonly AssContext _context;

        public UsersController(AssContext context)
        {
            _context = context;
        }

        // GET: api/Users
        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .Include(u => u.Role)
                .Select(u => new UserDTO
                {
                    UserId = u.UserId,
                    FullName = u.FullName,
                    Email = u.Email,
                    RoleId = u.RoleId,
                    RoleName = u.Role.RoleName
                })
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/Users/roles
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            var roles = await _context.Roles
                .Select(r => new { r.RoleId, r.RoleName })
                .ToListAsync();

            return Ok(roles);
        }

        // POST: api/Users
        [HttpPost]
        public async Task<IActionResult> CreateUser(CreateUserDTO dto)
        {
            if (await _context.Users.AnyAsync(x => x.Email == dto.Email))
                return BadRequest(new { message = "Email already exists" });

            var roleExists = await _context.Roles.AnyAsync(r => r.RoleId == dto.RoleId);
            if (!roleExists)
                return BadRequest(new { message = "Invalid Role ID" });

            var user = new User
            {
                FullName = dto.FullName,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                RoleId = dto.RoleId
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUsers), new { id = user.UserId }, new { message = "User created successfully" });
        }

        // PUT: api/Users/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, UpdateUserDTO dto)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
                return NotFound(new { message = "User not found" });

            // Check if Dispatcher is trying to edit another Dispatcher
            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var currentUserRoleStr = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            if (currentUserRoleStr == "Dispatcher")
            {
                var targetRole = await _context.Roles.FindAsync(user.RoleId);
                if (targetRole != null && targetRole.RoleName == "Dispatcher" && user.UserId.ToString() != currentUserIdStr)
                {
                    return StatusCode(403, new { message = "You do not have permission to modify another Dispatcher." });
                }

                if (dto.RoleId != user.RoleId)
                {
                    var newRoleCheck = await _context.Roles.FindAsync(dto.RoleId);
                    if (newRoleCheck != null && newRoleCheck.RoleName == "Dispatcher")
                    {
                        return StatusCode(403, new { message = "You cannot promote a user to Dispatcher." });
                    }
                }
            }

            // Check if email belongs to someone else
            if (await _context.Users.AnyAsync(x => x.Email == dto.Email && x.UserId != id))
                return BadRequest(new { message = "Email already in use by another user" });

            var roleExists = await _context.Roles.AnyAsync(r => r.RoleId == dto.RoleId);
            if (!roleExists)
                return BadRequest(new { message = "Invalid Role ID" });

            user.FullName = dto.FullName;
            user.Email = dto.Email;
            user.RoleId = dto.RoleId;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User updated successfully" });
        }

        // DELETE: api/Users/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
                return NotFound(new { message = "User not found" });

            // Check if Dispatcher is trying to delete another Dispatcher
            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var currentUserRoleStr = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            if (currentUserRoleStr == "Dispatcher")
            {
                var targetRole = await _context.Roles.FindAsync(user.RoleId);
                
                if (targetRole != null && targetRole.RoleName == "Dispatcher" && user.UserId.ToString() != currentUserIdStr)
                {
                    return StatusCode(403, new { message = "You do not have permission to delete another Dispatcher." });
                }
            }

            // Basic check: Cannot delete a user if they are heavily tied to tickets.
            // In a real system, you might soft delete or re-assign tickets.
            var hasTickets = await _context.Tickets.AnyAsync(t => t.ReporterId == id || t.TechnicianId == id || t.DispatcherId == id);
            var hasHistory = await _context.TicketHistories.AnyAsync(th => th.ChangedBy == id);

            if (hasTickets || hasHistory)
            {
                return BadRequest(new { message = "Cannot delete user. User has associated tickets or history." });
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User deleted successfully" });
        }
    }
}
