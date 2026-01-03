import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useWooCommercePaymentGateways } from "@/hooks/useWooCommerce";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: paymentGateways, isLoading: isLoadingGateways } = useWooCommercePaymentGateways();

  const [formData, setFormData] = useState({
    name: "",
    houseNo: "",
    street: "",
    landmark: "",
    pincode: "",
    city: "",
    state: "",
    country: "India",
    phone: "",
    whatsapp: "",
    alternatePhone: "",
    email: "",
    saveInfo: true,
  });

  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingPincode, setIsFetchingPincode] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Set default payment method when gateways are loaded
  useEffect(() => {
    if (paymentGateways && paymentGateways.length > 0 && !paymentMethod) {
      const enabledGateways = paymentGateways.filter(g => g.enabled);
      if (enabledGateways.length > 0) {
        setPaymentMethod(enabledGateways[0].id);
      }
    }
  }, [paymentGateways, paymentMethod]);

  const formatPrice = (price: number) => `Rs. ${price.toLocaleString("en-IN")}.00`;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "pincode" && value.length === 6) {
      fetchPincodeDetails(value);
    }
  };

  const fetchPincodeDetails = async (pincode: string) => {
    setIsFetchingPincode(true);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();

      if (data && data[0] && data[0].Status === "Success") {
        const details = data[0].PostOffice[0];
        setFormData((prev) => ({
          ...prev,
          city: details.District,
          state: details.State,
        }));
        toast({
          title: "Address Found",
          description: `City: ${details.District}, State: ${details.State}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Pincode",
          description: "Could not fetch details for this pincode.",
        });
      }
    } catch (error) {
      console.error("Error fetching pincode:", error);
    } finally {
      setIsFetchingPincode(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmDialog(true);
  };

  const handleConfirmOrder = async () => {
    setIsProcessing(true);
    setShowConfirmDialog(false);

    // Simulate order processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: "Order Placed Successfully!",
      description: "Thank you for your order. You will receive a confirmation email shortly.",
    });

    clearCart();
    navigate("/");
    setIsProcessing(false);
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Add some items to your cart before checking out.
          </p>
          <Link to="/collections/all">
            <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-none font-bold">
              CONTINUE SHOPPING
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link to="/cart" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
              <ChevronLeft className="h-4 w-4" />
              Back to Cart
            </Link>
            <Link to="/">
              <img src="/logo.webp" alt="Blacklovers" className="h-12" />
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Secure Checkout
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Left - Form */}
              <div className="space-y-8">

                {/* Shipping Address */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Shipping Address</h2>
                  <div className="space-y-4">

                    {/* Name */}
                    <div>
                      <Label htmlFor="name" className="font-bold">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="Full Name"
                      />
                    </div>

                    {/* House no / building name */}
                    <div>
                      <Label htmlFor="houseNo" className="font-bold">House no / Building name</Label>
                      <Input
                        id="houseNo"
                        name="houseNo"
                        value={formData.houseNo}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="e.g. Flat 101, Galaxy Apartments"
                      />
                    </div>

                    {/* Street / Area / colony */}
                    <div>
                      <Label htmlFor="street" className="font-bold">Street / Area / Colony</Label>
                      <Input
                        id="street"
                        name="street"
                        value={formData.street}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="e.g. MG Road, Indiranagar"
                      />
                    </div>

                    {/* Landmark */}
                    <div>
                      <Label htmlFor="landmark" className="font-bold">Landmark</Label>
                      <Input
                        id="landmark"
                        name="landmark"
                        value={formData.landmark}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="e.g. Near City Hospital"
                      />
                    </div>

                    {/* Pincode */}
                    <div>
                      <Label htmlFor="pincode" className="font-bold">Pincode</Label>
                      <div className="relative">
                        <Input
                          id="pincode"
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleInputChange}
                          className="mt-1 rounded-none"
                          required
                          placeholder="6 Digit Pincode"
                          maxLength={6}
                        />
                        {isFetchingPincode && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
                            Fetching...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* City & State (Auto-fetched) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city" className="font-bold">City</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="mt-1 rounded-none bg-muted"
                          required
                          readOnly
                        />
                      </div>
                      <div>
                        <Label htmlFor="state" className="font-bold">State</Label>
                        <Input
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className="mt-1 rounded-none bg-muted"
                          required
                          readOnly
                        />
                      </div>
                    </div>

                    {/* Country (Default India) */}
                    <div>
                      <Label htmlFor="country" className="font-bold">Country</Label>
                      <Input
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none bg-muted"
                        required
                        readOnly
                      />
                    </div>

                    {/* Phone number */}
                    <div>
                      <Label htmlFor="phone" className="font-bold">Phone number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="10 digit mobile number"
                      />
                    </div>

                    {/* WhatsApp number */}
                    <div>
                      <Label htmlFor="whatsapp" className="font-bold flex items-center gap-2">
                        WhatsApp number
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="#25D366"
                          className="inline-block"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </Label>
                      <Input
                        id="whatsapp"
                        name="whatsapp"
                        type="tel"
                        value={formData.whatsapp}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="For order updates and tracking"
                      />
                      <p className="text-xs text-muted-foreground mt-1">To receive tracking and order details</p>
                    </div>

                    {/* Alternate number */}
                    <div>
                      <Label htmlFor="alternatePhone" className="font-bold">Alternate number</Label>
                      <Input
                        id="alternatePhone"
                        name="alternatePhone"
                        type="tel"
                        value={formData.alternatePhone}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        placeholder="Optional"
                      />
                    </div>

                    {/* Email ID */}
                    <div>
                      <Label htmlFor="email" className="font-bold">Email ID</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 rounded-none"
                        required
                        placeholder="your@email.com"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        name="saveInfo"
                        checked={formData.saveInfo}
                        onChange={handleInputChange}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Save this information for next time</span>
                    </label>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Payment Method</h2>
                  <div className="space-y-3">
                    {isLoadingGateways ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading payment methods...</span>
                      </div>
                    ) : !paymentGateways || paymentGateways.filter(g => g.enabled).length === 0 ? (
                      <div className="text-center py-8 border border-border rounded-lg bg-muted/30">
                        <p className="text-muted-foreground">No payment options available</p>
                        <p className="text-sm text-muted-foreground mt-1">Please contact support for assistance</p>
                      </div>
                    ) : (
                      paymentGateways.filter(gateway => gateway.enabled).map((gateway) => (
                        <label
                          key={gateway.id}
                          className={`flex items-center gap-3 p-4 border cursor-pointer transition-colors ${paymentMethod === gateway.id
                            ? "border-foreground bg-muted"
                            : "border-border hover:border-foreground"
                            }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={gateway.id}
                            checked={paymentMethod === gateway.id}
                            onChange={() => setPaymentMethod(gateway.id)}
                            className="accent-foreground"
                          />
                          <div>
                            <p className="font-bold">{gateway.title}</p>
                            <p className="text-sm text-muted-foreground">{gateway.description}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right - Order Summary */}
              <div>
                <div className="bg-muted p-6 sticky top-28">
                  <h2 className="text-xl font-bold mb-6">Order Summary</h2>

                  {/* Items */}
                  <div className="space-y-4 max-h-64 overflow-auto">
                    {items.map((item) => (
                      <div key={`${item.product.id}-${item.size}`} className="flex gap-4">
                        <div className="relative w-16 h-20 bg-background flex-shrink-0 overflow-hidden">
                          <img
                            src={item.product.images[0] || "/placeholder.svg"}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-foreground text-background text-xs font-bold rounded-full flex items-center justify-center">
                            {item.quantity}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{item.product.name}</p>
                          {(item.size || item.color) && (
                            <p className="text-xs text-muted-foreground uppercase">
                              {[item.size, item.color].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <p className="font-bold text-sm mt-1">{formatPrice(item.product.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-6 pt-6 border-t border-border space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-bold">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-bold text-green-600">FREE</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (GST 18%)</span>
                      <span className="font-bold">{formatPrice(totalPrice * 0.18)}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Total</span>
                      <span className="font-bold">{formatPrice(totalPrice * 1.18)}</span>
                    </div>
                  </div>

                  {/* Place Order Button */}
                  <Button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full h-14 mt-6 bg-foreground text-background hover:bg-foreground/90 rounded-none font-bold text-base"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      `PLACE ORDER - ${formatPrice(totalPrice * 1.18)}`
                    )}
                  </Button>

                  {/* Trust indicators */}
                  <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Secure
                    </span>
                    <span>|</span>
                    <span>Free Shipping</span>
                    <span>|</span>
                    <span>Premium Quality</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Details</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground font-medium">
              We don't provide refund if user enter wrong address or number it's their own risk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>Edit</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOrder} className="bg-foreground text-background hover:bg-foreground/90">
              Yes, Place Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Checkout;
