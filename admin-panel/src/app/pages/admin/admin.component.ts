import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../models/product';
import { AdminAuthService } from '../../services/auth.service';

type Brand = { id: number; name: string; slug: string; logo_url?: string | null };
type CarModel = { id: number; brand_id: number; name: string; slug: string };

type ProductForm = {
  sku: string;
  title_ka: string;
  price_gel: number;
  stock_qty: number;
  model_id: number | null;
  image_url: string; // ✅ NEW
};

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AdminAuthService);

  readonly API_BASE = 'http://localhost:5000/api';
  readonly API_LIST = `${this.API_BASE}/products`;
  readonly API_ADMIN = `${this.API_BASE}/admin/products`;

  products: Product[] = [];

  // search
  searchText = '';
  private lastSearch = '';

  // brands/models
  brands: Brand[] = [];
  models: CarModel[] = [];
  selectedBrandId: number | null = null;

  // form
  showForm = false;
  editingId: number | null = null;

  form: ProductForm = {
    sku: '',
    title_ka: '',
    price_gel: 0,
    stock_qty: 0,
    model_id: null,
    image_url: '',
  };

  loading = false;
  error = '';

  ngOnInit(): void {
    // ✅ if not logged in, go to admin-login
    if (!this.auth.isAdmin()) {
      this.router.navigateByUrl('/admin-login');
      return;
    }

    this.loadBrands();
    this.load();
  }

  private authHeaders() {
    const token = localStorage.getItem('admin_token') || '';
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  // ---------- BRANDS / MODELS ----------
  loadBrands(): void {
    this.http.get<{ ok: boolean; items: Brand[] }>(`${this.API_BASE}/brands`).subscribe({
      next: (res) => (this.brands = res.items ?? []),
      error: (err) => console.error('Brands load failed', err),
    });
  }

  private loadModelsByBrand(brandId: number): void {
    this.http
      .get<{ ok: boolean; items: CarModel[] }>(`${this.API_BASE}/brands/${brandId}/models`)
      .subscribe({
        next: (res) => (this.models = res.items ?? []),
        error: (err) => console.error('Models load failed', err),
      });
  }

  onBrandChange(): void {
    this.form.model_id = null;
    this.models = [];
    if (this.selectedBrandId) this.loadModelsByBrand(this.selectedBrandId);
  }

  // ---------- LIST + SEARCH ----------
  load(search: string = this.lastSearch): void {
    this.loading = true;
    this.error = '';

    this.lastSearch = (search || '').trim();

    const params: string[] = [];
    if (this.lastSearch) params.push(`search=${encodeURIComponent(this.lastSearch)}`);
    params.push(`_=${Date.now()}`); // Safari cache bust

    const url = `${this.API_LIST}?${params.join('&')}`;

    this.http.get<{ ok: boolean; items: Product[] }>(url).subscribe({
      next: (res) => {
        this.products = res.items ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Load failed', err);
        this.error = 'Failed to load products';
        this.loading = false;
      },
    });
  }

  doSearch(): void {
    this.load(this.searchText);
  }

  clear(): void {
    this.searchText = '';
    this.load('');
  }

  // ---------- FORM ----------
  openCreate(): void {
    this.editingId = null;
    this.resetForm();
    this.showForm = true;
  }

  openEdit(p: Product): void {
    this.editingId = p.id;

    this.form = {
      sku: p.sku,
      title_ka: p.title_ka,
      price_gel: Number(p.price_gel) || 0,
      stock_qty: Number(p.stock_qty) || 0,
      model_id: p.model_id ?? null,
      image_url: p.image_url ?? '',
    };

    // keep it simple: brand selector resets on edit (you can improve later)
    this.selectedBrandId = null;
    this.models = [];
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.resetForm();
  }

  resetForm(): void {
    this.form = {
      sku: '',
      title_ka: '',
      price_gel: 0,
      stock_qty: 0,
      model_id: null,
      image_url: '',
    };
    this.selectedBrandId = null;
    this.models = [];
  }

  saveProduct(): void {
    const payload = {
      sku: this.form.sku.trim(),
      title_ka: this.form.title_ka.trim(),
      price_gel: Number(this.form.price_gel) || 0,
      stock_qty: Number(this.form.stock_qty) || 0,
      model_id: this.form.model_id != null ? Number(this.form.model_id) : null,
      image_url: this.form.image_url.trim() || null, // ✅ NEW
    };

    if (!payload.sku || !payload.title_ka) {
      alert('SKU and Title (KA) are required');
      return;
    }

    // ✅ CREATE
    if (this.editingId === null) {
      this.http.post(this.API_ADMIN, payload, this.authHeaders()).subscribe({
        next: () => {
          this.closeForm();
          this.load();
        },
        error: (err) => console.error('Create failed', err),
      });
      return;
    }

    // ✅ UPDATE
    this.http.put(`${this.API_ADMIN}/${this.editingId}`, payload, this.authHeaders()).subscribe({
      next: () => {
        this.closeForm();
        this.load();
      },
      error: (err) => console.error('Update failed', err),
    });
  }

  deleteProduct(p: Product): void {
    if (!confirm(`Delete product ${p.sku}?`)) return;

    this.http.delete(`${this.API_ADMIN}/${p.id}`, this.authHeaders()).subscribe({
      next: () => this.load(),
      error: (err) => console.error('Delete failed', err),
    });
  }
}