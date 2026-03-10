import { Component, OnInit, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, User, Role } from '../../services/user.service';

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

    // Alert
    alertMessage: string = '';
    isError: boolean = false;

    // Pagination
    currentPage: number = 1;
    itemsPerPage: number = 10;

    get totalPages(): number {
        return Math.ceil(this.users.length / this.itemsPerPage);
    }

    get paginatedUsers(): User[] {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.users.slice(start, start + this.itemsPerPage);
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
        }
    }

    constructor(
        @Inject(UserService) private userService: UserService,
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
                this.currentPage = 1; // Reset to page 1
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.showAlert('Error loading users', true);
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
            this.showAlert('You do not have permission to modify another Dispatcher.', true);
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
        if (!this.currentUser.fullName || !this.currentUser.email || !this.currentUser.roleId) {
            this.showAlert('Please fill in all required fields.', true);
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
                    this.showAlert('User updated successfully', false);
                    this.closeModal();
                    this.loadUsers();
                },
                error: (err) => {
                    this.showAlert(err.error?.message || 'Error updating user', true);
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        } else {
            if (!this.currentUser.password) {
                this.showAlert('Password is required when creating a new user', true);
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
                    this.showAlert('New user created successfully', false);
                    this.closeModal();
                    this.loadUsers();
                },
                error: (err) => {
                    this.showAlert(err.error?.message || 'Error creating user', true);
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }

    deleteUser(user: User) {
        if (this.currentUserRole === 'Dispatcher' && user.roleName === 'Dispatcher') {
            this.showAlert('You do not have permission to delete another Dispatcher.', true);
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
                this.showAlert('User deleted successfully', false);
                this.closeConfirmModal();
                this.loadUsers();
            },
            error: (err) => {
                console.error("Delete user error:", err);
                this.isLoading = false;
                this.showAlert(err.error?.message || 'Cannot delete user because they have associated data.', true);
                this.closeConfirmModal();
                this.cdr.detectChanges();
            }
        });
    }

    showAlert(msg: string, isErr: boolean) {
        this.alertMessage = msg;
        this.isError = isErr;
        setTimeout(() => {
            this.alertMessage = '';
        }, 5000);
    }
}
