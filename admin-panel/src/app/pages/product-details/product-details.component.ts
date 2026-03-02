import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-details.component.html',
})
export class ProductDetailsComponent implements OnInit, OnDestroy {
  private readonly API = 'https://carparts-production.up.railway.app';
  private readonly destroy$ = new Subject<void>();

  loading = false;
  error = '';
  product: Product | null = null;

  // ---- Zoom / Pan state ----
  zoom = 1;
  readonly minZoom = 1;
  readonly maxZoom = 4;

  panX = 0; // px
  panY = 0; // px

  dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;

  // touch pinch
  private pinchActive = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private pinchStartCenter = { x: 0, y: 0 }; // viewport-local center

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cart: CartService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // translate first, then scale
  get imgTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  private load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id') || 0);

    if (!Number.isFinite(id) || id <= 0) {
      this.error = 'Invalid product id';
      this.product = null;
      return;
    }

    this.loading = true;
    this.error = '';
    this.product = null;

    this.http
      .get<{ ok: boolean; item?: Product; error?: string }>(`${this.API}/${id}`)
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (!res?.ok || !res.item) {
            this.error = res?.error || 'Product not found';
            return;
          }
          this.product = res.item;
          this.resetZoom();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          this.error = err?.error?.error || 'Failed to load product';
        },
      });
  }

  addToCart(): void {
    if (!this.product) return;

    this.cart.add(
      {
        id: this.product.id,
        sku: this.product.sku,
        title_ka: this.product.title_ka,
        price_gel: this.product.price_gel,
      },
      1
    );

    alert('Added to cart');
  }

  // ---------------- ZOOM CONTROLS ----------------
  zoomIn(): void {
    this.zoomAtPoint(this.zoom + 0.25, null);
  }

  zoomOut(): void {
    this.zoomAtPoint(this.zoom - 0.25, null);
  }

  resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.dragging = false;
    this.pinchActive = false;
  }

  // ---------------- WHEEL ZOOM (mouse/trackpad) ----------------
  onWheel(ev: WheelEvent): void {
    ev.preventDefault();

    const delta = ev.deltaY;
    // deltaY > 0 => zoom out
    const step = 0.18;
    const next = this.zoom + (delta > 0 ? -step : step);

    // zoom around cursor location inside viewport
    this.zoomAtPoint(next, { clientX: ev.clientX, clientY: ev.clientY, target: ev.target as HTMLElement });
  }

  // ---------------- DRAG / PAN (mouse) ----------------
  onDragStart(ev: MouseEvent): void {
    if (this.zoom <= 1) return;

    ev.preventDefault();
    this.dragging = true;

    this.dragStartX = ev.clientX;
    this.dragStartY = ev.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
  }

  onDragMove(ev: MouseEvent): void {
    if (!this.dragging || this.zoom <= 1) return;

    const dx = ev.clientX - this.dragStartX;
    const dy = ev.clientY - this.dragStartY;

    this.panX = this.panStartX + dx;
    this.panY = this.panStartY + dy;

    this.clampPan();
  }

  onDragEnd(): void {
    this.dragging = false;
    this.pinchActive = false;
  }

  // ---------------- TOUCH SUPPORT ----------------
  onTouchStart(ev: TouchEvent): void {
    if (!ev.touches?.length) return;

    // 1 finger drag (only if zoomed)
    if (ev.touches.length === 1) {
      if (this.zoom <= 1) return;

      const t = ev.touches[0];
      this.dragging = true;
      this.pinchActive = false;

      this.dragStartX = t.clientX;
      this.dragStartY = t.clientY;
      this.panStartX = this.panX;
      this.panStartY = this.panY;

      ev.preventDefault();
      return;
    }

    // 2 finger pinch
    if (ev.touches.length === 2) {
      const a = ev.touches[0];
      const b = ev.touches[1];

      this.dragging = false;
      this.pinchActive = true;

      this.pinchStartDist = this.touchDist(a, b);
      this.pinchStartZoom = this.zoom;

      // pinch center in viewport-local coords
      const centerClient = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      this.pinchStartCenter = this.viewportLocalPointFromClient(ev.target as HTMLElement, centerClient.x, centerClient.y);

      ev.preventDefault();
    }
  }

  onTouchMove(ev: TouchEvent): void {
    if (!ev.touches?.length) return;

    // 1 finger pan
    if (ev.touches.length === 1 && this.dragging && this.zoom > 1) {
      const t = ev.touches[0];
      const dx = t.clientX - this.dragStartX;
      const dy = t.clientY - this.dragStartY;

      this.panX = this.panStartX + dx;
      this.panY = this.panStartY + dy;

      this.clampPan();
      ev.preventDefault();
      return;
    }

    // 2 finger pinch zoom
    if (ev.touches.length === 2 && this.pinchActive) {
      const a = ev.touches[0];
      const b = ev.touches[1];

      const dist = this.touchDist(a, b);
      if (this.pinchStartDist <= 0) return;

      const ratio = dist / this.pinchStartDist;
      const next = this.pinchStartZoom * ratio;

      // zoom around stored pinch center
      this.zoomAtViewportLocal(next, this.pinchStartCenter);

      ev.preventDefault();
    }
  }

  private touchDist(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ---------------- CORE: ZOOM AT POINT ----------------
  private zoomAtPoint(nextZoom: number, wheelCtx: { clientX: number; clientY: number; target: HTMLElement } | null): void {
    const z = this.clampZoom(nextZoom);

    // if no target point (buttons), zoom around center
    if (!wheelCtx) {
      const prev = this.zoom;
      this.zoom = z;
      if (this.zoom <= 1) {
        this.panX = 0;
        this.panY = 0;
      } else if (prev !== this.zoom) {
        this.clampPan();
      }
      return;
    }

    const viewportPoint = this.viewportLocalPointFromClient(wheelCtx.target, wheelCtx.clientX, wheelCtx.clientY);
    this.zoomAtViewportLocal(z, viewportPoint);
  }

  private zoomAtViewportLocal(nextZoom: number, p: { x: number; y: number }): void {
    const z = this.clampZoom(nextZoom);
    const prev = this.zoom;

    if (z === prev) return;

    // Keep the point under cursor stable:
    // pan' = pan + (p - p)???  -> derived:
    // newPan = pan + (1 - new/old) * (p - pan)
    // This works well with transform: translate(pan) scale(zoom)
    const ratio = z / prev;

    this.panX = this.panX + (1 - ratio) * (p.x - this.panX);
    this.panY = this.panY + (1 - ratio) * (p.y - this.panY);

    this.zoom = z;

    if (this.zoom <= 1) {
      this.panX = 0;
      this.panY = 0;
    } else {
      this.clampPan();
    }
  }

  private viewportLocalPointFromClient(target: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
    // event target can be IMG or viewport children — find nearest .viewer-viewport
    const viewport = target.closest?.('.viewer-viewport') as HTMLElement | null;
    const el = viewport || target;

    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  private clampZoom(z: number): number {
    return Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  // ---------------- PAN LIMITS ----------------
  private clampPan(): void {
    // still "simple", but slightly smarter: based on zoom and viewport size (approx)
    // We don't have real image size, so we clamp by zoom factor.
    const max = 260 * (this.zoom - 1);
    this.panX = Math.max(-max, Math.min(max, this.panX));
    this.panY = Math.max(-max, Math.min(max, this.panY));
  }
}