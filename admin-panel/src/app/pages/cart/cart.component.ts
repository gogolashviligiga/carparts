import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  constructor(public cart: CartService) {}

  onQtyChange(id: number, value: any) {
    const qty = Math.max(1, Number(value) || 1);
    this.cart.setQty(id, qty);
  }
  inc(i: any) {
  this.cart.setQty(i.id, i.qty + 1);
}

dec(i: any) {
  if (i.qty > 1) {
    this.cart.setQty(i.id, i.qty - 1);
  }
}
}