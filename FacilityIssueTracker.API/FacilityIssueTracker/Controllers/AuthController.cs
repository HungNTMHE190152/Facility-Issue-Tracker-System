using FacilityIssueTracker.Models;
using FacilityIssueTracker.DTOs;
using FacilityIssueTracker.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using BCrypt.Net;
using Microsoft.Extensions.Caching.Memory;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private const string RegisterOtpCachePrefix = "register-otp:";

    private readonly AssContext _context;
    private readonly JwtService _jwt;
    private readonly IEmailService _emailService;
    private readonly IMemoryCache _cache;

    public AuthController(AssContext context, JwtService jwt, IEmailService emailService, IMemoryCache cache)
    {
        _context = context;
        _jwt = jwt;
        _emailService = emailService;
        _cache = cache;
    }

    // ================= REGISTER =================
    [HttpPost("register/send-otp")]
    public async Task<IActionResult> SendRegisterOtp(ForgotPasswordDTO dto)
    {
        var email = (dto.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email is required." });

        if (await _context.Users.AnyAsync(x => x.Email == email))
            return BadRequest(new { message = "Email already exists" });

        var otp = Random.Shared.Next(100000, 999999).ToString();
        _cache.Set(RegisterOtpCachePrefix + email.ToLowerInvariant(), otp, TimeSpan.FromMinutes(5));

        Console.WriteLine($"\n[DEBUG REGISTER OTP] FOR EMAIL {email} IS: {otp}\n");

        var subject = "Facility Issue Tracker - Registration OTP";
        var body = $"<h3>Your registration OTP is: <strong>{otp}</strong></h3><p>This OTP expires in 5 minutes.</p>";
        _ = Task.Run(() => _emailService.SendEmailAsync(email, subject, body));

        return Ok(new { message = "OTP has been sent to your email." });
    }

    [HttpPost("register/verify-otp")]
    public async Task<IActionResult> VerifyRegisterOtp(VerifyOtpDTO dto)
    {
        var email = (dto.Email ?? string.Empty).Trim();
        var otp = (dto.Otp ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email is required." });

        if (string.IsNullOrWhiteSpace(otp))
            return BadRequest(new { message = "OTP is required." });

        if (!_cache.TryGetValue(RegisterOtpCachePrefix + email.ToLowerInvariant(), out string? cachedOtp)
            || string.IsNullOrWhiteSpace(cachedOtp)
            || !string.Equals(cachedOtp, otp, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "Invalid or expired OTP." });
        }

        return Ok(new { message = "OTP verified successfully." });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDTO dto)
    {
        var email = (dto.Email ?? string.Empty).Trim();
        var otp = (dto.Otp ?? string.Empty).Trim();

        if (await _context.Users.AnyAsync(x => x.Email == email))
            return BadRequest("Email already exists");

        if (!_cache.TryGetValue(RegisterOtpCachePrefix + email.ToLowerInvariant(), out string? cachedOtp)
            || string.IsNullOrWhiteSpace(cachedOtp)
            || !string.Equals(cachedOtp, otp, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "Invalid or expired registration OTP." });
        }

        // mặc định role Reporter (id = 2 ví dụ)
        var role = await _context.Roles
            .FirstOrDefaultAsync(r => r.RoleName == "Reporter");

        if (role == null)
            return BadRequest("Role not found");

        var user = new User
        {
            FullName = dto.FullName,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            RoleId = role.RoleId
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        _cache.Remove(RegisterOtpCachePrefix + email.ToLowerInvariant());

        // US-43: Email Notification khi tài khoản mới được tạo
        var subject = "Welcome to Facility Issue Tracker";
        var body = $@"
<div style=""font-family:Arial,Helvetica,sans-serif;line-height:1.4"">
  <h2 style=""margin:0 0 12px 0"">Facility Issue Tracker</h2>
  <p>Chào <strong>{System.Net.WebUtility.HtmlEncode(dto.FullName)}</strong>,</p>
  <p>Tài khoản của bạn đã được tạo thành công.</p>
</div>";
        _ = Task.Run(() => _emailService.SendEmailAsync(email, subject, body));

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
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized("Invalid token user information");

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

        if (user == null)
            return NotFound("Không tìm thấy người dùng");

        return Ok(user);
    }

    // ================= CHANGE PASSWORD =================
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDTO dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized("Invalid token user information");

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound("Không tìm thấy người dùng");

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

    // ================= FORGOT PASSWORD =================
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordDTO dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (user == null)
            return BadRequest(new { message = "Email does not exist in the system." });

        var otp = new Random().Next(100000, 999999).ToString();
        user.ResetPasswordOTP = otp;
        user.ResetPasswordOTPExpiry = DateTime.UtcNow.AddMinutes(5);

        _context.Users.Update(user);
        await _context.SaveChangesAsync();

        // Log ra Console để test nhanh khi chưa có cấu hình Email thật
        Console.WriteLine($"\n[DEBUG OTP] FOR EMAIL {dto.Email} IS: {otp}\n");

        var subject = "Facility Issue Tracker - Mã lấy lại mật khẩu";
        var body = $"<h3>Mã OTP của bạn là: <strong>{otp}</strong></h3><p>Mã này sẽ hết hạn trong 5 phút.</p>";
        
        // Chạy ngầm việc gửi email để không làm treo luồng request của người dùng (nếu host/port email sai)
        _ = Task.Run(() => _emailService.SendEmailAsync(dto.Email, subject, body));

        return Ok(new { message = "OTP has been sent to your email." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordDTO dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (user == null)
            return BadRequest(new { message = "Email does not exist in the system." });

        if (user.ResetPasswordOTP != dto.Otp || user.ResetPasswordOTPExpiry < DateTime.UtcNow)
            return BadRequest(new { message = "Mã OTP không hợp lệ hoặc đã hết hạn." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.ResetPasswordOTP = null;
        user.ResetPasswordOTPExpiry = null;

        _context.Users.Update(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Mật khẩu đã được đặt lại thành công." });
    }
}