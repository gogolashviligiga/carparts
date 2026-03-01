import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const TOKEN_KEY = 'admin_token';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly _isAdmin$ = new BehaviorSubject<boolean>(
    !!localStorage.getItem(TOKEN_KEY)
  );

  /** Subscribe to this if you want reactive UI */
  readonly isAdmin$ = this._isAdmin$.asObservable();

  /** Simple sync check (good for templates too) */
  isAdmin(): boolean {
    return this._isAdmin$.value;
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._isAdmin$.next(true);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._isAdmin$.next(false);
  }

  /** Optional helper */
  getToken(): string {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
}