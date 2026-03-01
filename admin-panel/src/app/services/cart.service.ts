import { Injectable } from '@angular/core';

export type CartItem = {
  id: number;
  sku: string;
  title_ka: string;
  price_gel: number;
  qty: number;
};

@Injectable({ providedIn: 'root' })
export class CartService {
  items: CartItem[] = [];

  count(): number {
    return this.items.reduce((sum, it) => sum + it.qty, 0);
  }

  add(p: { id: number; sku: string; title_ka: string; price_gel: number }, qty = 1) {
    const existing = this.items.find(x => x.id === p.id);
    if (existing) existing.qty += qty;
    else this.items.push({ ...p, qty });
  }

  setQty(id: number, qty: number) {
    const q = Math.max(1, Number(qty) || 1);
    const item = this.items.find(x => x.id === id);
    if (item) item.qty = q;
  }

  remove(id: number) {
    this.items = this.items.filter(x => x.id !== id);
  }

  clear() {
    this.items = [];
  }

  total(): number {
    return this.items.reduce((sum, it) => sum + it.price_gel * it.qty, 0);
  }
}