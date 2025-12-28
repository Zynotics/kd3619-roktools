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
      <div className="bg-gray-900 border border-blue-700 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-blue-700/20 border-b border-blue-700">
          <p className="text-xs uppercase tracking-widest text-blue-200">KD Shop</p>
          <p className="text-lg font-semibold text-white">Choose your access duration</p>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 gap-4">
            {PRODUCTS.map(product => (
              <div
                key={product.id}
                className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{product.label}</p>
                  <p className="text-xs text-gray-400">{product.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-300">${product.price}</div>
                  <button
                    className="mt-2 text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 transition"
                    onClick={() => addToCart(product)}
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-black/30 border border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Cart</p>
              <button
                onClick={clearCart}
                className="text-xs text-gray-400 hover:text-white"
                disabled={cart.length === 0}
              >
                Clear
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-gray-500">No items added.</p>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-gray-500">${item.price} per license</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 text-center"
                      >
                        -
                      </button>
                      <span className="min-w-[24px] text-center font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 text-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-700 pt-2 text-sm font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {!user && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-600 rounded-lg p-2">
                  Please log in or register to complete checkout.
                </div>
              )}
              {checkoutMessage && (
                <div className="text-xs text-green-300 bg-green-500/10 border border-green-700 rounded-lg p-2">
                  {checkoutMessage}
                </div>
              )}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                  cart.length === 0
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : user
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-blue-700 hover:bg-blue-600 text-white'
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
