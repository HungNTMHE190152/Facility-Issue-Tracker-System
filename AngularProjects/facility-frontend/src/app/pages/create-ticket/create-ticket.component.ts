import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { CategoryOption, CreateTicketRequest } from '../../models/ticket.models';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-ticket.component.html',
  styleUrl: './create-ticket.component.css'
})
export class CreateTicketComponent implements OnInit {
  categories: CategoryOption[] = [];
  loading = false;

  formData: CreateTicketRequest = {
    title: '',
    description: '',
    location: '',
    priority: 2,
    categoryId: 0,
    imageBefore: ''
  };

  constructor(private ticketService: TicketService, private router: Router) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.ticketService.getCategories().subscribe({
      next: (res) => {
        this.categories = res;
      },
      error: () => {
        alert('Cannot load categories');
      }
    });
  }

  submit(): void {
    if (!this.formData.title.trim() || !this.formData.description.trim() || !this.formData.location.trim() || !this.formData.categoryId) {
      alert('Please fill all required fields');
      return;
    }

    this.loading = true;
    this.ticketService.createTicket({
      ...this.formData,
      title: this.formData.title.trim(),
      description: this.formData.description.trim(),
      location: this.formData.location.trim(),
      imageBefore: this.formData.imageBefore?.trim() || null
    }).subscribe({
      next: () => {
        this.loading = false;
        alert('Create ticket successfully');
        this.router.navigate(['/tickets/my']);
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.message || err?.error || 'Create ticket failed');
      }
    });
  }
}
