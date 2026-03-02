import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';

type Brand = {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
};

type CarModel = {
  id: number;
  brand_id: number;
  name: string;
  slug: string;
};

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './products.component.html',
})
export class ProductsComponent implements OnInit {
  readonly API_BASE = 'https://carparts-production.up.railway.app/api';

  products: Product[] = [];

  // Search
  searchText = '';
  private lastSearch = '';

  // Brand/Model filter
  brands: Brand[] = [];
  models: CarModel[] = [];
  selectedBrandId: number | null = null;
  selectedModelId: number | null = null;

  // Dropdown UI
  brandOpen = false;
  modelOpen = false;

  // Loading/error
  loading = false;
  error = '';

  constructor(private http: HttpClient, public cart: CartService) {}

  ngOnInit() {
    this.loadBrands();
    this.loadProducts(); // initial list
  }

  // -------------------- GLOBAL CLOSE (outside click / ESC) --------------------

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    if (!target.closest('.brand-dd')) this.brandOpen = false;
    if (!target.closest('.model-dd')) this.modelOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.brandOpen = false;
    this.modelOpen = false;
  }

  toastMsg = '';
toastVisible = false;
private toastTimer: any;

toast(msg: string) {
  this.toastMsg = msg;
  this.toastVisible = true;
  clearTimeout(this.toastTimer);
  this.toastTimer = setTimeout(() => (this.toastVisible = false), 2200);
}

  // -------------------- BRAND HELPERS --------------------

  brandLogo(b: Brand): string {
    if (b.logo_url) return b.logo_url;
    return `/brands/${b.slug}.png`;
  }

  get selectedBrand(): Brand | null {
    return this.brands.find((b) => b.id === this.selectedBrandId) || null;
  }

  get selectedBrandName(): string {
    return this.selectedBrand ? this.selectedBrand.name : 'All brands';
  }

  // Return '' for All brands so <img *ngIf="selectedBrandLogo"> hides it
  get selectedBrandLogo(): string {
    if (!this.selectedBrand) return '';
    return this.brandLogo(this.selectedBrand);
  }

  // -------------------- MODEL LABEL --------------------

  get selectedModelLabel(): string {
    if (!this.selectedBrandId) return 'Select brand to enable models';
    if (!this.selectedModelId) return 'All models';
    const m = this.models.find((x) => x.id === this.selectedModelId);
    return m ? m.name : 'All models';
  }

  // -------------------- DROPDOWN ACTIONS --------------------

  toggleBrandDropdown(): void {
    if (this.loading) return;
    this.brandOpen = !this.brandOpen;
    if (this.brandOpen) this.modelOpen = false; // only one open at a time
  }

  toggleModelDropdown(): void {
    if (this.loading || !this.selectedBrandId || this.models.length === 0) return;
    this.modelOpen = !this.modelOpen;
    if (this.modelOpen) this.brandOpen = false; // only one open at a time
  }

  selectBrand(b: Brand | null) {
    // Close dropdowns
    this.brandOpen = false;
    this.modelOpen = false;

    // Reset model state always when brand changes
    this.selectedModelId = null;
    this.models = [];

    if (!b) {
      // All brands
      this.selectedBrandId = null;
      this.loadProducts(this.lastSearch);
      return;
    }

    this.selectedBrandId = b.id;

    // Load models for brand, then refresh products (keep search)
    this.loadBrandModels(b.id, () => this.loadProducts(this.lastSearch));
  }

  selectModel(m: CarModel | null) {
    this.modelOpen = false;
    this.selectedModelId = m ? m.id : null;
    this.onModelChange();
  }

  // -------------------- CART --------------------

  addToCart(p: Product) {
    this.cart.add(
      {
        id: p.id,
        sku: p.sku,
        title_ka: p.title_ka,
        price_gel: p.price_gel,
      },
      1
    );
    this.toast('Added to cart');
  }

  // -------------------- API: BRANDS / MODELS --------------------

  loadBrands() {
    this.http.get<{ ok: boolean; items: Brand[] }>(`${this.API_BASE}/brands`).subscribe({
      next: (res) => {
        this.brands = res.items ?? [];
      },
      error: (err) => {
        console.error('Brands load failed', err);
      },
    });
  }

  loadBrandModels(brandId: number, after?: () => void) {
    this.http
      .get<{ ok: boolean; items: CarModel[] }>(`${this.API_BASE}/brands/${brandId}/models`)
      .subscribe({
        next: (res) => {
          this.models = res.items ?? [];
          after?.();
        },
        error: (err) => {
          console.error('Models load failed', err);
          this.models = [];
          after?.();
        },
      });
  }

  onModelChange() {
    if (!this.selectedModelId) {
      // All models (or cleared)
      this.loadProducts(this.lastSearch);
      return;
    }
    this.loadProductsByModel(this.selectedModelId);
  }

  // -------------------- API: PRODUCTS --------------------

  loadProducts(search: string = this.lastSearch) {
    this.loading = true;
    this.error = '';

    this.lastSearch = (search || '').trim();

    const params: string[] = [];
    if (this.lastSearch) params.push(`search=${encodeURIComponent(this.lastSearch)}`);
    params.push(`_=${Date.now()}`); // Safari cache-bust

    const url = `${this.API_BASE}/products?${params.join('&')}`;

    this.http.get<{ ok: boolean; items: Product[] }>(url).subscribe({
      next: (res) => {
        this.products = res.items ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Products load failed', err);
        this.error = 'Failed to load products';
        this.loading = false;
      },
    });
  }

  loadProductsByModel(modelId: number) {
    this.loading = true;
    this.error = '';

    // keep what user typed
    this.lastSearch = this.searchText.trim();

    const url = `${this.API_BASE}/models/${modelId}/products?_=${Date.now()}`;

    this.http.get<{ ok: boolean; items: Product[] }>(url).subscribe({
      next: (res) => {
        this.products = res.items ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Model products load failed', err);
        this.error = 'Failed to load products for model';
        this.loading = false;
      },
    });
  }

  // -------------------- SEARCH / CLEAR / RELOAD --------------------

  doSearch() {
    // Search resets filters
    this.selectedBrandId = null;
    this.selectedModelId = null;
    this.models = [];

    this.brandOpen = false;
    this.modelOpen = false;

    this.loadProducts(this.searchText);
  }

  clear() {
    this.searchText = '';
    this.lastSearch = '';

    this.selectedBrandId = null;
    this.selectedModelId = null;
    this.models = [];

    this.brandOpen = false;
    this.modelOpen = false;

    this.loadProducts('');
  }

  reload() {
    this.brandOpen = false;
    this.modelOpen = false;

    if (this.selectedModelId) return this.loadProductsByModel(this.selectedModelId);
    return this.loadProducts(this.lastSearch);
  }
}