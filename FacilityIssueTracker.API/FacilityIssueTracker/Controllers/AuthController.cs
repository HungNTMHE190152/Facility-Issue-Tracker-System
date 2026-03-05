using FacilityIssueTracker.Models;
using FacilityIssueTracker.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using BCrypt.Net;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly AssContext _context;
    private readonly JwtService _jwt;

    public AuthController(AssContext context, JwtService jwt)
    {
        _context = context;
        _jwt = jwt;
    }

    // ================= REGISTER =================
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDTO dto)
    {
        if (await _context.Users.AnyAsync(x => x.Email == dto.Email))
            return BadRequest("Email already exists");

        // mặc định role Reporter (id = 2 ví dụ)
        var role = await _context.Roles
            .FirstOrDefaultAsync(r => r.RoleName == "Reporter");

        if (role == null)
            return BadRequest("Role not found");

        var user = new User
        {
            FullName = dto.FullName,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            RoleId = role.RoleId
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok("Registered successfully");
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDTO dto)
    {
        var user = await _context.Users
            .Include(x => x.Role)
            .FirstOrDefaultAsync(x => x.Email == dto.Email);

        if (user == null)
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng" });

        var isPasswordValid = false;
        try
        {
            isPasswordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
        }
        catch (SaltParseException)
        {
            isPasswordValid = user.PasswordHash == dto.Password;
        }

        if (!isPasswordValid)
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng" });

        var token = _jwt.GenerateToken(user);

        return Ok(new
        {
            token,
            fullName = user.FullName,     // ← frontend dùng key này
            role = user.Role.RoleName     // ← frontend dùng key này
        });
    }

    // ================= PROFILE =================
    [Authorize]
    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

        var user = await _context.Users
            .Include(x => x.Role)
            .Where(x => x.UserId == userId)
            .Select(x => new
            {
                x.UserId,
                x.FullName,
                x.Email,
                Role = x.Role.RoleName
            })
            .FirstOrDefaultAsync();

        return Ok(user);
    }

    // ================= CHANGE PASSWORD =================
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDTO dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

        var user = await _context.Users.FindAsync(userId);

        if (!BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash))
            return BadRequest("Wrong password");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

        await _context.SaveChangesAsync();

        return Ok("Password changed successfully");
    }

    // ================= GET ALL USERS (ADMIN) =================
    [Authorize(Roles = "Admin")]
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .Include(x => x.Role)
            .Select(x => new
            {
                x.UserId,
                x.FullName,
                x.Email,
                Role = x.Role.RoleName
            })
            .ToListAsync();

        return Ok(users);
    }

    // Thêm DTO nếu chưa có (đã tạo ở bước 1, giờ dùng nó)
    // PUT: api/Auth/profile - Cập nhật thông tin profile
    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDTO dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
        {
            return Unauthorized("Không tìm thấy thông tin người dùng trong token");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
            return NotFound("Không tìm thấy người dùng");

        // Cập nhật các trường được phép thay đổi
        if (!string.IsNullOrWhiteSpace(dto.FullName))
            user.FullName = dto.FullName.Trim();


        // Lưu thay đổi vào database
        _context.Users.Update(user);
        await _context.SaveChangesAsync();

        // Trả về thông tin đã cập nhật
        return Ok(new
        {
            message = "Cập nhật hồ sơ thành công",
            fullName = user.FullName,
            role = (await _context.Roles.FindAsync(user.RoleId))?.RoleName ?? "Reporter"
        });
    }
}