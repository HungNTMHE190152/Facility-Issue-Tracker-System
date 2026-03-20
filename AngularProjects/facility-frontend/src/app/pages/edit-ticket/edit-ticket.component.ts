import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { TicketService } from '../../services/ticket.service';
import { CategoryOption, UpdateTicketRequest } from '../../models/ticket.models';
import { Observable } from 'rxjs';
@Component({
	selector: 'app-edit-ticket',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './edit-ticket.component.html',
	styleUrl: './edit-ticket.component.css'
})
export class EditTicketComponent implements OnInit {
	ticketId = 0;
	categories: CategoryOption[] = [];
	loading = false;
	loadingTicket = true;
	isClosed = false;
	selectedImageName = '';
	popupVisible = false;
	popupTitle = '';
	popupMessage = '';
	popupType: 'success' | 'error' | 'warning' = 'success';
	private popupAfterClose?: () => void;

	private readonly titleMax = 200;
	private readonly descriptionMax = 1000;
	private readonly locationMax = 100;
	private readonly maxImageBytes = 2 * 1024 * 1024;
	private readonly targetImageDataUrlLength = 1_200_000;

	formData: UpdateTicketRequest = {
		title: '',
		description: '',
		location: '',
		priority: 2,
		categoryId: 0,
		imageBefore: ''
	};

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private ticketService: TicketService,
		private cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
		if (!this.ticketId) {
			this.router.navigate(['/my-ticket']);
			return;
		}

		this.loadCategories();
		this.loadTicket();
	}

	loadCategories(): void {
		this.ticketService.getCategories().subscribe({
			next: (res) => {
				this.categories = res;
			},
			error: () => {
				this.categories = [];
			}
		});
	}

	showPopup(title: string, message: string, type: 'success' | 'error' | 'warning', afterClose?: () => void): void {
		this.popupTitle = title;
		this.popupMessage = message;
		this.popupType = type;
		this.popupAfterClose = afterClose;
		this.popupVisible = true;
	}

	closePopup(): void {
		this.popupVisible = false;
		const callback = this.popupAfterClose;
		this.popupAfterClose = undefined;
		if (callback) {
			callback();
		}
	}

	loadTicket(): void {
		this.loadingTicket = true;
		this.ticketService.getTicketById(this.ticketId).subscribe({
			next: (ticket) => {
				this.isClosed = ticket.status?.toUpperCase() === 'CLOSED';
				this.formData = {
					title: ticket.title,
					description: ticket.description,
					location: ticket.location,
					priority: ticket.priority ?? 2,
					categoryId: ticket.categoryId,
					imageBefore: ticket.imageBefore ?? ''
				};
				this.selectedImageName = this.formData.imageBefore ? 'Current image' : '';
				this.loadingTicket = false;
				this.cdr.detectChanges();
			},
			error: (err) => {
				this.loadingTicket = false;
				this.cdr.detectChanges();
				this.showPopup('Error', err?.error?.message || err?.error || 'Cannot load ticket', 'error');
				  this.router.navigate(['/my-ticket']);
			}
		});
	}

	private enforceMaxLengths(): void {
		this.formData.title = (this.formData.title ?? '').slice(0, this.titleMax);
		this.formData.description = (this.formData.description ?? '').slice(0, this.descriptionMax);
		this.formData.location = (this.formData.location ?? '').slice(0, this.locationMax);
	}

	async onImageSelected(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			return;
		}

		if (!file.type.startsWith('image/')) {
			this.showPopup('Invalid file', 'Please select an image file', 'warning');
			input.value = '';
			return;
		}

		if (file.size > this.maxImageBytes) {
			this.showPopup('Image too large', 'Image size must be <= 2MB', 'warning');
			input.value = '';
			return;
		}

		this.selectedImageName = file.name;

		try {
			this.formData.imageBefore = await this.compressImageToDataUrl(file);
		} catch {
			this.showPopup('Error', 'Cannot process image file', 'error');
			this.clearImage(input);
		}
	}

	clearImage(input?: HTMLInputElement): void {
		this.formData.imageBefore = '';
		this.selectedImageName = '';
		if (input) {
			input.value = '';
		}
	}

	private async compressImageToDataUrl(file: File): Promise<string> {
		const bitmap = await this.readImage(file);

		const maxDimension = 1280;
		const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * ratio));
		const height = Math.max(1, Math.round(bitmap.height * ratio));

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Cannot create canvas context');
		}

		ctx.drawImage(bitmap, 0, 0, width, height);

		let quality = 0.86;
		let dataUrl = canvas.toDataURL('image/jpeg', quality);

		while (dataUrl.length > this.targetImageDataUrlLength && quality > 0.5) {
			quality -= 0.08;
			dataUrl = canvas.toDataURL('image/jpeg', quality);
		}

		return dataUrl;
	}

	private readImage(file: File): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const objectUrl = URL.createObjectURL(file);
			const image = new Image();

			image.onload = () => {
				URL.revokeObjectURL(objectUrl);
				resolve(image);
			};

			image.onerror = () => {
				URL.revokeObjectURL(objectUrl);
				reject(new Error('Invalid image file'));
			};

			image.src = objectUrl;
		});
	}

	submit(): void {
		if (this.loading) {
			return;
		}

		if (this.isClosed) {
			this.showPopup('Warning', 'Cannot update a closed ticket', 'warning');
			return;
		}

		this.enforceMaxLengths();

		if (!this.formData.title.trim() || !this.formData.description.trim() || !this.formData.location.trim() || !this.formData.categoryId) {
			this.showPopup('Missing data', 'Please fill all required fields', 'warning');
			return;
		}

		this.loading = true;
		this.ticketService.updateTicket(this.ticketId, {
			...this.formData,
			title: this.formData.title.trim(),
			description: this.formData.description.trim(),
			location: this.formData.location.trim(),
			imageBefore: this.formData.imageBefore?.trim() || null
		})
		.pipe(finalize(() => {
			this.loading = false;
			this.cdr.detectChanges();
		}))
		.subscribe({
			next: () => {
				this.showPopup('Success', 'Ticket updated successfully', 'success', () => {
					  this.router.navigate(['/tickets/my']);
				});
			},
			error: (err) => {
				this.showPopup('Error', err?.error?.message || err?.error || 'Update ticket failed', 'error');
			}
		});
	}

	downloadExcel(): void {
    this.ticketService.exportTickets().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Đặt tên file tải về
        a.download = `BaoCao_Ticket_${this.ticketId}_${new Date().getTime()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Lỗi xuất file:', err);
        alert('Không thể xuất file Excel!');
      }
    });
  }

  // --- HÀM NHẬP EXCEL ---
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.ticketService.importSupplies(file).subscribe({
        next: (res) => {
          alert(res.message || 'Nhập dữ liệu vật tư thành công!');
          event.target.value = ''; // Reset input
        },
        error: (err) => {
          console.error('Lỗi nhập file:', err);
          alert('Lỗi: ' + (err.error?.message || 'Không thể upload file Excel'));
        }
      });
    }
  }	
}
