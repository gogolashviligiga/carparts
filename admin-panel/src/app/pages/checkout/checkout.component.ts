import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { CartService } from '../../services/cart.service';
import { OrdersService } from '../../services/orders.service';

type CreateOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_note?: string;
  total_price: number;
  items: Array<{
    product_id: number;
    sku: string;
    title_ka: string;
    price_gel: number;
    qty: number;
  }>;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {

  customer_name = '';
  customer_phone = '';
  customer_address = '';
  customer_note = '';

  error = '';
  loading = false;

  constructor(
    public cart: CartService,
    private ordersApi: OrdersService,
    private router: Router
  ) {}

  // 🔄 Reset only form fields (not cart)
  resetForm(): void {
    this.customer_name = '';
    this.customer_phone = '';
    this.customer_address = '';
    this.customer_note = '';
    this.error = '';
  }

  placeOrder(): void {
    if (this.loading) return;

    this.error = '';

    const name = this.customer_name.trim();
    const phone = this.customer_phone.trim();
    const address = this.customer_address.trim();
    const note = this.customer_note.trim();

    // ✅ Validation
    if (!name || !phone || !address) {
      this.error = 'Name, phone and address are required';
      return;
    }

    if (this.cart.items.length === 0) {
      this.error = 'Cart is empty';
      return;
    }

    // ✅ Build payload
    const payload: CreateOrderPayload = {
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      total_price: this.cart.total(),
      items: this.cart.items.map(i => ({
        product_id: i.id,
        sku: i.sku,
        title_ka: i.title_ka,
        price_gel: i.price_gel,
        qty: i.qty,
      })),
      ...(note ? { customer_note: note } : {}) // only if filled
    };

    this.loading = true;

    this.ordersApi.createOrder(payload)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (res) => {
          if (!res?.ok || !res?.item?.id) {
            this.error = res?.error || 'Order failed';
            return;
          }

          const orderId = res.item.id;

          // save phone for tracking page
          sessionStorage.setItem('track_phone', phone);

          // clear cart + form
          this.cart.clear();
          this.resetForm();

          // redirect to success page
          this.router.navigate(['/order-success', orderId], {
            queryParams: { phone }
          });
        },
        error: (err: HttpErrorResponse) => {
          console.error(err);
          this.error = err.error?.error || 'Order failed';
        }
      });
  }
}