// src/app/pages/order-success/order-success.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { OrdersService } from '../../services/orders.service';

type Order = {
  id: number;
  customer_name: string;
  customer_phone: string;
  total_price: number;
  status: string;
  created_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  title_ka: string;
  price_gel: number;
  qty: number;
};

type TrackOrderResponse = {
  ok: boolean;
  error?: string;
  order?: Order;
  items?: OrderItem[];
};

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-success.component.html',
})
export class OrderSuccessComponent implements OnInit {
  loading = false;
  error = '';

  order: Order | null = null;
  items: OrderItem[] = [];

  constructor(private route: ActivatedRoute, private ordersApi: OrdersService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id') || 0);

    const phoneFromUrl = (this.route.snapshot.queryParamMap.get('phone') || '').trim();
    const phoneFromSession = (sessionStorage.getItem('track_phone') || '').trim();
    const phone = phoneFromUrl || phoneFromSession;

    if (!Number.isFinite(id) || id <= 0) {
      this.error = 'Invalid order id.';
      return;
    }
    if (!phone) {
      this.error = 'Missing phone. Please open from checkout again.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.ordersApi.trackOrder(id, phone).subscribe({
      next: (res: TrackOrderResponse) => {
        this.loading = false;

        if (!res?.ok || !res.order) {
          this.error = res?.error || 'Order not found.';
          return;
        }

        this.order = res.order;
        this.items = res.items ?? [];
      },
      error: (err: HttpErrorResponse) => {
        console.error(err);
        this.loading = false;
        this.error = (err.error as any)?.error || 'Failed to load order.';
      },
    });
  }

  itemsTotal(): number {
    return this.items.reduce((sum, it) => sum + Number(it.price_gel) * Number(it.qty), 0);
  }
}