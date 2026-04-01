import React, { useState, useEffect, createContext, useContext } from "react";
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { ShoppingCart, Package, User, Phone, MapPin, Truck, ChevronLeft, ChevronRight, X, Plus, Minus, CheckCircle2, Settings, Image as ImageIcon, Trash2, LogIn, LogOut, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { cn } from "@/src/lib/utils";
import type { Product, CartItem, Order } from "./types";
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  onAuthStateChanged, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  handleFirestoreError,
  OperationType,
  FirebaseUser,
  storage,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase";

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          // Check if user is admin in Firestore or by email
          const userDoc = await getDoc(doc(db, "users", u.uid));
          const userData = userDoc.data();
          const isDefaultAdmin = u.email === "thecupoftea1000@gmail.com" && u.emailVerified;
          
          setIsAdmin(userData?.role === "admin" || isDefaultAdmin);
          setUser(u);

          // Ensure user document exists
          if (!userDoc.exists()) {
            await setDoc(doc(db, "users", u.uid), {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              role: isDefaultAdmin ? "admin" : "client"
            });
          }
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // Even on error, we should probably allow the user to see the login button
        setUser(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });
    
    // Safety timeout: if auth doesn't respond in 5 seconds, stop loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- Components ---

const Navbar = ({ cartCount }: { cartCount: number }) => {
  const { user, isAdmin, loading } = useAuth();
  
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold tracking-tighter text-black">
          BRAXTON.<span className="text-gray-400">OPT</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          {!loading && isAdmin && (
            <Link to="/admin" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium">
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Адмін</span>
            </Link>
          )}
          <Link to="/cart" className="relative p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </Link>
          {loading && (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          )}
          {!loading && (
            user ? (
              <button 
                onClick={logout} 
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-500 font-medium"
                title="Вийти"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Вийти</span>
              </button>
            ) : (
              <button 
                onClick={signInWithGoogle} 
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-medium"
                title="Увійти"
              >
                <LogIn className="w-5 h-5" />
                <span className="text-sm">Увійти</span>
              </button>
            )
          )}
        </div>
      </div>
    </nav>
  );
};

const ProductCard: React.FC<{ product: Product; onOpen: (p: Product) => void }> = ({ product, onOpen }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="group cursor-pointer"
    onClick={() => onOpen(product)}
  >
    <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-gray-50 relative flex items-center justify-center">
      <img 
        src={product.images[0]} 
        alt={product.name}
        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
        referrerPolicy="no-referrer"
      />
      {!product.inStock && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
          <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Немає в наявності</span>
        </div>
      )}
    </div>
    <div className="mt-4 space-y-1">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-900">{product.name}</h3>
        <span className="text-black font-bold">${product.price}</span>
      </div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{product.category}</p>
    </div>
  </motion.div>
);

const ProductModal = ({ product, onClose, onAddToCart, cartItems }: { product: Product; onClose: () => void; onAddToCart: (item: CartItem) => void; cartItems: CartItem[] }) => {
  const [individualQuantities, setIndividualQuantities] = useState<Record<string, number>>(
    product.sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {})
  );
  const [activeImage, setActiveImage] = useState(0);

  const nextImage = () => {
    setActiveImage(prev => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    setActiveImage(prev => (prev - 1 + product.images.length) % product.images.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product.images.length]);

  const getInCartCount = (size: string) => {
    return cartItems
      .filter(item => item.productId === product.id && item.type === 'individual' && item.size === size)
      .reduce((acc, item) => acc + item.quantity, 0);
  };

  const handleAddAllSizes = () => {
    setIndividualQuantities(prev => {
      const next = { ...prev };
      product.sizes.forEach(size => {
        next[size] = (next[size] || 0) + 1;
      });
      return next;
    });
  };

  const handleAdd = () => {
    const sizesToAdd = Object.entries(individualQuantities).filter(([_, qty]) => (qty as number) > 0);
    if (sizesToAdd.length === 0) {
      toast.error("Виберіть хоча б одну пару");
      return;
    }
    sizesToAdd.forEach(([size, qty]) => {
      onAddToCart({
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        name: product.name,
        image: product.images[0],
        type: 'individual',
        quantity: qty as number,
        price: product.price,
        size
      });
    });
    // Reset individual quantities after adding
    setIndividualQuantities(product.sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}));
    toast.success("Додано в кошик");
  };

  const updateIndividualQty = (size: string, delta: number) => {
    setIndividualQuantities(prev => ({
      ...prev,
      [size]: Math.max(0, prev[size] + delta)
    }));
  };

  const totalIndividualPrice = Object.entries(individualQuantities).reduce((acc, [_, qty]) => acc + ((qty as number) * product.price), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden relative shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full z-10">
          <X className="w-6 h-6" />
        </button>
        
        <div className="grid md:grid-cols-2">
          <div className="bg-gray-50 flex flex-col relative group/gallery">
            <div className="aspect-[3/4] overflow-hidden flex items-center justify-center p-4 relative">
              <img src={product.images[activeImage]} alt={product.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              
              {product.images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg opacity-0 group-hover/gallery:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg opacity-0 group-hover/gallery:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="p-4 flex gap-2 overflow-x-auto">
                {product.images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 flex items-center justify-center bg-white",
                      activeImage === idx ? "border-black" : "border-transparent"
                    )}
                  >
                    <img src={img} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-8 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
              <p className="text-black font-bold text-xl mt-1">${product.price} <span className="text-sm text-gray-400 font-normal">/ пара</span></p>
              {product.description && (
                <p className="text-sm text-gray-500 mt-4 leading-relaxed">{product.description}</p>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Виберіть розміри та кількість</label>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleAddAllSizes}
                      className="text-[10px] text-black hover:underline uppercase font-bold tracking-wider transition-colors"
                    >
                      Додати всі розміри по 1
                    </button>
                    <button 
                      onClick={() => setIndividualQuantities(product.sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}))}
                      className="text-[10px] text-gray-400 hover:text-black uppercase font-bold tracking-wider transition-colors"
                    >
                      Очистити
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {product.sizes.map(size => {
                    const inCart = getInCartCount(size);
                    const current = individualQuantities[size];
                    return (
                      <div key={size} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-gray-200 transition-all">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">Розмір {size}</span>
                            {inCart > 0 && (
                              <span className="text-[9px] bg-black text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                                В кошику: {inCart}
                                {current > 0 && <span className="ml-1 text-gray-400">+{current}</span>}
                              </span>
                            )}
                          </div>
                          {current > 0 && (
                            <span className="text-[10px] text-black font-medium">Додаємо: {current} шт.</span>
                          )}
                        </div>
                        <div className="flex items-center border border-gray-200 rounded-xl bg-white shadow-sm">
                          <button 
                            onClick={() => updateIndividualQty(size, -1)}
                            className="p-2 hover:bg-gray-50 rounded-l-xl transition-colors"
                            disabled={current === 0}
                          >
                            <Minus className={cn("w-3.5 h-3.5", current === 0 ? "text-gray-200" : "text-gray-600")} />
                          </button>
                          <span className={cn("w-8 text-center font-bold text-sm", current > 0 ? "text-black" : "text-gray-400")}>
                            {current}
                          </span>
                          <button 
                            onClick={() => updateIndividualQty(size, 1)}
                            className="p-2 hover:bg-gray-50 rounded-r-xl transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button 
                onClick={handleAdd}
                disabled={Object.values(individualQuantities).every(q => q === 0)}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-gray-200 disabled:opacity-50 disabled:shadow-none"
              >
                Додати в кошик — ${totalIndividualPrice}
              </button>
              <button 
                onClick={onClose}
                className="w-full py-3 text-gray-400 hover:text-gray-600 text-sm font-medium transition-all"
              >
                Завершити та закрити
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Pages ---

const Catalog = ({ onAddToCart, cartItems }: { onAddToCart: (item: CartItem) => void; cartItems: CartItem[] }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("Всі");

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
    });

    return unsubscribe;
  }, []);

  const filteredProducts = activeCategory === "Всі" 
    ? products 
    : products.filter(p => p.category === activeCategory);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Каталог взуття</h1>
        <p className="text-gray-500 mt-2">Оптові ціни та швидка доставка по всій Україні</p>
        
        <div className="flex gap-2 mt-8 overflow-x-auto pb-2 scrollbar-hide">
          {["Всі", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                activeCategory === cat 
                  ? "bg-black text-white shadow-lg shadow-gray-200" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} onOpen={setSelectedProduct} />
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
        <div className="text-center py-24">
          <p className="text-gray-400">У цій категорії поки немає товарів</p>
        </div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <ProductModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
            onAddToCart={onAddToCart}
            cartItems={cartItems}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const Cart = ({ items, onRemove, onClear, onUpdateQuantity }: { items: CartItem[]; onRemove: (id: string) => void; onClear: () => void; onUpdateQuantity: (id: string, delta: number) => void }) => {
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [formData, setFormData] = useState({ name: '', phone: '', city: '', delivery: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Group items by product for a cleaner wholesale view
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = {
        name: item.name,
        image: item.image,
        items: []
      };
    }
    acc[item.productId].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; image: string; items: CartItem[] }>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 1. Save to Firestore
      const orderData = {
        customer: formData,
        items,
        total,
        createdAt: Timestamp.now(),
        status: 'pending'
      };
      
      await addDoc(collection(db, "orders"), orderData);

      // 2. Notify via Telegram (Directly from client for GitHub Pages)
      const botToken = "8421404977:AAEAgbBfKNvTcX_n8mcKGf_BMxewEeiFT6s";
      const chatId = "223733844";
      
      const message = `
🛍️ *Нове замовлення!*
👤 *Клієнт:* ${formData.name}
📞 *Телефон:* ${formData.phone}
📍 *Місто:* ${formData.city}
🚚 *Доставка:* ${formData.delivery}

📦 *Товари:*
${items.map(item => `- ${item.name} (${item.size}): ${item.quantity} шт. x $${item.price}`).join('\n')}

💰 *Разом:* $${total}
      `;

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown"
          }),
        });
      } catch (tgErr) {
        console.error("Telegram notification failed:", tgErr);
        // We don't block the success screen if only Telegram fails
      }
      
      setStep('success');
      onClear();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "orders");
      toast.error("Помилка при оформленні замовлення");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-8 h-8 text-gray-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Кошик порожній</h2>
        <p className="text-gray-500 mt-2 mb-8">Додайте товари з каталогу, щоб зробити замовлення</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all">
          До каталогу <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </motion.div>
        <h2 className="text-3xl font-bold text-gray-900">Дякуємо за замовлення!</h2>
        <p className="text-gray-500 mt-4 mb-8 text-lg">Ми отримали вашу заявку і скоро зв'яжемося з вами для підтвердження. Деталі замовлення надіслані менеджеру в Telegram.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all">
          Повернутися до магазину
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <header>
            <h1 className="text-3xl font-bold text-gray-900">{step === 'cart' ? 'Ваш кошик' : 'Оформлення замовлення'}</h1>
          </header>

          {step === 'cart' ? (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([productId, group]) => (
                <div key={productId} className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                  <div className="flex items-center gap-6 p-6 bg-gray-50/50 border-b border-gray-100">
                    <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={group.image} alt={group.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-6 hover:bg-gray-50/30 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                              item.type === 'pack' ? "bg-gray-100 text-gray-700" : "bg-gray-100 text-gray-700"
                            )}>
                              {item.type === 'pack' ? 'Ростовка' : 'Поштучно'}
                            </span>
                            {item.size && (
                              <span className="text-sm font-bold text-gray-700">Розмір: {item.size}</span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-gray-400">
                            Ціна: ${item.price} / {item.type === 'pack' ? 'ящ' : 'пара'}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8">
                          <div className="flex items-center border border-gray-200 rounded-xl bg-white">
                            <button 
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="p-2 hover:bg-gray-50 rounded-l-xl transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                            <button 
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="p-2 hover:bg-gray-50 rounded-r-xl transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="w-24 text-right">
                            <div className="font-bold text-gray-900">${item.price * item.quantity}</div>
                          </div>
                          <button 
                            onClick={() => onRemove(item.id)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6 bg-white p-8 border border-gray-100 rounded-3xl">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Ім'я та Прізвище</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Іван Іванов"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Телефон</label>
                  <input 
                    required
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+380..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Місто</label>
                  <input 
                    required
                    type="text" 
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                    placeholder="Київ"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Відділення пошти</label>
                  <input 
                    required
                    type="text" 
                    value={formData.delivery}
                    onChange={e => setFormData({...formData, delivery: e.target.value})}
                    placeholder="Нова Пошта №5"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 text-white p-8 rounded-3xl sticky top-24">
            <h2 className="text-xl font-bold mb-6">Підсумок</h2>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-gray-400">
                <span>Товарів</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Доставка</span>
                <span>За тарифами перевізника</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between text-xl font-bold">
                <span>Разом</span>
                <span>${total}</span>
              </div>
            </div>

            {step === 'cart' ? (
              <button 
                onClick={() => setStep('checkout')}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition-all"
              >
                Оформити замовлення
              </button>
            ) : (
              <button 
                form="checkout-form"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Надсилаємо..." : "Підтвердити замовлення"}
              </button>
            )}
            
            {step === 'checkout' && (
              <button 
                onClick={() => setStep('cart')}
                className="w-full mt-4 text-gray-400 hover:text-white text-sm font-medium transition-all"
              >
                Повернутися до кошика
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CATEGORIES = [
  "Мокасини",
  "Кеди",
  "Туфлі",
  "Кросівки",
  "Черевики",
  "Тактичне Взуття",
  "Лофери"
];

const AVAILABLE_SIZES = ["39", "40", "41", "42", "43", "44", "45", "46"];

const Admin = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminCategory, setAdminCategory] = useState("Всі");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialFormState: Partial<Product> = {
    name: '',
    category: CATEGORIES[0],
    price: 0,
    sizes: [],
    images: [],
    inStock: true,
    description: ''
  };

  const [newProduct, setNewProduct] = useState<Partial<Product>>(initialFormState);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Product));
    });
    return unsubscribe;
  }, [isAdmin]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = adminCategory === "Всі" || p.category === adminCategory;
    return matchesSearch && matchesCategory;
  });

  if (authLoading) return <div className="p-12 text-center">Завантаження...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setNewProduct(product);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewProduct(initialFormState);
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!files.length) return;
    
    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileRef = ref(storage, `products/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedUrls.push(url);
      }

      setNewProduct(prev => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls]
      }));
      toast.success("Фото завантажено");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Помилка завантаження");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.images?.length) {
      toast.error("Додайте хоча б одне фото");
      return;
    }

    try {
      const productData = {
        ...newProduct
      };

      if (editingId) {
        const { id, ...updateData } = productData as any;
        await updateDoc(doc(db, "products", editingId), updateData);
        toast.success("Товар оновлено");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          id: Math.random().toString(36).substr(2, 9),
        });
        toast.success("Товар додано");
      }
      
      setNewProduct(initialFormState);
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, "products");
    }
  };

  const toggleSize = (size: string) => {
    const currentSizes = newProduct.sizes || [];
    if (currentSizes.includes(size)) {
      setNewProduct({ ...newProduct, sizes: currentSizes.filter(s => s !== size) });
    } else {
      setNewProduct({ ...newProduct, sizes: [...currentSizes, size].sort() });
    }
  };

  const selectAllSizes = () => setNewProduct({ ...newProduct, sizes: [...AVAILABLE_SIZES] });
  const select40_45 = () => setNewProduct({ ...newProduct, sizes: ["40", "41", "42", "43", "44", "45"] });
  const clearSizes = () => setNewProduct({ ...newProduct, sizes: [] });

  const deleteProduct = async (id: string) => {
    if (!confirm("Ви впевнені, що хочете видалити цей товар?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      toast.success("Товар видалено");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      toast.error("Помилка при видаленні");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Адмін-панель</h1>
          <p className="text-gray-500">Керування каталогом товарів</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <form onSubmit={handleAdd} className="bg-white p-8 border border-gray-100 rounded-3xl space-y-6 sticky top-24 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingId ? "Редагувати товар" : "Додати товар"}</h2>
              {editingId && (
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  className="text-xs text-gray-400 hover:text-black font-bold uppercase tracking-widest"
                >
                  Скасувати
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Назва</label>
                <input 
                  required
                  type="text" 
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-black transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Категорія</label>
                <select 
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-black transition-all bg-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Ціна ($)</label>
                  <input 
                    required
                    type="number" 
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-black transition-all"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Наявність</label>
                  <select 
                    value={newProduct.inStock ? "true" : "false"}
                    onChange={e => setNewProduct({...newProduct, inStock: e.target.value === "true"})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-black transition-all bg-white"
                  >
                    <option value="true">В наявності</option>
                    <option value="false">Немає</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Опис (опціонально)</label>
                <textarea 
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-black transition-all min-h-[100px]"
                  placeholder="Додайте опис товару..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Розміри в наявності</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button type="button" onClick={selectAllSizes} className="text-[10px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-all">Вибрати все</button>
                  <button type="button" onClick={select40_45} className="text-[10px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-all">40-45</button>
                  <button type="button" onClick={clearSizes} className="text-[10px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-all">Очистити</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_SIZES.map(size => (
                    <button 
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size)}
                      className={cn(
                        "py-2 rounded-lg border text-sm font-medium transition-all",
                        newProduct.sizes?.includes(size) ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Фотографії</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {newProduct.images?.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-lg bg-gray-100 overflow-hidden border border-gray-200 relative group">
                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        type="button"
                        onClick={() => setNewProduct(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) }))}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all",
                      isDragging ? "border-black bg-gray-50" : "border-gray-200 hover:border-black hover:bg-gray-50"
                    )}
                  >
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-[8px] text-gray-400 mt-1 font-bold uppercase">Додати</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
            <button className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-100">
              Зберегти товар
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 border border-gray-100 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1">
                <input 
                  type="text"
                  placeholder="Пошук за назвою..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all text-sm"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                {["Всі", ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAdminCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                      adminCategory === cat ? "bg-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400 tracking-widest">Товар</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400 tracking-widest">Ціна</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400 tracking-widest">Статус</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400 tracking-widest">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className={cn(editingId === product.id && "bg-gray-50")}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                          <img src={product.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{product.name}</p>
                          <p className="text-xs text-gray-400">{product.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">${product.price}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        product.inStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {product.inStock ? "В наявності" : "Немає"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => startEdit(product)}
                          className="p-2 hover:bg-gray-100 text-gray-400 hover:text-black rounded-full transition-colors"
                          title="Редагувати"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                          title="Видалити"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                Товарів не знайдено
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(i => 
        i.productId === item.productId && 
        i.type === item.type && 
        i.size === item.size
      );

      if (existingIndex !== -1) {
        const newCart = [...prev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + item.quantity
        };
        return newCart;
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-white font-sans text-gray-900">
          <Navbar cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} />
          <main>
            <Routes>
              <Route path="/" element={<Catalog onAddToCart={addToCart} cartItems={cart} />} />
              <Route path="/cart" element={<Cart items={cart} onRemove={removeFromCart} onClear={clearCart} onUpdateQuantity={updateQuantity} />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
          <Toaster position="bottom-right" />
        </div>
      </Router>
    </AuthProvider>
  );
}
