// src/app/services/orders.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type OrderStatus = 'new' | 'processing' | 'done' | 'cancelled';

export type OrderRow = {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_note: string | null;
  total_price: number;
  status: OrderStatus;
  created_at: string;
};

export type OrderItemRow = {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  title_ka: string;
  price_gel: number;
  qty: number;
};

export type CreateOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_note?: string | null;
  total_price: number;
  items: Array<{
    product_id: number;
    sku: string;
    title_ka: string;
    price_gel: number;
    qty: number;
  }>;
};

export type CreateOrderResponse = {
  ok: boolean;
  item?: { id: number };
  error?: string;
};

export type TrackOrderResponse = {
  ok: boolean;
  order?: OrderRow;
  items?: OrderItemRow[];
  error?: string;
};

export type AdminListOrdersResponse = {
  ok: boolean;
  items: OrderRow[];
  error?: string;
};

export type AdminUpdateOrderResponse = {
  ok: boolean;
  item?: OrderRow;
  error?: string;
};

export type AdminDeleteOrderResponse = {
  ok: boolean;
  error?: string;
};

export type AdminOrderItemsResponse = {
  ok: boolean;
  items: OrderItemRow[];
  error?: string;
};

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly API_BASE = 'https://carparts-production.up.railway.app';

  constructor(private http: HttpClient) {}

  // ---------------- CUSTOMER ----------------
  createOrder(data: CreateOrderPayload): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.API_BASE}/orders`, data);
  }

  trackOrder(id: number, phone: string): Observable<TrackOrderResponse> {
    const url = `${this.API_BASE}/orders/${id}?phone=${encodeURIComponent(phone)}`;
    return this.http.get<TrackOrderResponse>(url);
  }

  // ---------------- ADMIN ----------------
  private adminOptions() {
    const token = localStorage.getItem('admin_token') || '';
    return {
      headers: new HttpHeaders({
        Authorization: token ? `Bearer ${token}` : '',
      }),
    };
  }

  adminList(): Observable<AdminListOrdersResponse> {
    return this.http.get<AdminListOrdersResponse>(
      `${this.API_BASE}/admin/orders`,
      this.adminOptions()
    );
  }

  adminUpdateStatus(id: number, status: OrderStatus): Observable<AdminUpdateOrderResponse> {
    return this.http.put<AdminUpdateOrderResponse>(
      `${this.API_BASE}/admin/orders/${id}`,
      { status },
      this.adminOptions()
    );
  }

  adminDelete(id: number): Observable<AdminDeleteOrderResponse> {
    return this.http.delete<AdminDeleteOrderResponse>(
      `${this.API_BASE}/admin/orders/${id}`,
      this.adminOptions()
    );
  }

  // ✅ used for “click row -> show what customer bought”
  adminGetItems(orderId: number): Observable<AdminOrderItemsResponse> {
    return this.http.get<AdminOrderItemsResponse>(
      `${this.API_BASE}/admin/orders/${orderId}/items`,
      this.adminOptions()
    );
  }
}