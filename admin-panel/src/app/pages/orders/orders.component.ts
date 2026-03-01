import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersService, OrderItemRow } from '../../services/orders.service';

type OrderStatus = 'new' | 'processing' | 'done' | 'cancelled';

type Order = {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_note: string | null;
  total_price: number;
  status: string;
  created_at: string;
};

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = false;
  error = '';

  // ✅ expand row state
  expandedId: number | null = null;

  // ✅ cache items per order
  itemsByOrderId: Record<number, OrderItemRow[]> = {};
  loadingItemsId: number | null = null;

  constructor(private ordersApi: OrdersService) {}

  ngOnInit(): void {
    this.load();
  }

  trackByOrderId(_: number, o: Order): number {
    return o.id;
  }

  load(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = '';

    this.ordersApi.adminList().subscribe({
      next: (res) => {
        this.orders = (res?.items ?? []) as Order[];
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load orders (are you logged in?)';
        this.loading = false;
      },
    });
  }

  toggleRow(o: Order): void {
    // collapse
    if (this.expandedId === o.id) {
      this.expandedId = null;
      return;
    }

    // expand
    this.expandedId = o.id;

    // load items only once (cached)
    if (this.itemsByOrderId[o.id]) return;

    this.loadingItemsId = o.id;
    this.ordersApi.adminGetItems(o.id).subscribe({
      next: (res) => {
        this.itemsByOrderId[o.id] = res?.items ?? [];
        this.loadingItemsId = null;
      },
      error: (err) => {
        console.error(err);
        this.itemsByOrderId[o.id] = [];
        this.loadingItemsId = null;
      },
    });
  }

  onStatusChange(id: number, status: string): void {
    const nextStatus = (status || '').toLowerCase() as OrderStatus;

    const idx = this.orders.findIndex((x) => x.id === id);
    const prev = idx >= 0 ? this.orders[idx].status : null;
    if (idx >= 0) this.orders[idx].status = nextStatus;

    this.ordersApi.adminUpdateStatus(id, nextStatus).subscribe({
      next: () => {},
      error: (err) => {
        console.error('Update failed', err);
        if (idx >= 0 && prev !== null) this.orders[idx].status = prev;
      },
    });
  }

  removeOrder(id: number): void {
    if (!confirm(`Delete order #${id}? This cannot be undone.`)) return;

    this.loading = true;
    this.error = '';

    this.ordersApi.adminDelete(id).subscribe({
      next: () => {
        this.orders = this.orders.filter((o) => o.id !== id);
        delete this.itemsByOrderId[id];
        if (this.expandedId === id) this.expandedId = null;
        this.loading = false;
      },
      error: (err) => {
        console.error('Delete failed', err);
        this.error = 'Delete failed (check backend DELETE route).';
        this.loading = false;
      },
    });
  }

  statusClass(status: string): OrderStatus {
    const s = (status || '').toLowerCase();
    if (s === 'done') return 'done';
    if (s === 'cancelled') return 'cancelled';
    if (s === 'processing') return 'processing';
    return 'new';
  }

  // helper
  orderItemsTotal(items: OrderItemRow[]): number {
    return (items || []).reduce((sum, it) => sum + (Number(it.price_gel) * Number(it.qty)), 0);
  }
}