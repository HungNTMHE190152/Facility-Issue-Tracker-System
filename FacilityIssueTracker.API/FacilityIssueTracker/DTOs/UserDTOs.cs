namespace FacilityIssueTracker.DTOs
{
    public class UserDTO
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public int RoleId { get; set; }
        public string RoleName { get; set; } = null!;
    }

    public class CreateUserDTO
    {
        public string FullName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public int RoleId { get; set; }
    }

    public class UpdateUserDTO
    {
        public string FullName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public int RoleId { get; set; }
    }
}
