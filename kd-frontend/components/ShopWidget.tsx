import React, { useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

interface ShopWidgetProps {
  kingdomSlug?: string;
}

interface Product {
  id: string;
  label: string;
  price: number;
  description: string;
}

interface CartItem extends Product {
  quantity: number;
}

const PRODUCTS: Product[] = [
  { id: '1d', label: '1 Day Access', price: 5, description: 'Quick access for a day.' },
  { id: '7d', label: '7 Day Access', price: 10, description: 'Full access for one week.' },
  { id: '14d', label: '14 Day Access', price: 20, description: 'Two weeks with support.' },
  { id: '30d', label: '30 Day Access', price: 26, description: 'Monthly pass with discount.' },
  { id: '1y', label: '1 Year Access', price: 220, description: 'Annual license for power users.' },
];

const ShopWidget: React.FC<ShopWidgetProps> = ({ kingdomSlug }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const addToCart = (product: Product) => {
    setCheckoutMessage(null);
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCheckoutMessage(null);
    setCart(prev =>
      prev
        .map(item =>
          item.id === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const redirectToLogin = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('account', 'shop');
    newUrl.searchParams.delete('login');
    newUrl.searchParams.delete('register');
    newUrl.searchParams.delete('slug');
    newUrl.searchParams.delete('shop');
    window.location.href = newUrl.toString();
  };

  const handleCheckout = () => {
    if (!user) {
      redirectToLogin();
      return;
    }

    if (cart.length === 0) return;

    setCheckoutMessage('Thanks! Your checkout is prepared. An admin will finalize the activation.');
    clearCart();
  };

  return (
    <div className="text-white space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-500/20 via-slate-900/40 to-amber-500/20 border-b border-slate-800">
          <p className="text-xs uppercase tracking-widest text-emerald-200">KD Shop</p>
          <p className="text-lg font-semibold text-white">Choose your access duration</p>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 gap-4">
            {PRODUCTS.map(product => (
              <div
                key={product.id}
                className="bg-slate-900/60 border border-white/5 rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{product.label}</p>
                  <p className="text-xs text-slate-400">{product.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-200">${product.price}</div>
                  <button
                    className="mt-2 text-xs px-3 py-1 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 transition text-slate-950 font-semibold"
                    onClick={() => addToCart(product)}
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Cart</p>
              <button
                onClick={clearCart}
                className="text-xs text-slate-400 hover:text-white"
                disabled={cart.length === 0}
              >
                Clear
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-500">No items added.</p>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-slate-500">${item.price} per license</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-center"
                      >
                        -
                      </button>
                      <span className="min-w-[24px] text-center font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {!user && (
                <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-lg p-2">
                  Please log in or register to complete checkout.
                </div>
              )}
              {checkoutMessage && (
                <div className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-2">
                  {checkoutMessage}
                </div>
              )}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                  cart.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : user
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {user ? 'Proceed to checkout' : 'Start login/registration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopWidget;
