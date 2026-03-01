import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-details.component.html',
})
export class OrderDetailsComponent implements OnInit {
  loading = false;
  error = '';

  order: Order | null = null;
  items: OrderItem[] = [];

  constructor(private route: ActivatedRoute, private orders: OrdersService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const phone = (this.route.snapshot.queryParamMap.get('phone') || '').trim();

    if (!Number.isFinite(id) || !phone) {
      this.error = 'Missing order id or phone.';
      return;
    }

    this.loading = true;
    this.orders.getOrderDetails(id, phone).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res?.ok) {
          this.error = res?.error || 'Failed to load order';
          return;
        }
        this.order = res.order;
        this.items = res.items || [];
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.error = 'Failed to load order (wrong phone or order not found).';
      },
    });
  }

  itemsTotal(): number {
    return this.items.reduce((sum, it) => sum + Number(it.price_gel) * Number(it.qty), 0);
  }
}