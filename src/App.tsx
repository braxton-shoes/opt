import React, { useState, useEffect, createContext, useContext, Component, ErrorInfo, useRef } from "react";
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { ShoppingCart, Package, User, Phone, MapPin, Truck, ChevronLeft, ChevronRight, ChevronDown, X, Plus, Minus, CheckCircle2, Check, Settings, Image as ImageIcon, Trash2, LogIn, LogOut, Search, ZoomIn } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { cn } from "@/src/lib/utils";
import type { Product, CartItem, Order, UserProfile } from "./types";
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

import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

const CurrencyContext = createContext<{ rate: number; formatUAH: (usd: number) => string }>({ 
  rate: 41.5, 
  formatUAH: (usd) => Math.round(usd * 41.5).toLocaleString('uk-UA') + ' грн' 
});

const useCurrency = () => useContext(CurrencyContext);

const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [rate, setRate] = useState(41.5);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json');
        const data = await response.json();
        if (data && data[0] && data[0].rate) {
          setRate(data[0].rate);
        }
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
      }
    };
    fetchRate();
  }, []);

  const formatUAH = (usd: number) => {
    return Math.round(usd * rate).toLocaleString('uk-UA') + ' грн';
  };

  return (
    <CurrencyContext.Provider value={{ rate, formatUAH }}>
      {children}
    </CurrencyContext.Provider>
  );
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    console.log("AuthProvider: Initializing auth listener");
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log("AuthProvider: Auth state changed", u?.email);
      try {
        if (u) {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          const userData = userDoc.data();
          const isDefaultAdmin = u.email === "thecupoftea1000@gmail.com" && u.emailVerified;
          
          const adminStatus = userData?.role === "admin" || isDefaultAdmin;
          console.log("AuthProvider: Admin status determined", adminStatus);
          setIsAdmin(adminStatus);
          setUser(u);

          if (!userDoc.exists()) {
            console.log("AuthProvider: Creating user document");
            await setDoc(doc(db, "users", u.uid), {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              role: isDefaultAdmin ? "admin" : "client"
            });
          }
        } else {
          console.log("AuthProvider: No user logged in");
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("AuthProvider: Auth initialization error:", error);
        setUser(null);
        setIsAdmin(false);
      } finally {
        console.log("AuthProvider: Setting loading to false");
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
  
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

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
          <Link to="/cart" className="relative p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 group">
            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-gray-700 group-hover:text-black" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] md:text-[11px] font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full shadow-lg border-2 border-white animate-in zoom-in">
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
                onClick={handleLogin} 
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

const ProductCard: React.FC<{ product: Product; onOpen: (p: Product) => void }> = ({ product, onOpen }) => {
  const { formatUAH } = useCurrency();
  return (
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
      <div className="mt-4 space-y-1.5">
        <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-bold">{product.category}</p>
        <div className="flex justify-between items-start">
          <h3 className="text-sm md:text-base font-bold text-gray-900 leading-tight">{product.name}</h3>
          <div className="text-right">
            <div className="text-base md:text-lg text-black font-bold leading-none">${product.price}</div>
            <div className="text-[10px] md:text-xs text-gray-400 font-medium mt-0.5">{formatUAH(product.price)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ProductModal = ({ product, onClose, onAddToCart, cartItems }: { product: Product; onClose: () => void; onAddToCart: (item: CartItem) => void; cartItems: CartItem[] }) => {
  const { formatUAH } = useCurrency();
  const [individualQuantities, setIndividualQuantities] = useState<Record<string, number>>(
    product.sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {})
  );
  const [activeImage, setActiveImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const tapStartPos = useRef({ x: 0, y: 0 });

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
    
    // Lock body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [product.images.length, onClose]);

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

  const updateIndividualQty = (size: string, delta: number | string) => {
    setIndividualQuantities(prev => {
      const currentVal = prev[size] || 0;
      let newVal: number;
      
      if (typeof delta === 'string') {
        newVal = parseInt(delta) || 0;
      } else {
        newVal = currentVal + delta;
      }
      
      return {
        ...prev,
        [size]: Math.max(0, newVal)
      };
    });
  };

  const totalIndividualPrice = Object.entries(individualQuantities).reduce((acc, [_, qty]) => acc + ((qty as number) * product.price), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
      <AnimatePresence>
        {isZoomed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 touch-none"
          >
            {/* Background overlay for tapping to close */}
            <div 
              className="absolute inset-0 cursor-zoom-out" 
              onClick={() => setIsZoomed(false)}
            />
            
            {/* Navigation Arrows (Desktop) */}
            {product.images.length > 1 && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="hidden md:flex fixed left-4 lg:left-12 top-1/2 -translate-y-1/2 p-5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[210] group backdrop-blur-sm border border-white/10"
                >
                  <ChevronLeft className="w-12 h-12 group-hover:-translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="hidden md:flex fixed right-4 lg:right-12 top-1/2 -translate-y-1/2 p-5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[210] group backdrop-blur-sm border border-white/10"
                >
                  <ChevronRight className="w-12 h-12 group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}

            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                try {
                  if (product.images.length <= 1) return;
                  const swipeThreshold = 50;
                  if (info.offset.x < -swipeThreshold) nextImage();
                  else if (info.offset.x > swipeThreshold) prevImage();
                } catch (err) {
                  console.error("Swipe error:", err);
                }
              }}
              className="relative z-10 w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing px-20 lg:px-40"
            >
              <motion.img 
                key={activeImage}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                src={product.images[activeImage]} 
                alt={product.name} 
                className="max-w-full max-h-[85vh] md:max-h-[90vh] w-auto h-auto object-contain shadow-2xl rounded-sm"
                referrerPolicy="no-referrer"
              />
              
              {product.images.length > 1 && (
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
                  <div className="flex gap-2">
                    {product.images.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImage(idx);
                        }}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          activeImage === idx ? "bg-white w-8" : "bg-white/30 hover:bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-white/60 text-xs font-bold tracking-widest uppercase">
                    {activeImage + 1} / {product.images.length}
                  </span>
                </div>
              )}
            </motion.div>

            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-20"
              onClick={() => setIsZoomed(false)}
            >
              <X className="w-8 h-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
        className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden relative shadow-2xl overscroll-contain"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full z-10">
          <X className="w-6 h-6" />
        </button>
        
        <div className="grid md:grid-cols-2 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <div className="bg-gray-50 flex flex-col relative group/gallery border-b md:border-b-0 md:border-r border-gray-100 w-full overflow-hidden">
            <div className="relative w-full">
              <motion.div 
                className="w-full aspect-square md:aspect-[4/5] overflow-hidden flex items-center justify-center p-2 md:p-4 relative cursor-zoom-in touch-pan-y"
                onPanEnd={(_, info) => {
                  if (product.images.length <= 1) return;
                  const swipeThreshold = 50;
                  if (info.offset.x < -swipeThreshold) nextImage();
                  else if (info.offset.x > swipeThreshold) prevImage();
                }}
                onTapStart={(_, info) => {
                  tapStartPos.current = info.point;
                }}
                onTap={(_, info) => {
                  const distance = Math.sqrt(
                    Math.pow(info.point.x - tapStartPos.current.x, 2) +
                    Math.pow(info.point.y - tapStartPos.current.y, 2)
                  );
                  // Only zoom if the pointer moved less than 10 pixels (a real tap)
                  if (distance < 10) {
                    setIsZoomed(true);
                  }
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={activeImage}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    src={product.images[activeImage]} 
                    alt={product.name} 
                    className="max-w-full max-h-full object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                </AnimatePresence>
                
                <div className="absolute top-4 left-4 p-2 bg-white/80 rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity">
                  <ZoomIn className="w-5 h-5 text-gray-600" />
                </div>
              </motion.div>

              {product.images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/90 hover:bg-white rounded-full shadow-lg z-20 transition-all hover:scale-110 active:scale-95 hidden md:flex items-center justify-center border border-gray-100 group/btn"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-900" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/90 hover:bg-white rounded-full shadow-lg z-20 transition-all hover:scale-110 active:scale-95 hidden md:flex items-center justify-center border border-gray-100 group/btn"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-900" />
                  </button>
                  
                  {/* Mobile Dots Indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden z-10">
                    {product.images.map((_, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImage(idx);
                        }}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-all",
                          activeImage === idx ? "bg-black w-4" : "bg-black/20"
                        )}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="p-3 md:p-4 flex gap-2 overflow-x-auto scrollbar-hide bg-white/30 border-t border-gray-100">
                {product.images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      "w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 flex items-center justify-center bg-white",
                      activeImage === idx ? "border-black" : "border-transparent"
                    )}
                  >
                    <img src={img} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 md:p-8 flex flex-col min-w-0">
            <div className="mb-6 md:mb-8">
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-md mb-2">{product.category}</span>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-words leading-tight">{product.name}</h2>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1.5">
                <p className="text-black font-bold text-lg md:text-2xl">${product.price} <span className="text-xs text-gray-400 font-normal">/ пара</span></p>
                <p className="text-gray-400 text-xs md:text-sm font-medium">({formatUAH(product.price)})</p>
              </div>
              {product.description && (
                <p className="text-xs md:text-sm text-gray-500 mt-3 leading-relaxed break-words">{product.description}</p>
              )}
            </div>

            <div className="flex-1 space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <label className="text-[10px] md:text-xs font-bold uppercase text-gray-400 tracking-widest">Виберіть розміри</label>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    <button 
                      onClick={handleAddAllSizes}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg text-[10px] md:text-xs text-white uppercase font-bold tracking-wider transition-all shadow-sm hover:shadow-md active:scale-95"
                    >
                      Додати всі
                    </button>
                    <button 
                      onClick={() => setIndividualQuantities(product.sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}))}
                      className="bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-[10px] md:text-xs text-red-600 uppercase font-bold tracking-wider transition-all active:scale-95"
                    >
                      Очистити
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 md:gap-3">
                  {product.sizes.map(size => {
                    const inCart = getInCartCount(size);
                    const current = individualQuantities[size];
                    return (
                      <div key={size} className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-gray-200 transition-all gap-3">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm md:text-base font-bold text-gray-900 whitespace-nowrap">{size}</span>
                            {inCart > 0 && (
                              <span className="text-[8px] md:text-[10px] bg-black text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter whitespace-nowrap">
                                {inCart} {current > 0 && <span className="text-gray-400">+{current}</span>}
                              </span>
                            )}
                          </div>
                          {current > 0 && (
                            <span className="text-[10px] md:text-xs text-black font-medium truncate">+{current} пар</span>
                          )}
                        </div>
                        <div className="flex items-center border border-gray-200 rounded-xl bg-white shadow-sm flex-shrink-0 overflow-hidden">
                          <button 
                            onClick={() => updateIndividualQty(size, -1)}
                            className="p-3 md:p-2.5 hover:bg-gray-50 transition-colors border-r border-gray-100"
                            disabled={current === 0}
                          >
                            <Minus className={cn("w-4 h-4 md:w-3.5 md:h-3.5", current === 0 ? "text-gray-200" : "text-gray-600")} />
                          </button>
                          <input 
                            type="number"
                            inputMode="numeric"
                            value={current || ''}
                            onChange={(e) => updateIndividualQty(size, e.target.value)}
                            placeholder="0"
                            className={cn(
                              "w-12 md:w-14 text-center font-bold text-sm md:text-base outline-none bg-transparent",
                              current > 0 ? "text-black" : "text-gray-400"
                            )}
                          />
                          <button 
                            onClick={() => updateIndividualQty(size, 1)}
                            className="p-3 md:p-2.5 hover:bg-gray-50 transition-colors border-l border-gray-100"
                          >
                            <Plus className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 md:mt-10 space-y-3 md:space-y-4">
              <button 
                onClick={handleAdd}
                disabled={Object.values(individualQuantities).every(q => q === 0)}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 md:py-5 rounded-2xl font-bold transition-all shadow-lg shadow-gray-200 disabled:opacity-50 disabled:shadow-none text-sm md:text-lg"
              >
                Додати до кошика — ${totalIndividualPrice}
              </button>
              <button 
                onClick={onClose}
                className="w-full py-2 text-gray-400 hover:text-gray-600 text-xs md:text-sm font-medium transition-all"
              >
                Закрити
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
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc">("name");

  // Handle back button to close modal
  useEffect(() => {
    if (selectedProduct) {
      window.history.pushState({ modalOpen: true }, "");
      
      const handlePopState = () => {
        setSelectedProduct(null);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (window.history.state?.modalOpen) {
          window.history.back();
        }
      };
    }
  }, [selectedProduct]);

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
      try {
        handleFirestoreError(error, OperationType.LIST, "products");
      } catch (e) {}
    });

    return unsubscribe;
  }, []);

  const filteredProducts = (activeCategory === "Всі" 
    ? products 
    : products.filter(p => p.category === activeCategory))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      return 0;
    });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Каталог взуття</h1>
            <p className="text-gray-500 mt-2 text-sm md:text-base">Оптові ціни та швидка доставка по всій Україні</p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto w-full md:w-auto">
            <span className="text-[10px] md:text-xs font-bold uppercase text-gray-400 tracking-widest whitespace-nowrap">Сортувати:</span>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 md:flex-none bg-gray-100 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-black outline-none cursor-pointer transition-all"
            >
              <option value="name">За алфавітом</option>
              <option value="price-asc">Від дешевих</option>
              <option value="price-desc">Від дорогих</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-2.5 mt-8 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {["Всі", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 md:px-8 py-2.5 md:py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border-2",
                activeCategory === cat 
                  ? "bg-black border-black text-white shadow-xl shadow-gray-200 scale-105" 
                  : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100 hover:text-black"
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
  const { formatUAH } = useCurrency();
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [formData, setFormData] = useState({ name: '', phone: '', city: '', delivery: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmClear, setConfirmClear] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  const toggleGroup = (productId: string) => {
    setExpandedGroups(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

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

      // 2. Notify via Telegram
      const botToken = "8421404977:AAEAgbBfKNvTcX_n8mcKGf_BMxewEeiFT6s";
      const chatId = "223733844";
      
      // Group items by product name for better readability
      const groupedByProduct = items.reduce((acc, item) => {
        if (!acc[item.name]) acc[item.name] = [];
        acc[item.name].push(item);
        return acc;
      }, {} as Record<string, CartItem[]>);

      const header = `🛍️ *Нове замовлення!*\n👤 *Клієнт:* ${formData.name}\n📞 *Телефон:* ${formData.phone}\n📍 *Місто:* ${formData.city}\n🚚 *Доставка:* ${formData.delivery}\n\n📦 *Товари:*`;
      
      const productSections = Object.entries(groupedByProduct).map(([name, productItems]) => {
        const productTotalPairs = productItems.reduce((sum, item) => sum + item.quantity, 0);
        const itemsList = productItems.map(item => 
          `  • ${item.type === 'pack' ? 'Ростовка' : `${item.size}`}: ${item.quantity} ${item.type === 'pack' ? 'ящ' : 'пар'} x $${item.price}`
        ).join('\n');
        return `👟 *${name}*\n${itemsList}\n📊 *Всього по моделі:* ${productTotalPairs} пар\n────────────────`;
      });

      const footer = `\n📦 *Загальна кількість:* ${totalQuantity} пар\n💰 *Разом:* $${total}`;
      
      // Telegram message limit is 4096 characters
      const MAX_LENGTH = 4000;
      let currentMessage = header;
      const messagesToSend: string[] = [];

      productSections.forEach((section) => {
        if ((currentMessage + section).length > MAX_LENGTH) {
          messagesToSend.push(currentMessage);
          currentMessage = section;
        } else {
          currentMessage += '\n' + section;
        }
      });
      messagesToSend.push(currentMessage + footer);

      for (const msg of messagesToSend) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: msg,
              parse_mode: "Markdown"
            }),
          });
        } catch (tgErr) {
          console.error("Telegram notification failed for a chunk:", tgErr);
        }
      }
      
      setStep('success');
      onClear();
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, "orders");
      } catch (systemErr) {
        // System error is already logged in handleFirestoreError
      }
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 md:py-12">
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-12">
        <div className="lg:col-span-2 space-y-8">
          <header>
            <h1 className="text-3xl font-bold text-gray-900">{step === 'cart' ? 'Ваш кошик' : 'Оформлення замовлення'}</h1>
          </header>

          {step === 'cart' ? (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([productId, group]) => {
                const groupTotal = group.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
                const totalPairs = group.items.reduce((sum, i) => sum + i.quantity, 0);
                const isExpanded = expandedGroups[productId];
                const summary = group.items.map(item => `${item.size}(${item.quantity})`).join(', ');

                return (
                  <div key={productId} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                    <div 
                      onClick={() => toggleGroup(productId)}
                      className="flex items-center justify-between p-3 md:p-4 bg-gray-50/50 border-b border-gray-100 cursor-pointer hover:bg-gray-100/50 transition-colors gap-2"
                    >
                      <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 flex items-center justify-center">
                          <img src={group.image} alt={group.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm md:text-base font-bold text-gray-900 leading-tight truncate">{group.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] md:text-[10px] bg-black text-white px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap">
                              {totalPairs} {totalPairs === 1 ? 'пара' : totalPairs < 5 ? 'пари' : 'пар'}
                            </span>
                            {!isExpanded && (
                              <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate">
                                {summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm md:text-base font-black text-gray-900">${groupTotal}</div>
                          <div className="text-[9px] md:text-[10px] text-gray-400 font-medium">{formatUAH(groupTotal)}</div>
                        </div>
                        
                        {isExpanded && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirmDeleteGroupId === productId) {
                                group.items.forEach(item => onRemove(item.id));
                                setConfirmDeleteGroupId(null);
                              } else {
                                setConfirmDeleteGroupId(productId);
                                setTimeout(() => setConfirmDeleteGroupId(null), 3000);
                              }
                            }}
                            className={cn(
                              "p-2 rounded-xl transition-all flex items-center justify-center",
                              confirmDeleteGroupId === productId ? "bg-red-500 text-white" : "bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500"
                            )}
                            title="Видалити всю модель"
                          >
                            {confirmDeleteGroupId === productId ? <Check className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}

                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        </motion.div>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 grid grid-cols-1 gap-2 bg-white border-t border-gray-50">
                            {group.items.map(item => (
                              <div key={item.id} className="flex items-center justify-between bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50 hover:border-gray-200 transition-colors">
                                <div className="flex items-center gap-4 md:gap-10">
                                  <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                                      <span className="text-sm font-black text-gray-900">{item.size}</span>
                                    </div>
                                    {item.type === 'pack' && (
                                      <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter">
                                        Пак
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center border border-gray-200 rounded-xl bg-white h-10 overflow-hidden shadow-sm">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateQuantity(item.id, -1);
                                      }}
                                      className="px-3 h-full hover:bg-gray-50 transition-colors text-gray-400 hover:text-black"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-8 text-center font-bold text-sm text-gray-900">{item.quantity}</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateQuantity(item.id, 1);
                                      }}
                                      className="px-3 h-full hover:bg-gray-50 transition-colors text-gray-400 hover:text-black"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirmDeleteId === item.id) {
                                      onRemove(item.id);
                                      setConfirmDeleteId(null);
                                    } else {
                                      setConfirmDeleteId(item.id);
                                      setTimeout(() => setConfirmDeleteId(null), 3000);
                                    }
                                  }}
                                  className={cn(
                                    "p-2 transition-all ml-4 rounded-xl flex items-center justify-center",
                                    confirmDeleteId === item.id ? "bg-red-500 text-white" : "text-gray-300 hover:text-red-500"
                                  )}
                                >
                                  {confirmDeleteId === item.id ? <Check className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <div className="flex justify-end">
                {confirmClear ? (
                  <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-right-4">
                    <span className="text-xs font-bold text-red-600">Очистити кошик?</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          onClear();
                          setConfirmClear(false);
                        }}
                        className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 transition-colors"
                      >
                        Так
                      </button>
                      <button 
                        onClick={() => setConfirmClear(false)}
                        className="bg-white text-gray-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-gray-200 hover:text-black transition-colors"
                      >
                        Ні
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-2 text-gray-400 hover:text-red-500 text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Очистити кошик
                  </button>
                )}
              </div>
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
                <span>{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Доставка</span>
                <span>За тарифами перевізника</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between text-xl font-bold">
                <span>Разом</span>
                <div className="text-right">
                  <div>${total}</div>
                  <div className="text-xs text-gray-400 font-medium">{formatUAH(total)}</div>
                </div>
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

interface SortableImageProps {
  key?: React.Key;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

function SortableImage({ url, index, onRemove }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200"
    >
      <img
        src={url}
        alt={`Product ${index}`}
        className="w-full h-full object-contain p-1"
        referrerPolicy="no-referrer"
      />
      <div 
        {...attributes} 
        {...listeners}
        className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-move flex items-center justify-center"
      >
        <div className="opacity-0 group-hover:opacity-100 bg-white/90 p-1.5 rounded-lg shadow-sm">
          <ImageIcon className="w-4 h-4 text-gray-600" />
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 text-white text-[10px] rounded-full backdrop-blur-sm">
        {index + 1}
      </div>
    </div>
  );
}

const Admin = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { formatUAH } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminCategory, setAdminCategory] = useState("Всі");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [inlinePriceEditId, setInlinePriceEditId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'products' | 'users'>('products');
  const [users, setUsers] = useState<UserProfile[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updatePrice = async (id: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Некоректна ціна");
      return;
    }
    try {
      await updateDoc(doc(db, "products", id), { price: newPrice });
      toast.success("Ціну оновлено");
      setInlinePriceEditId(null);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
      } catch (systemErr) {}
      toast.error("Помилка оновлення ціни");
    }
  };

  const toggleStock = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "products", id), { inStock: !currentStatus });
      toast.success(`Статус змінено: ${!currentStatus ? 'В наявності' : 'Немає'}`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
      } catch (systemErr) {}
      toast.error("Помилка зміни статусу");
    }
  };
  
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
  const [uploadSessionId, setUploadSessionId] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Product));
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, "products");
      } catch (e) {}
    });
    return unsubscribe;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'users') return;
    const q = query(collection(db, "users"), orderBy("email"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }) as UserProfile));
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, "users");
      } catch (e) {}
    });
    return unsubscribe;
  }, [isAdmin, activeTab]);

  const toggleUserRole = async (uid: string, currentRole: 'admin' | 'client') => {
    const currentUser = auth.currentUser;
    if (currentUser?.uid === uid && currentUser?.email === "thecupoftea1000@gmail.com") {
      toast.error("Ви не можете змінити власну роль");
      return;
    }

    try {
      await updateDoc(doc(db, "users", uid), {
        role: currentRole === 'admin' ? 'client' : 'admin'
      });
      toast.success("Роль оновлено");
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      } catch (systemErr) {}
      toast.error("Помилка оновлення ролі");
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = adminCategory === "Всі" || p.category === adminCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => a.name.localeCompare(b.name));

  console.log("Admin: Rendering", { authLoading, isAdmin });
  if (authLoading) return <div className="p-12 text-center">Завантаження...</div>;
  if (!isAdmin) {
    console.log("Admin: Not an admin, redirecting to home");
    return <Navigate to="/" />;
  }

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setNewProduct(product);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setNewProduct(initialFormState);
    setUploadSessionId(Math.random().toString(36).substring(7));
  };

  const cancelEdit = () => {
    resetForm();
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!files.length) return;
    
    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      const productName = (newProduct.name || "").trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const folder = productName || editingId || `new_${uploadSessionId}`;
      for (const file of Array.from(files)) {
        // Use filename directly within a product-specific folder to prevent duplicates
        // but allow overwriting if the same file is uploaded again for the same product
        const fileRef = ref(storage, `products/${folder}/${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        // Only add if not already in the list
        if (!newProduct.images?.includes(url)) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        setNewProduct(prev => ({
          ...prev,
          images: [...(prev.images || []), ...uploadedUrls]
        }));
        toast.success("Фото завантажено");
      }
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setNewProduct((prev) => {
        const images = prev.images || [];
        const oldIndex = images.indexOf(active.id as string);
        const newIndex = images.indexOf(over.id as string);
        
        if (oldIndex === -1 || newIndex === -1) return prev;
        
        return {
          ...prev,
          images: arrayMove(images, oldIndex, newIndex),
        };
      });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.images?.length) {
      toast.error("Додайте хоча б одне фото");
      return;
    }
    if (!newProduct.sizes?.length) {
      toast.error("Виберіть хоча б один розмір");
      return;
    }

    const toastId = toast.loading(editingId ? "Оновлення товару..." : "Додавання товару...");

    try {
      const productData = {
        name: (newProduct.name || "").trim(),
        category: newProduct.category || CATEGORIES[0],
        price: Number(newProduct.price) || 0,
        sizes: newProduct.sizes || [],
        images: newProduct.images || [],
        inStock: newProduct.inStock !== false, // Default to true
        description: (newProduct.description || "").trim()
      };

      if (editingId) {
        const docRef = doc(db, "products", editingId);
        await updateDoc(docRef, {
          ...productData,
          id: editingId
        });
        toast.success("Товар оновлено", { id: toastId });
      } else {
        const newDocRef = doc(collection(db, "products"));
        await setDoc(newDocRef, {
          ...productData,
          id: newDocRef.id
        });
        toast.success("Товар додано", { id: toastId });
      }
      
      resetForm();
    } catch (err) {
      console.error("Error saving product:", err);
      try {
        handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, "products");
      } catch (systemErr) {}
      toast.error("Помилка при збереженні", { id: toastId });
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
    try {
      await deleteDoc(doc(db, "products", id));
      toast.success("Товар видалено");
      setConfirmDeleteId(null);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      } catch (systemErr) {}
      toast.error("Помилка при видаленні");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-gray-900">Адмін-панель</h1>
          <p className="text-xs text-gray-400 hidden sm:block">Керування каталогом та користувачами</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('products')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeTab === 'products' ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Товари
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeTab === 'users' ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            Користувачі
          </button>
        </div>
      </header>

      {activeTab === 'products' ? (
        <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleAdd} className="bg-white p-5 border border-gray-100 rounded-3xl space-y-4 sticky top-20 max-h-[85vh] overflow-y-auto shadow-sm">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">{editingId ? "Редагувати товар" : "Додати товар"}</h2>
              {editingId && (
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  className="text-[10px] text-gray-400 hover:text-black font-bold uppercase tracking-widest"
                >
                  Скасувати
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Назва</label>
                <input 
                  required
                  type="text" 
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all text-sm"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Категорія</label>
                <select 
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all bg-white text-sm"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Ціна ($)</label>
                  <input 
                    required
                    type="number" 
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Наявність</label>
                  <select 
                    value={newProduct.inStock ? "true" : "false"}
                    onChange={e => setNewProduct({...newProduct, inStock: e.target.value === "true"})}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all bg-white text-sm"
                  >
                    <option value="true">В наявності</option>
                    <option value="false">Немає</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Опис (опціонально)</label>
                <textarea 
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all min-h-[80px] text-sm resize-none"
                  placeholder="Додайте опис товару..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Розміри в наявності</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAllSizes} className="text-[9px] text-gray-400 hover:text-black font-bold uppercase">Вибрати все</button>
                    <button type="button" onClick={select40_45} className="text-[9px] text-gray-400 hover:text-black font-bold uppercase">40-45</button>
                    <button type="button" onClick={clearSizes} className="text-[9px] text-red-400 hover:text-red-600 font-bold uppercase transition-colors">Очистити</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {AVAILABLE_SIZES.map(size => (
                    <button 
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size)}
                      className={cn(
                        "py-1.5 rounded-lg border text-xs font-medium transition-all",
                        newProduct.sizes?.includes(size) ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Фотографії</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={newProduct.images || []}
                      strategy={horizontalListSortingStrategy}
                    >
                      {(newProduct.images || []).map((url, index) => (
                        <SortableImage
                          key={url}
                          url={url as string}
                          index={index}
                          onRemove={(idx: number) => setNewProduct(prev => ({
                            ...prev,
                            images: (prev.images || []).filter((_, i) => i !== idx)
                          }))}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  
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
            <button className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-100 text-sm">
              Зберегти товар
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 border border-gray-100 rounded-3xl space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row gap-3 justify-between">
              <div className="relative flex-1 min-w-[200px]">
                <input 
                  type="text"
                  placeholder="Пошук за назвою..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-black transition-all text-sm font-medium"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                {["Всі", ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAdminCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all",
                      adminCategory === cat ? "bg-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest">Товар</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest">Ціна</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest">Статус</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(product => (
                    <tr key={product.id} className={cn("hover:bg-gray-50/50 transition-colors", editingId === product.id && "bg-gray-50")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                            <img src={product.images[0]} className="max-w-full max-h-full object-contain p-1" referrerPolicy="no-referrer" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                            <p className="text-[10px] md:text-xs text-gray-400 font-medium uppercase tracking-wider">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {inlinePriceEditId === product.id ? (
                          <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-left-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-gray-400">$</span>
                              <input
                                autoFocus
                                type="number"
                                value={inlinePriceValue}
                                onChange={(e) => setInlinePriceValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updatePrice(product.id, Number(inlinePriceValue));
                                  if (e.key === 'Escape') setInlinePriceEditId(null);
                                }}
                                className="w-16 px-1.5 py-1 text-xs font-bold border border-black rounded-lg outline-none shadow-sm"
                              />
                              <div className="flex gap-0.5">
                                <button 
                                  onClick={() => updatePrice(product.id, Number(inlinePriceValue))}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Зберегти"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setInlinePriceEditId(null)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Скасувати"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="text-[9px] text-gray-400 font-medium pl-2">{formatUAH(Number(inlinePriceValue) || 0)}</div>
                          </div>
                        ) : (
                          <div 
                            className="group cursor-pointer inline-flex flex-col"
                            onClick={() => {
                              setInlinePriceEditId(product.id);
                              setInlinePriceValue(product.price.toString());
                            }}
                            title="Натисніть для швидкого редагування"
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="text-sm font-bold text-gray-900 group-hover:text-black transition-colors">${product.price}</div>
                              <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0">
                                <Settings className="w-3 h-3 text-gray-400" />
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium group-hover:text-gray-500 transition-colors">{formatUAH(product.price)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleStock(product.id, product.inStock)}
                          className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95",
                            product.inStock 
                              ? "bg-green-100 text-green-700 hover:bg-green-200" 
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          )}
                          title="Натисніть для зміни статусу"
                        >
                          {product.inStock ? "В наявності" : "Немає"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {confirmDeleteId === product.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100 animate-in fade-in zoom-in-95">
                              <button 
                                onClick={() => deleteProduct(product.id)}
                                className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Видалити
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-gray-400 text-[10px] font-bold hover:text-black transition-colors"
                              >
                                Скасувати
                              </button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => startEdit(product)}
                                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-black rounded-lg transition-colors"
                                title="Редагувати"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteId(product.id)}
                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                title="Видалити"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredProducts.map(product => (
                <div key={product.id} className={cn("p-5 space-y-4", editingId === product.id && "bg-gray-50")}>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                      <img src={product.images[0]} className="max-w-full max-h-full object-contain p-1" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-gray-900 leading-tight mb-1">{product.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{product.category}</p>
                      <div className="mt-2">
                        <div className="text-base font-black text-black">${product.price}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{formatUAH(product.price)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => toggleStock(product.id, product.inStock)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                        product.inStock 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {product.inStock ? "В наявності" : "Немає"}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      {confirmDeleteId === product.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100">
                          <button 
                            onClick={() => deleteProduct(product.id)}
                            className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg"
                          >
                            Видалити
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-gray-400 text-[10px] font-bold"
                          >
                            Скасувати
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => startEdit(product)}
                            className="p-2 bg-gray-100 text-gray-600 rounded-xl"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(product.id)}
                            className="p-2 bg-red-50 text-red-500 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                Товарів не знайдено
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-900">Керування правами доступу</h2>
            <p className="text-xs text-gray-400 mt-1">Тут ви можете призначити інших користувачів адміністраторами.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest">Користувач</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest">Email</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest">Роль</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 tracking-widest text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {u.photoURL ? (
                          <img src={u.photoURL} className="w-8 h-8 rounded-full border border-gray-100" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <span className="font-bold text-sm">{u.displayName || 'Без імені'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        u.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                      )}>
                        {u.role === 'admin' ? "Адміністратор" : "Клієнт"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => toggleUserRole(u.uid, u.role)}
                        disabled={u.email === "thecupoftea1000@gmail.com"}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                          u.role === 'admin' 
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200" 
                            : "bg-black text-white hover:bg-gray-800"
                        )}
                      >
                        {u.role === 'admin' ? "Зняти права" : "Зробити адміном"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                Користувачів не знайдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Cart initialization error:", error);
      return [];
    }
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
    <CurrencyProvider>
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
    </CurrencyProvider>
  );
}
