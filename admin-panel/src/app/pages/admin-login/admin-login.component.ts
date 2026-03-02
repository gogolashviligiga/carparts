import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { AdminAuthService } from '../../services/auth.service';

type AdminLoginResponse = {
  ok: boolean;
  token?: string;
  error?: string;
};

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css'],
})
export class AdminLoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);
  private router = inject(Router);

  private API = 'https://carparts-production.up.railway.app';

  login(): void {
    if (this.loading) return;

    this.error = '';
    const email = this.email.trim();
    const password = this.password.trim();

    if (!email || !password) {
      this.error = 'Email and password are required';
      return;
    }

    this.loading = true;

    this.http
      .post<AdminLoginResponse>(`${this.API}/admin/login`, { email, password })
      .subscribe({
        next: (res) => {
          this.loading = false;

          if (!res?.ok || !res.token) {
            this.error = res?.error || 'Login failed';
            return;
          }

          // ✅ Set token and go to orders
          this.auth.setToken(res.token);
          this.router.navigateByUrl('/admin/orders');
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.error = (err.error as any)?.error || 'Server error';
        },
      });
  }
}