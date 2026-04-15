namespace FacilityIssueTracker.DTOs
{
    public class VerifyOtpDTO
    {
        public required string Email { get; set; }
        public required string Otp { get; set; }
    }
}
