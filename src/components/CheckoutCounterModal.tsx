import React, { useState } from 'react';
import { EXHIBITS } from '../data/exhibits';
import { CartItem, ExhibitItem, PurchaseOrder } from '../types/gallery';
import {
  X,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Package,
} from 'lucide-react';

interface CheckoutCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onAddToCart: (exhibit: ExhibitItem, lensType?: string, lensPrice?: number) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
}

const LENS_OPTIONS = [
  { id: 'demo', label: 'Archival Display Lenses', price: 0, desc: 'Factory clear optical lenses with anti-static treatment' },
  { id: 'zeiss_clear', label: 'Zeiss Anti-Reflective Optical', price: 120, desc: 'High-clarity single vision with LotuTec hydrophobic coating' },
  { id: 'smoked_sun', label: 'Smoked Mineral Glass Tint', price: 140, desc: '100% UV400 category 3 dark charcoal mineral tint' },
  { id: 'blue_cut', label: 'Contemplative Blue-Cut Filter', price: 90, desc: 'Harmonious blue-light dispersion for prolonged screen usage' },
];

export const CheckoutCounterModal: React.FC<CheckoutCounterModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}) => {
  const [selectedLens, setSelectedLens] = useState(LENS_OPTIONS[0]);
  const [engravingText, setEngravingText] = useState('');
  const [customerName, setCustomerName] = useState('Patrick DK');
  const [customerEmail, setCustomerEmail] = useState('patrickdk2004@gmail.com');
  const [shippingMethod, setShippingMethod] = useState<'concierge' | 'pickup'>('concierge');
  const [shippingAddress, setShippingAddress] = useState('742 Evergreen Terrace, Suite 400');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'concierge_wire'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<PurchaseOrder | null>(null);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + (item.unitPrice + item.lensPrice) * item.quantity, 0);
  const tax = Math.round(subtotal * 0.08);
  const grandTotal = subtotal > 0 ? subtotal + tax : 0;

  const handlePlaceOrder = () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const order: PurchaseOrder = {
        orderId: `SM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        items: [...cartItems],
        subtotal,
        tax,
        total: grandTotal,
        customerName: customerName || 'Valued Collector',
        customerEmail: customerEmail || 'collector@gallery.com',
        shippingAddress: shippingMethod === 'pickup' ? 'In-Store Pickup · Splendid Melancholy Gallery Foyer' : shippingAddress,
        packagingTier: 'Signature Matte Black Hardbox + Japanese Microfiber + Embossed Certificate',
        timestamp: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      };
      setCompletedOrder(order);
      setIsProcessing(false);
      onClearCart();
    }, 900);
  };

  const handleResetOrder = () => {
    setCompletedOrder(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/75 backdrop-blur-md animate-fade-in text-stone-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#141418] border border-stone-800 rounded-sm shadow-2xl overflow-hidden">
        {/* Counter Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800/80 bg-[#17171c]/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-stone-800/80 flex items-center justify-center border border-stone-700/50">
              <ShoppingBag className="w-4 h-4 text-stone-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg tracking-wide text-stone-100">
                  Acquisitions & Purchase Counter
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-stone-800/80 text-stone-300 border border-stone-700/50">
                  Terminal 01
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-light">
                Splendid Melancholy · Flagship Boutique Counter Desk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 rounded-sm transition-colors cursor-pointer"
            title="Return to Gallery"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {completedOrder ? (
            /* Order Completion & Certificate */
            <div className="max-w-xl mx-auto py-4 text-center space-y-6 animate-fade-in">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 mb-1">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <span className="text-[11px] font-mono tracking-widest uppercase text-emerald-400">
                  Acquisition Finalized
                </span>
                <h3 className="font-geographica text-3xl sm:text-4xl text-stone-100 mt-1">
                  Thank You for Your Order
                </h3>
                <p className="text-xs text-stone-400 font-light max-w-md mx-auto mt-2 leading-relaxed">
                  Your piece has been reserved and prepared at the acquisition counter with individual archival packaging.
                </p>
              </div>

              {/* Certificate of Authenticity Card */}
              <div className="text-left bg-[#101014] border border-stone-800 p-6 rounded-sm space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-stone-800/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex justify-between items-start border-b border-stone-800/80 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 block">
                      Certificate of Authenticity & Receipt
                    </span>
                    <span className="font-serif text-lg text-stone-200">
                      Splendid Melancholy Archival Register
                    </span>
                  </div>
                  <span className="font-mono text-xs text-stone-400 font-medium">
                    {completedOrder.orderId}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-stone-500 block text-[10px] uppercase font-mono">Collector</span>
                    <span className="text-stone-300 font-light">{completedOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px] uppercase font-mono">Date</span>
                    <span className="text-stone-300 font-light">{completedOrder.timestamp}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-stone-500 block text-[10px] uppercase font-mono">Fulfillment</span>
                    <span className="text-stone-300 font-light">{completedOrder.shippingAddress}</span>
                  </div>
                </div>

                <div className="border-t border-stone-800/80 pt-3">
                  <span className="text-[10px] text-stone-500 uppercase font-mono block mb-2">Acquired Pieces</span>
                  <div className="space-y-1.5">
                    {completedOrder.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-xs font-light">
                        <span className="text-stone-300">
                          {it.quantity}x {it.title} ({it.lensType})
                        </span>
                        <span className="font-mono text-stone-200">
                          ${(it.unitPrice + it.lensPrice) * it.quantity} USD
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-stone-800/80 pt-3 flex justify-between items-baseline">
                  <span className="font-mono text-xs uppercase tracking-wider text-stone-400">Total Settled</span>
                  <span className="font-serif text-xl text-stone-100">
                    ${completedOrder.total.toLocaleString()} USD
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <button
                  onClick={handleResetOrder}
                  className="bg-stone-200 hover:bg-white text-stone-900 px-6 py-2.5 text-xs uppercase tracking-widest font-medium rounded-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Return to Gallery Experience</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Checkout Workflow */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Cart Items & Customization */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-stone-400">
                      Items at Counter ({cartItems.reduce((acc, it) => acc + it.quantity, 0)})
                    </h3>
                    {cartItems.length > 0 && (
                      <button
                        onClick={onClearCart}
                        className="text-[11px] text-stone-500 hover:text-stone-300 transition-colors"
                      >
                        Clear Tray
                      </button>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="bg-[#101014] border border-stone-800/80 rounded-sm p-6 text-center space-y-3">
                      <p className="text-xs text-stone-400 font-light">
                        Your acquisition tray is currently empty. Select any eyewear sculpture below to acquire it at the counter:
                      </p>

                      {/* Quick Select from Exhibition Collection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
                        {EXHIBITS.map((ex) => (
                          <div
                            key={ex.id}
                            className="p-3 bg-[#16161c] hover:bg-[#1a1a22] border border-stone-800 hover:border-stone-700 rounded-sm transition-all group flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                                <span>No. {ex.number}</span>
                                <span>${ex.price} USD</span>
                              </div>
                              <h4 className="font-serif text-sm text-stone-200 mt-0.5 group-hover:text-white">
                                {ex.title}
                              </h4>
                              <p className="text-[10px] text-stone-400 line-clamp-1 mt-0.5 font-light">
                                {ex.colorway}
                              </p>
                            </div>
                            <button
                              onClick={() => onAddToCart(ex, selectedLens.label, selectedLens.price)}
                              className="mt-2.5 w-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] uppercase font-mono tracking-wider py-1.5 px-2 rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add to Counter Tray</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#101014] border border-stone-800/80 p-3.5 rounded-sm flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-stone-500">
                                {item.number}
                              </span>
                              <h4 className="font-serif text-sm text-stone-100 truncate">
                                {item.title}
                              </h4>
                            </div>
                            <p className="text-[11px] text-stone-400 font-light truncate mt-0.5">
                              {item.category} · {item.colorway}
                            </p>
                            <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                              Optics: {item.lensType} {item.lensPrice > 0 ? `(+$${item.lensPrice})` : '(Included)'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center border border-stone-800 rounded-xs bg-[#16161c]">
                              <button
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="p-1 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                                title="Decrease"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 font-mono text-xs text-stone-200">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="p-1 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                                title="Increase"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="font-mono text-xs text-stone-200 min-w-16 text-right">
                              ${(item.unitPrice + item.lensPrice) * item.quantity}
                            </span>

                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="text-stone-600 hover:text-stone-300 p-1 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lens Customization Options */}
                <div className="space-y-3 pt-2 border-t border-stone-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-widest text-stone-400">
                      Optical Lens Specification
                    </span>
                    <span className="text-[11px] text-stone-500 font-light">Custom cut for your frames</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LENS_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedLens(opt)}
                        className={`text-left p-3 rounded-sm border transition-all cursor-pointer ${
                          selectedLens.id === opt.id
                            ? 'border-stone-500 bg-stone-800/50 text-stone-100'
                            : 'border-stone-800/80 bg-[#101014] hover:border-stone-700 text-stone-400'
                        }`}
                      >
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-medium text-stone-200">{opt.label}</span>
                          <span className="text-[11px] font-mono text-stone-400">
                            {opt.price === 0 ? 'Complimentary' : `+$${opt.price}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 font-light mt-1 leading-snug">
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bespoke Presentation Details */}
                <div className="bg-[#101014] border border-stone-800/80 p-4 rounded-sm space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-stone-400">
                    <Package className="w-3.5 h-3.5 text-stone-500" />
                    <span>Included Archival Packaging</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs font-light text-stone-400">
                    <Sparkles className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Every piece is packaged inside a custom rigid black foil-embossed case, magnetic leather travel sleeve, micro-fiber lens cloth, and individually serialized certificate card.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">
                      Complimentary Temple Inner Engraving (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      value={engravingText}
                      onChange={(e) => setEngravingText(e.target.value.toUpperCase())}
                      placeholder="e.g. S.M. 2026"
                      className="w-full bg-[#16161c] border border-stone-800 px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 rounded-xs focus:outline-none focus:border-stone-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Checkout Summary & Payment */}
              <div className="lg:col-span-5 bg-[#101014] border border-stone-800 p-5 rounded-sm flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-stone-400 border-b border-stone-800/80 pb-2">
                    Payment & Settlement
                  </h3>

                  {/* Delivery Choice */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                      Acquisition Handover
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setShippingMethod('concierge')}
                        className={`p-2 text-center text-xs rounded-xs border transition-all cursor-pointer ${
                          shippingMethod === 'concierge'
                            ? 'border-stone-500 bg-stone-800/70 text-stone-200'
                            : 'border-stone-800 hover:border-stone-700 text-stone-400'
                        }`}
                      >
                        Global Express
                      </button>
                      <button
                        onClick={() => setShippingMethod('pickup')}
                        className={`p-2 text-center text-xs rounded-xs border transition-all cursor-pointer ${
                          shippingMethod === 'pickup'
                            ? 'border-stone-500 bg-stone-800/70 text-stone-200'
                            : 'border-stone-800 hover:border-stone-700 text-stone-400'
                        }`}
                      >
                        Counter Pickup
                      </button>
                    </div>
                  </div>

                  {/* Collector Info */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-stone-500 mb-0.5">
                        Collector Name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-[#16161c] border border-stone-800 px-3 py-1.5 text-stone-200 rounded-xs focus:outline-none focus:border-stone-600 font-light"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-stone-500 mb-0.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full bg-[#16161c] border border-stone-800 px-3 py-1.5 text-stone-200 rounded-xs focus:outline-none focus:border-stone-600 font-light"
                      />
                    </div>
                    {shippingMethod === 'concierge' && (
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-stone-500 mb-0.5">
                          Delivery Destination
                        </label>
                        <input
                          type="text"
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          className="w-full bg-[#16161c] border border-stone-800 px-3 py-1.5 text-stone-200 rounded-xs focus:outline-none focus:border-stone-600 font-light"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Method Tabs */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                      Payment Gateway
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono uppercase">
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`p-2 border rounded-xs transition-colors flex items-center justify-center gap-1 ${
                          paymentMethod === 'card'
                            ? 'border-stone-500 bg-stone-800/80 text-stone-200'
                            : 'border-stone-800 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <CreditCard className="w-3 h-3" />
                        Card
                      </button>
                      <button
                        onClick={() => setPaymentMethod('apple_pay')}
                        className={`p-2 border rounded-xs transition-colors ${
                          paymentMethod === 'apple_pay'
                            ? 'border-stone-500 bg-stone-800/80 text-stone-200'
                            : 'border-stone-800 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        Digital Pay
                      </button>
                      <button
                        onClick={() => setPaymentMethod('concierge_wire')}
                        className={`p-2 border rounded-xs transition-colors ${
                          paymentMethod === 'concierge_wire'
                            ? 'border-stone-500 bg-stone-800/80 text-stone-200'
                            : 'border-stone-800 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        Concierge
                      </button>
                    </div>
                  </div>

                  {/* Price breakdown */}
                  <div className="space-y-1.5 pt-3 border-t border-stone-800/80 text-xs">
                    <div className="flex justify-between text-stone-400 font-light">
                      <span>Subtotal</span>
                      <span className="font-mono text-stone-300">${subtotal.toLocaleString()} USD</span>
                    </div>
                    <div className="flex justify-between text-stone-400 font-light">
                      <span>Insured Express Shipping</span>
                      <span className="font-mono text-emerald-400">Complimentary</span>
                    </div>
                    <div className="flex justify-between text-stone-400 font-light">
                      <span>Estimated Regional Tax</span>
                      <span className="font-mono text-stone-300">${tax.toLocaleString()} USD</span>
                    </div>
                    <div className="flex justify-between text-stone-100 pt-2 border-t border-stone-800 text-sm">
                      <span className="font-serif">Grand Total</span>
                      <span className="font-serif text-lg font-light">${grandTotal.toLocaleString()} USD</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    disabled={cartItems.length === 0 || isProcessing}
                    onClick={handlePlaceOrder}
                    className={`w-full py-3 px-4 rounded-sm text-xs font-medium uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      cartItems.length === 0 || isProcessing
                        ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                        : 'bg-stone-200 hover:bg-white text-stone-900 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isProcessing ? (
                      <span>Processing at Terminal...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Authorize Purchase (${grandTotal.toLocaleString()})</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-stone-500 text-center font-light">
                    Protected by Splendid Melancholy 2-Year Archival Guarantee & Care Service
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
