export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  password_hash?: string;
  phone?: string;
  role: UserRole;
  business_id: string;
  business_name: string;
  hourly_wage?: number; // Cost to business (Admin visible only)
  charge_out_rate?: number; // Billable rate to client (Admin visible only)
  active: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
