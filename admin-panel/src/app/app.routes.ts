import { Routes } from '@angular/router';

import { DashboardPage } from './pages/dashboard.page';
import { ProductsComponent } from './pages/products/products.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { AdminComponent } from './pages/admin/admin.component';
import { CartComponent } from './pages/cart/cart.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ProductDetailsComponent } from './pages/product-details/product-details.component';
import { OrderSuccessComponent } from './pages/order-success/order-success.component';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { ContactComponent } from './pages/contact/contact.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';

export const routes: Routes = [
  { path: '', component: HomeComponent }, // ✅ Home

  { path: 'dashboard', component: DashboardPage },
  { path: 'products', component: ProductsComponent },
  { path: 'products/:id', component: ProductDetailsComponent },
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'order-success/:id', component: OrderSuccessComponent },

  // Info pages
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },


  // Admin login page
  { path: 'admin-login', component: AdminLoginComponent },

  // ADMIN area
  { path: 'admin', component: AdminComponent },
  { path: 'admin/orders', component: OrdersComponent },

  { path: '**', redirectTo: '' },
];