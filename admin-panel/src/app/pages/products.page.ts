import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

type Product = {
  id: number;
  sku: string;
  title_ka: string;
  title_en?: string | null;
  title_ru?: string | null;
  price_gel: number | string;   // your API returns "25.00" as string
  stock_qty: number | string;
  is_featured?: boolean;
  is_new?: boolean;
  is_sale?: boolean;
};

@Component({
  standalone: true,
  selector: 'app-products-page',
  imports: [CommonModule],
  template: `
    <div class="topbar">
      <h1>Products</h1>
      <button class="btn" (click)="load()">Reload</button>
    </div>

    <div *ngIf="loading">Loading...</div>
    <div *ngIf="error" class="error">{{ error }}</div>

    <div class="products" *ngIf="!loading">
      <div class="card" *ngFor="let p of products">
        <div class="sku">{{ p.sku }}</div>
        <div class="title">{{ p.title_ka }}</div>
        <div class="price">{{ p.price_gel }} GEL</div>
        <div class="stock">Stock: {{ p.stock_qty }}</div>
      </div>
    </div>
  `,
})
export class ProductsPage {
  private http = inject(HttpClient);

  products: Product[] = [];
  loading = false;
  error = '';

  private API = 'https://carparts-production.up.railway.app';

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';

    this.http.get<{ ok: boolean; items: Product[] }>(this.API).subscribe({
      next: (res) => {
        this.products = res.items ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'Failed to load products';
        this.loading = false;
      },
    });
  }
}