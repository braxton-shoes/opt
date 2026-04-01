export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  sizes: string[];
  images: string[];
  description?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  type: 'pack' | 'individual';
  quantity: number;
  price: number;
  size?: string;
}

export interface Order {
  customer: {
    name: string;
    phone: string;
    city: string;
    delivery: string;
  };
  items: CartItem[];
  total: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'client';
}
