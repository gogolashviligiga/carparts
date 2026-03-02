import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('admin_token'); // must match your login save key
    if (!token) return next.handle(req);

    // only attach for backend requests
    if (!req.url.startsWith('https://carparts-production.up.railway.app/api')) return next.handle(req);

    return next.handle(
      req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    );
  }
}