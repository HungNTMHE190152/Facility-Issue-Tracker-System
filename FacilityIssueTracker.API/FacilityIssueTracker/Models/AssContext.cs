using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace FacilityIssueTracker.Models;

public partial class AssContext : DbContext
{
    public AssContext()
    {
    }

    public AssContext(DbContextOptions<AssContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Category> Categories { get; set; }

    public virtual DbSet<Review> Reviews { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<Supply> Supplies { get; set; }

    public virtual DbSet<Ticket> Tickets { get; set; }

    public virtual DbSet<TicketHistory> TicketHistories { get; set; }

    public virtual DbSet<TicketSupply> TicketSupplies { get; set; }

    public virtual DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.CategoryId).HasName("PK__Categori__19093A2B478413BD");

            entity.HasIndex(e => e.CategoryName, "UQ__Categori__8517B2E0F7C6157F").IsUnique();

            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.CategoryName).HasMaxLength(50);
        });

        modelBuilder.Entity<Review>(entity =>
        {
            entity.HasKey(e => e.ReviewId).HasName("PK__Reviews__74BC79AEF64A8DB3");

            entity.HasIndex(e => e.TicketId, "UQ__Reviews__712CC6260BCADC2F").IsUnique();

            entity.Property(e => e.ReviewId).HasColumnName("ReviewID");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.TicketId).HasColumnName("TicketID");

            entity.HasOne(d => d.Ticket).WithOne(p => p.Review)
                .HasForeignKey<Review>(d => d.TicketId)
                .HasConstraintName("FK__Reviews__TicketI__4BAC3F29");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.RoleId).HasName("PK__Roles__8AFACE3AE3F2F6B0");

            entity.HasIndex(e => e.RoleName, "UQ__Roles__8A2B616051E223DD").IsUnique();

            entity.Property(e => e.RoleId).HasColumnName("RoleID");
            entity.Property(e => e.RoleName).HasMaxLength(50);
        });

        modelBuilder.Entity<Supply>(entity =>
        {
            entity.HasKey(e => e.SupplyId).HasName("PK__Supplies__7CDD6C8ED76DC52A");

            entity.Property(e => e.SupplyId).HasColumnName("SupplyID");
            entity.Property(e => e.StockQuantity).HasDefaultValue(0);
            entity.Property(e => e.SupplyName).HasMaxLength(100);
            entity.Property(e => e.Unit).HasMaxLength(20);
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(18, 2)");
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.HasKey(e => e.TicketId).HasName("PK__Tickets__712CC62747E900DB");

            entity.Property(e => e.TicketId).HasColumnName("TicketID");
            entity.Property(e => e.AssignedAt).HasColumnType("datetime");
            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.ClosedAt).HasColumnType("datetime");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DispatcherId).HasColumnName("DispatcherID");
            entity.Property(e => e.Location).HasMaxLength(100);
            entity.Property(e => e.ReporterId).HasColumnName("ReporterID");
            entity.Property(e => e.ResolvedAt).HasColumnType("datetime");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("OPEN");
            entity.Property(e => e.TechnicianId).HasColumnName("TechnicianID");
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.Category).WithMany(p => p.Tickets)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Tickets__Categor__45F365D3");

            entity.HasOne(d => d.Dispatcher).WithMany(p => p.TicketDispatchers)
                .HasForeignKey(d => d.DispatcherId)
                .HasConstraintName("FK__Tickets__Dispatc__47DBAE45");

            entity.HasOne(d => d.Reporter).WithMany(p => p.TicketReporters)
                .HasForeignKey(d => d.ReporterId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Tickets__Reporte__44FF419A");

            entity.HasOne(d => d.Technician).WithMany(p => p.TicketTechnicians)
                .HasForeignKey(d => d.TechnicianId)
                .HasConstraintName("FK__Tickets__Technic__46E78A0C");
        });

        modelBuilder.Entity<TicketHistory>(entity =>
        {
            entity.HasKey(e => e.HistoryId).HasName("PK__TicketHi__4D7B4ADDCF175655");

            entity.ToTable("TicketHistory");

            entity.Property(e => e.HistoryId).HasColumnName("HistoryID");
            entity.Property(e => e.ChangedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.OldStatus)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.TicketId).HasColumnName("TicketID");

            entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.TicketHistories)
                .HasForeignKey(d => d.ChangedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__TicketHis__Chang__5CD6CB2B");

            entity.HasOne(d => d.Ticket).WithMany(p => p.TicketHistories)
                .HasForeignKey(d => d.TicketId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__TicketHis__Ticke__59FA5E80");
        });

        modelBuilder.Entity<TicketSupply>(entity =>
        {
            entity.HasKey(e => new { e.TicketId, e.SupplyId }).HasName("PK__TicketSu__86E110EF85918827");

            entity.Property(e => e.TicketId).HasColumnName("TicketID");
            entity.Property(e => e.SupplyId).HasColumnName("SupplyID");

            entity.HasOne(d => d.Supply).WithMany(p => p.TicketSupplies)
                .HasForeignKey(d => d.SupplyId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__TicketSup__Suppl__571DF1D5");

            entity.HasOne(d => d.Ticket).WithMany(p => p.TicketSupplies)
                .HasForeignKey(d => d.TicketId)
                .HasConstraintName("FK__TicketSup__Ticke__5629CD9C");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PK__Users__1788CCAC8BFADF03");

            entity.HasIndex(e => e.Email, "UQ__Users__A9D105348ACF9BE5").IsUnique();

            entity.Property(e => e.UserId).HasColumnName("UserID");
            entity.Property(e => e.Email)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.FullName).HasMaxLength(100);
            entity.Property(e => e.PasswordHash).IsUnicode(false);
            entity.Property(e => e.RoleId).HasColumnName("RoleID");

            entity.HasOne(d => d.Role).WithMany(p => p.Users)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Users__RoleID__3B75D760");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
