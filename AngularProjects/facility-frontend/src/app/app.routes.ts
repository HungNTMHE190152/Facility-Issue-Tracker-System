import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
    { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
    { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
    { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) },
    { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
    { path: 'change-password', loadComponent: () => import('./pages/change-password/change-password.component').then(m => m.ChangePasswordComponent) },
    { path: 'tickets/create', loadComponent: () => import('./pages/create-ticket/create-ticket.component').then(m => m.CreateTicketComponent) },
    { path: 'tickets/my', loadComponent: () => import('./pages/my-tickets/my-tickets.component').then(m => m.MyTicketsComponent) },
    { path: 'manager', loadComponent: () => import('./pages/dispatcher-dashboard/dispatcher-dashboard.component').then(m => m.DispatcherDashboardComponent) },
    { path: 'manager/statistics', loadComponent: () => import('./pages/manager-statistics/manager-statistics.component').then(m => m.ManagerStatisticsComponent) },
    { path: 'dispatcher-dashboard', redirectTo: 'manager', pathMatch: 'full' },
    { path: 'technician-dashboard', loadComponent: () => import('./pages/technician-dashboard/technician-dashboard.component').then(m => m.TechnicianDashboardComponent) },
    { path: 'missions', loadComponent: () => import('./pages/missions/missions.component').then(m => m.MissionsComponent) },
    { path: 'user-management', loadComponent: () => import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent) },
    { path: 'ticket-management', loadComponent: () => import('./pages/ticket-management/ticket-management.component').then(m => m.TicketManagementComponent) },
    { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
    { path: 'tickets/edit/:id', loadComponent: () => import('./pages/edit-ticket/edit-ticket.component').then(m => m.EditTicketComponent) },
    { path: '**', redirectTo: '' }
];
