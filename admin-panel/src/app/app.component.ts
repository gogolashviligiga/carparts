import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';

import { CartService } from './services/cart.service';
import { AdminAuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  cart = inject(CartService);
  auth = inject(AdminAuthService);
  router = inject(Router);

  year = new Date().getFullYear();

  // ✅ reactive (updates UI immediately when token changes)
  isAdmin$: Observable<boolean> = this.auth.isAdmin$;

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/'); // ✅ important
  }
}