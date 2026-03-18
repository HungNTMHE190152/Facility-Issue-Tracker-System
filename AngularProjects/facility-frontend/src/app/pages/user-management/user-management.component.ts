import { Component, OnInit, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, User, Role } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.css'],
    providers: [UserService]
})
export class UserManagementComponent implements OnInit {
    users: User[] = [];
    roles: Role[] = [];
    isLoading: boolean = false;

    // Filter & Search State
    searchTerm: string = '';
    selectedRoleId: number | string = '';

    // Modal State
    showModal: boolean = false;
    isEditMode: boolean = false;
    modalTitle: string = '';

    // Logged in user state
    currentUserRole: string = '';

    // Current Form User
    currentUser: Partial<User> & { password?: string } = {};

    // Confirm Modal State
    showConfirmModal: boolean = false;
    userToDelete: User | null = null;

    // Pagination
    currentPage: number = 1;
    itemsPerPage: number = 10;

    get filteredUsers(): User[] {
        return this.users.filter(user => {
            const matchesSearch = user.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
                                  user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
            const matchesRole = this.selectedRoleId === '' || user.roleId === Number(this.selectedRoleId);
            return matchesSearch && matchesRole;
        });
    }

    get totalPages(): number {
        return Math.ceil(this.filteredUsers.length / this.itemsPerPage) || 1;
    }

    get paginatedUsers(): User[] {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.filteredUsers.slice(start, start + this.itemsPerPage);
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
        }
    }

    onFilterChange() {
        this.currentPage = 1; // Reset to page 1 when filtering/searching
    }

    constructor(
        @Inject(UserService) private userService: UserService,
        private notificationService: NotificationService,
        private cdr: ChangeDetectorRef,
        private router: Router
    ) { 
        // Giả sử thông tin role được lưu dưới dạng 'Role' hoặc 'role' trong localStorage
        this.currentUserRole = localStorage.getItem('role') || '';
    }

    ngOnInit(): void {
        this.loadUsers();
        this.loadRoles();
    }

    goBack() {
        this.router.navigate(['/dispatcher-dashboard']);
    }

    loadUsers() {
        this.isLoading = true;
        this.userService.getUsers().subscribe({
            next: (res) => {
                this.users = res;
                
                // Maintain current page, but ensure it's still valid
                if (this.currentPage > this.totalPages && this.totalPages > 0) {
                    this.currentPage = this.totalPages;
                } else if (this.users.length > 0 && this.currentPage < 1) {
                    this.currentPage = 1;
                }

                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.notificationService.error('Error loading users');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    loadRoles() {
        this.userService.getRoles().subscribe({
            next: (res) => {
                this.roles = res;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading roles', err);
            }
        });
    }

    openCreateModal() {
        this.isEditMode = false;
        this.modalTitle = 'Add New User';
        // Default RoleId = 2 (Reporter) if roles exist
        const defaultRoleId = this.roles.length > 0 ? this.roles.find(r => r.roleName === 'Reporter')?.roleId || this.roles[0].roleId : 0;

        this.currentUser = {
            fullName: '',
            email: '',
            password: '',
            roleId: defaultRoleId
        };
        this.showModal = true;
    }

    openEditModal(user: User) {
        if (this.currentUserRole === 'Dispatcher' && user.roleName === 'Dispatcher') {
            this.notificationService.error('You do not have permission to modify another Dispatcher.');
            return;
        }
        
        this.isEditMode = true;
        this.modalTitle = 'Edit User';
        this.currentUser = { ...user };
        this.showModal = true;
    }

    closeModal() {
        this.showModal = false;
        this.currentUser = {};
        this.cdr.detectChanges();
    }

    saveUser() {
        // Granular Validation
        if (!this.currentUser.fullName || !this.currentUser.fullName.trim()) {
            this.notificationService.error('Full Name is required.');
            return;
        }

        if (this.currentUser.fullName.length > 30) {
            this.notificationService.error(`Full Name is too long (${this.currentUser.fullName.length}/30).`);
            return;
        }

        if (!this.currentUser.email || !this.currentUser.email.trim()) {
            this.notificationService.error('Email address is required.');
            return;
        }

        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
        if (!emailPattern.test(this.currentUser.email)) {
            this.notificationService.error('Invalid email format (e.g., user@domain.com).');
            return;
        }

        if (!this.currentUser.roleId) {
            this.notificationService.error('Please select a Role for the user.');
            return;
        }

        if (!this.isEditMode && (!this.currentUser.password || !this.currentUser.password.trim())) {
            this.notificationService.error('Password is required for new accounts.');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        if (this.isEditMode) {
            const updateData = {
                fullName: this.currentUser.fullName as string,
                email: this.currentUser.email as string,
                roleId: Number(this.currentUser.roleId)
            };

            this.userService.updateUser(this.currentUser.userId!, updateData).subscribe({
                next: (res) => {
                    this.notificationService.success('User updated successfully');
                    this.closeModal();
                    this.loadUsers();
                },
                error: (err) => {
                    this.notificationService.error(err.error?.message || 'Error updating user');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        } else {
            if (!this.currentUser.password) {
                this.notificationService.error('Password is required when creating a new user');
                this.isLoading = false;
                this.cdr.detectChanges();
                return;
            }

            const createData = {
                fullName: this.currentUser.fullName as string,
                email: this.currentUser.email as string,
                password: this.currentUser.password,
                roleId: Number(this.currentUser.roleId)
            };

            this.userService.createUser(createData).subscribe({
                next: (res) => {
                    this.notificationService.success('New user created successfully');
                    this.closeModal();
                    this.loadUsers();
                },
                error: (err) => {
                    this.notificationService.error(err.error?.message || 'Error creating user');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }

    deleteUser(user: User) {
        if (this.currentUserRole === 'Dispatcher' && user.roleName === 'Dispatcher') {
            this.notificationService.error('You do not have permission to delete another Dispatcher.');
            return;
        }

        this.userToDelete = user;
        this.showConfirmModal = true;
    }

    closeConfirmModal() {
        this.showConfirmModal = false;
        this.userToDelete = null;
        this.cdr.detectChanges();
    }

    confirmDelete() {
        if (!this.userToDelete) return;

        this.isLoading = true;
        this.cdr.detectChanges();

        this.userService.deleteUser(this.userToDelete.userId).subscribe({
            next: (res) => {
                this.isLoading = false;
                this.notificationService.success('User deleted successfully');
                this.closeConfirmModal();
                this.loadUsers();
            },
            error: (err) => {
                console.error("Delete user error:", err);
                this.isLoading = false;
                this.notificationService.error(err.error?.message || 'Cannot delete user because they have associated data.');
                this.closeConfirmModal();
                this.cdr.detectChanges();
            }
        });
    }

}
