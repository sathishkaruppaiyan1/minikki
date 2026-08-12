import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, Loader2 } from "@/lib/icons";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useWooCommercePaymentGateways, useCreateOrder, useWooCommerceTaxConfig } from "@/hooks/useWooCommerce";
import { calculateTax, formatTaxLabel } from "@/lib/tax";
import { toIndiaStateCode, toCountryCode } from "@/lib/indiaStates";
import { supabase } from "@/integrations/supabase/client";
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
  const { items, totalPrice, clearCart, validateCartStock } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: paymentGateways, isLoading: isLoadingGateways } = useWooCommercePaymentGateways();
  const { data: taxConfig, isError: taxConfigFailed, isLoading: isLoadingTax } = useWooCommerceTaxConfig();
  const createOrder = useCreateOrder();

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
  const [formErrors, setFormErrors] = useState({
    name: "",
    phone: "",
    alternatePhone: "",
    whatsapp: "",
  });

  // Set default payment method when gateways are loaded
  useEffect(() => {
    if (paymentGateways && paymentGateways.length > 0 && !paymentMethod) {
      const enabledGateways = paymentGateways.filter(g => g.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (enabledGateways.length > 0) {
        setPaymentMethod(enabledGateways[0].id);
      }
    }
  }, [paymentGateways, paymentMethod]);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Load Cashfree Script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const formatPrice = (price: number) => `Rs. ${price.toLocaleString("en-IN")}.00`;
  const formatCheckoutPrice = (price: number) =>
    `Rs. ${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Tax comes from the store's WooCommerce configuration — rate, label, and
  // whether catalogue prices are already tax-inclusive. If tax is disabled or
  // no rate matches the address, `applies` is false and nothing is shown.
  // This is a preview: the amount actually charged is the total WooCommerce
  // returns on the created order (see `authoritativeTotal` below).
  const taxBreakdown = calculateTax(taxConfig ?? undefined, totalPrice, {
    country: toCountryCode(formData.country),
    state: toIndiaStateCode(formData.state),
    postcode: formData.pincode,
    city: formData.city,
  });
  const checkoutTotal = taxBreakdown.grossAmount;

  // If the tax config can't be read we cannot preview a trustworthy total:
  // WooCommerce will still add its own tax to the order, so quoting the bare
  // subtotal here would understate what the customer is about to be charged.
  // Say "calculated at checkout" rather than silently showing no tax.
  const taxUnknown = taxConfigFailed || (isLoadingTax && !taxConfig);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user starts typing
    if (name === "phone" || name === "alternatePhone" || name === "whatsapp") {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    if (name === "pincode" && value.length === 6) {
      fetchPincodeDetails(value);
    }
  };

  const fetchPincodeDetails = async (pincode: string) => {
    if (!/^\d{6}$/.test(pincode)) return;

    setIsFetchingPincode(true);

    // api.postalpincode.in has an expired SSL cert + no CORS, so it can't be
    // called from the browser. zippopotam.us has spotty coverage for rural
    // Indian pincodes. Solution: call a deployed edge function that proxies
    // postalpincode.in server-side (full India Post coverage, public data only).
    const PINCODE_LOOKUP_URL = "https://tjjpedhwruqiiybuwsgy.supabase.co/functions/v1/pincode-lookup";

    try {
      const response = await fetch(`${PINCODE_LOOKUP_URL}?pincode=${pincode}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.city || !result.state) {
        throw new Error(result.error || "Pincode not found");
      }

      setFormData((prev) => ({
        ...prev,
        city: result.city,
        state: result.state,
      }));
      toast({
        title: "Address Found",
        description: `City: ${result.city}, State: ${result.state}`,
      });
    } catch (error) {
      console.error("Error fetching pincode:", error);
      toast({
        variant: "destructive",
        title: "Invalid Pincode",
        description: "Could not fetch details for this pincode. Please enter city and state manually.",
      });
      setFormData((prev) => ({ ...prev, city: "", state: "" }));
    } finally {
      setIsFetchingPincode(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    const newErrors = { name: "", phone: "", alternatePhone: "", whatsapp: "" };

    // Name validation: must have at least 3 alphabetic characters
    const nameAlphaOnly = formData.name.replace(/[^a-zA-Z]/g, "");
    if (!formData.name.trim()) {
      newErrors.name = "Name is required.";
      hasError = true;
    } else if (nameAlphaOnly.length < 3) {
      newErrors.name = "Name must have at least 3 letters (a-z).";
      hasError = true;
    }

    // Basic digit validation regex for 10-12 digits
    const phoneRegex = /^\d{10,12}$/;
    // WhatsApp validation: exactly 10 digits for Indian numbers
    const whatsappRegex = /^\d{10}$/;

    if (formData.phone.length < 10) {
      newErrors.phone = "Please enter at least 10 digits for the phone number.";
      hasError = true;
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = "Phone number contains invalid characters.";
      hasError = true;
    }

    // WhatsApp validation
    if (!formData.whatsapp) {
      newErrors.whatsapp = "WhatsApp number is required.";
      hasError = true;
    } else if (formData.whatsapp.length !== 10) {
      newErrors.whatsapp = "Please enter exactly 10 digits for WhatsApp number.";
      hasError = true;
    } else if (!whatsappRegex.test(formData.whatsapp)) {
      newErrors.whatsapp = "WhatsApp number should contain only digits.";
      hasError = true;
    }

    // Since alternatePhone is required
    if (formData.alternatePhone.length < 10) {
      newErrors.alternatePhone = "Please enter at least 10 digits for the alternate phone number.";
      hasError = true;
    } else if (!phoneRegex.test(formData.alternatePhone)) {
      newErrors.alternatePhone = "Alternate phone number contains invalid characters.";
      hasError = true;
    }

    if (hasError) {
      setFormErrors(newErrors);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please correct the errors in the form.",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmOrder = async () => {
    setIsProcessing(true);
    setShowConfirmDialog(false);

    try {
      // Final stock validation before creating order
      const stockIssues = await validateCartStock();
      if (stockIssues.length > 0) {
        const outOfStock = stockIssues.filter(i => i.issue === 'out_of_stock' || i.issue === 'product_removed');
        const adjusted = stockIssues.filter(i => i.issue === 'quantity_exceeded');

        let msg = "";
        if (outOfStock.length > 0) {
          msg += outOfStock.map(i => `${i.productName}${i.size ? ` (${i.size})` : ""} is out of stock`).join(". ");
        }
        if (adjusted.length > 0) {
          msg += (msg ? ". " : "") + adjusted.map(i => `${i.productName}${i.size ? ` (${i.size})` : ""} reduced to ${i.availableStock}`).join(". ");
        }

        toast({
          variant: "destructive",
          title: "Cart Updated",
          description: msg + ". Please review your cart before placing the order.",
        });
        setIsProcessing(false);
        navigate("/cart");
        return;
      }
      // Find selected payment gateway details
      const selectedGateway = paymentGateways?.find(g => g.id === paymentMethod);

      // WooCommerce matches tax rates on the ISO country + state code. Sending
      // "Tamil Nadu" instead of "TN" means no state rate matches and the order
      // comes back untaxed.
      const stateCode = toIndiaStateCode(formData.state);
      const countryCode = toCountryCode(formData.country);

      // The REST API always treats line_items.total as tax-EXCLUSIVE and adds
      // tax itself. So when the catalogue price is already GST-inclusive we
      // must strip the tax out before sending, or WooCommerce taxes an
      // already-taxed price and the order comes back inflated.
      const lineItemTotal = (gross: number): string =>
        taxBreakdown.applies && taxBreakdown.inclusive
          ? (gross / (1 + taxBreakdown.ratePercent / 100)).toFixed(2)
          : String(gross);

      const orderData = {
        payment_method: paymentMethod || "cod",
        payment_method_title: selectedGateway?.title || "Cash on Delivery",
        set_paid: false,
        status: (paymentMethod === "razorpay" || paymentMethod.includes("cashfree")) ? "pending" : "processing",
        billing: {
          first_name: formData.name,
          last_name: "",
          address_1: `${formData.houseNo}, ${formData.street}`,
          address_2: formData.landmark,
          city: formData.city,
          state: stateCode,
          postcode: formData.pincode,
          country: countryCode,
          email: formData.email,
          phone: formData.phone
        },
        shipping: {
          first_name: formData.name,
          last_name: "",
          address_1: `${formData.houseNo}, ${formData.street}`,
          address_2: formData.landmark,
          city: formData.city,
          state: stateCode,
          postcode: formData.pincode,
          country: countryCode
        },
        line_items: items.map(item => ({
          product_id: parseInt(item.product.id),
          variation_id: item.variationId,
          quantity: item.quantity,
          subtotal: lineItemTotal(item.product.price * item.quantity),
          total: lineItemTotal(item.product.price * item.quantity),
          meta_data: [
            ...(item.size ? [{ key: "Size", value: item.size }] : []),
            ...(item.color ? [{ key: "Color", value: item.color }] : [])
          ]
        })),
        meta_data: [
          { key: "whatsapp_number", value: formData.whatsapp },
          { key: "alternate_phone", value: formData.alternatePhone }
        ]
      };

      const response = await createOrder(orderData);

      // WooCommerce is the single source of truth for what this order costs:
      // it applied the store's own tax rules to the line items we sent. Charge
      // exactly that figure so the payment can never disagree with the order
      // record — previously the client charged its own subtotal + 5% guess.
      const totalAmount = parseFloat(response.total);

      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        console.error("WooCommerce returned no usable order total", {
          order_id: response.id,
          total: response.total,
        });
        toast({
          variant: "destructive",
          title: "Order Error",
          description: "Could not confirm the order total. Please try again or contact support.",
        });
        setIsProcessing(false);
        return;
      }

      // The on-screen preview and the real total should agree. A gap means the
      // store's tax setup differs from what /woocommerce-taxes reported — worth
      // knowing about, but WooCommerce's figure still wins.
      if (Math.abs(totalAmount - checkoutTotal) > 1) {
        console.warn("Checkout preview differs from the WooCommerce order total", {
          preview: checkoutTotal,
          woocommerce_total: totalAmount,
          woocommerce_tax: response.total_tax,
          order_id: response.id,
        });
      }

      if (paymentMethod === "razorpay") {
        // Initiate Razorpay Flow
        try {
          const razorpayPayload = {
            amount: totalAmount,
            currency: "INR",
            receipt: `order_${response.id}`
          };
          const { data: razorpayOrder, error: razorpayError } = await supabase.functions.invoke("create-razorpay-order", {
            body: razorpayPayload,
          });

          if (razorpayError || !razorpayOrder) {
            throw new Error(razorpayError?.message || "Failed to create Razorpay order");
          }

          // Razorpay keeps the modal open after a declined attempt so the
          // customer can retry with another method. Track the outcome across
          // attempts instead of writing to WooCommerce on the first failure —
          // that write used to race with the success that followed it.
          let paymentSucceeded = false;
          let lastFailure: { code?: string; description?: string } | null = null;

          const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: "Minikki",
            description: `Order #${response.number || response.id}`,
            image: "/logo.png",
            order_id: razorpayOrder.id,
            handler: async function (response_razorpay: any) {
              // Payment Success Handler — verify signature server-side
              paymentSucceeded = true;
              try {
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
                  body: {
                    razorpay_order_id: response_razorpay.razorpay_order_id,
                    razorpay_payment_id: response_razorpay.razorpay_payment_id,
                    razorpay_signature: response_razorpay.razorpay_signature,
                    woocommerce_order_id: response.id,
                  },
                });

                if (verifyError || !verifyData?.verified) {
                  console.error("Payment verification failed:", verifyError || verifyData);
                  toast({
                    variant: "destructive",
                    title: "Payment Verification Failed",
                    description: "Payment could not be verified. Please contact support with your order ID.",
                  });
                } else if (!verifyData?.updated) {
                  console.error("Payment verified but order update failed:", verifyData);
                  toast({
                    variant: "destructive",
                    title: "Status Sync Failed",
                    description: `Payment verified for order #${response.number || response.id}, but store sync failed. Please contact support.`,
                  });
                } else {
                  console.log("Payment verified and order updated:", verifyData);
                  toast({
                    title: "Payment Successful",
                    description: "Your order has been placed and payment confirmed.",
                  });

                  // Send WhatsApp notification via WATI
                  try {
                    const whatsappNum = formData.whatsapp || formData.phone;
                    console.log("Triggering Razorpay WhatsApp notification for:", whatsappNum);
                    const { error: watiError } = await supabase.functions.invoke("wati-order-notification", {
                      body: {
                        phoneNumber: whatsappNum,
                        customerName: formData.name,
                        orderId: String(response.number || response.id),
                        amount: totalAmount,
                        currency: "₹",
                      },
                    });
                    if (watiError) {
                      console.error("Failed to send WhatsApp notification:", watiError);
                    } else {
                      console.log("WhatsApp notification sent successfully");
                    }
                  } catch (whatsappError) {
                    console.error("Error calling WATI edge function:", whatsappError);
                  }
                }
              } catch (updateError: any) {
                console.error("Unexpected error in success handler:", updateError);
                toast({
                  variant: "destructive",
                  title: "System Error",
                  description: "Could not verify payment. Please contact support.",
                });
              }

              // Prepare order details for thank you page
              const orderDetails = {
                orderId: String(response.number || response.id),
                name: formData.name,
                address: `${formData.houseNo}, ${formData.street}\n${formData.landmark ? formData.landmark + "\n" : ""}${formData.city}, ${formData.state} - ${formData.pincode}\n${formData.country}`,
                phone: formData.phone,
                whatsapp: formData.whatsapp,
                email: formData.email,
                items: items.map(item => ({
                  name: item.product.name,
                  quantity: item.quantity,
                  price: item.product.price,
                  size: item.size,
                  color: item.color,
                  image: item.image || item.product.images[0],
                })),
                total: totalAmount,
              };

              clearCart();
              navigate("/thank-you", { state: orderDetails });
            },
            prefill: {
              name: formData.name,
              email: formData.email,
              contact: formData.phone,
            },
            theme: {
              color: "#000000",
            },
            modal: {
              ondismiss: async function () {
                // The customer closed the modal. Only now do we know the
                // attempt is really over — a payment that succeeded (or is
                // being verified) must never be cancelled from here.
                if (paymentSucceeded) return;

                const finalStatus = lastFailure ? "failed" : "cancelled";
                try {
                  const { error: cancelError } = await supabase.functions.invoke("woocommerce-orders", {
                    method: "PUT",
                    body: {
                      id: response.id,
                      order_key: response.order_key,
                      status: finalStatus,
                      ...(lastFailure && {
                        meta_data: [
                          { key: "_razorpay_failure_reason", value: lastFailure.description || "Payment failed" },
                          { key: "_razorpay_failure_code", value: lastFailure.code || "unknown" },
                        ],
                      }),
                    },
                  });
                  if (cancelError) {
                    console.error(`Failed to mark order ${finalStatus} in WooCommerce:`, cancelError);
                  } else {
                    console.log(`Order marked ${finalStatus} in WooCommerce:`, response.id);
                  }
                } catch (err) {
                  console.error("Error closing out order:", err);
                }
                setIsProcessing(false);
                toast({
                  title: lastFailure ? "Payment Failed" : "Payment Cancelled",
                  description: lastFailure
                    ? lastFailure.description || "Your payment was declined. No amount was charged."
                    : "Your order has been cancelled. No payment was charged.",
                  ...(lastFailure && { variant: "destructive" as const }),
                });
              }
            }
          };

          const rzp1 = new (window as any).Razorpay(options);

          // A declined attempt (bank decline, wrong OTP, expired UPI request).
          // Recorded locally only — the modal stays open for a retry, and the
          // razorpay-webhook function persists the attempt server-side.
          rzp1.on("payment.failed", function (failResponse: any) {
            console.error("Razorpay payment attempt failed:", failResponse.error);
            lastFailure = {
              code: failResponse.error?.code || "unknown",
              description: failResponse.error?.description || "Payment failed",
            };
            toast({
              variant: "destructive",
              title: "Payment Failed",
              description: `${lastFailure.description}. You can try another payment method.`,
            });
          });

          rzp1.open();
          return; // Wait for handler or dismiss
        } catch (err: any) {
          console.error("Razorpay error:", err);
          toast({
            variant: "destructive",
            title: "Payment Initialization Failed",
            description: err.message || "Could not initialize Razorpay. Please try again.",
          });
          setIsProcessing(false);
          return;
        }
      }

      if (paymentMethod.includes("cashfree")) {
        try {
          console.log("Initiating Cashfree payment for order:", response.id);

          const { data: cfData, error: cfError } = await supabase.functions.invoke("create-cashfree-order", {
            body: {
              woocommerce_order_id: response.id,
              amount: totalAmount,
              customerName: formData.name,
              customerEmail: formData.email,
              customerPhone: formData.phone,
            },
          });

          if (cfError || !cfData?.payment_session_id) {
            console.error("Cashfree initiation failed:", cfError || cfData);
            throw new Error(cfData?.error || "Failed to initiate Cashfree payment");
          }

          const cashfree = (window as any).Cashfree({
            mode: cfData.env === "production" ? "production" : "sandbox",
          });

          const result = await cashfree.checkout({
            paymentSessionId: cfData.payment_session_id,
            redirectTarget: "_modal",
          });

          if (result?.error) {
            // User closed the modal or the payment errored before completing
            console.log("Cashfree checkout closed/errored:", result.error);
            try {
              await supabase.functions.invoke("woocommerce-orders", {
                method: "PUT",
                body: { id: response.id, order_key: response.order_key, status: "cancelled" },
              });
            } catch (err) {
              console.error("Error cancelling order:", err);
            }
            setIsProcessing(false);
            toast({
              title: "Payment Cancelled",
              description: "Your order has been cancelled. No payment was charged.",
            });
            return;
          }

          // Payment attempt finished — verify server-side (trusted check with Cashfree)
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-cashfree-payment", {
            body: {
              cashfree_order_id: cfData.cashfree_order_id,
              woocommerce_order_id: response.id,
            },
          });
          console.log("Cashfree verification response:", verifyData);

          if (verifyError || !verifyData?.payment_success) {
            try {
              await supabase.functions.invoke("woocommerce-orders", {
                method: "PUT",
                body: {
                  id: response.id,
                  order_key: response.order_key,
                  status: "failed",
                  meta_data: [
                    { key: "_cashfree_failure_status", value: verifyData?.status || "unverified" },
                  ],
                },
              });
            } catch (err) {
              console.error("Error updating failed order:", err);
            }
            setIsProcessing(false);
            toast({
              variant: "destructive",
              title: "Payment Failed",
              description: "Your payment was not completed. Please try again.",
            });
            return;
          }

          if (!verifyData?.updated) {
            toast({
              variant: "destructive",
              title: "Status Sync Failed",
              description: `Payment verified for order #${response.number || response.id}, but store sync failed. Please contact support.`,
            });
          }

          toast({
            title: "Payment Successful",
            description: "Your order has been placed and payment confirmed.",
          });

          const orderDetails = {
            orderId: String(response.number || response.id),
            name: formData.name,
            address: `${formData.houseNo}, ${formData.street}\n${formData.landmark ? formData.landmark + "\n" : ""}${formData.city}, ${formData.state} - ${formData.pincode}\n${formData.country}`,
            phone: formData.phone,
            whatsapp: formData.whatsapp,
            email: formData.email,
            items: items.map(item => ({
              name: item.product.name,
              quantity: item.quantity,
              price: item.product.price,
              size: item.size,
              color: item.color,
              image: item.image || item.product.images[0],
            })),
            total: totalAmount,
          };

          clearCart();
          navigate("/thank-you", { state: orderDetails });
          return;
        } catch (err: any) {
          console.error("Cashfree error:", err);
          toast({
            variant: "destructive",
            title: "Payment Initialization Failed",
            description: err.message || "Could not initialize Cashfree. Please try again.",
          });
          setIsProcessing(false);
          return;
        }
      }

      // Handle COD or other non-instant payments
      const orderDetails = {
        orderId: String(response.number || response.id),
        name: formData.name,
        address: `${formData.houseNo}, ${formData.street}\n${formData.landmark ? formData.landmark + "\n" : ""}${formData.city}, ${formData.state} - ${formData.pincode}\n${formData.country}`,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        email: formData.email,
        items: items.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          size: item.size,
          color: item.color,
          image: item.image || item.product.images[0],
        })),
        total: totalAmount,
      };

      clearCart();
      navigate("/thank-you", { state: orderDetails });
    } catch (error) {
      console.error("Order processing failed:", error);
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: "There was an error placing your order. Please try again.",
      });
    } finally {
      if (paymentMethod !== "razorpay" && !paymentMethod.includes("cashfree")) {
        setIsProcessing(false);
      }
    }
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
            <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-none font-bold"> className="w-full h-14 mt-6 bg-black text-white hover:bg-black/90 rounded-none font-bold text-base"
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
              <img src="/logo.png" alt="Minikki" className="h-12" />
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
                        placeholder="Full Name (e.g. Sathish Kumar)"
                      />
                      {formErrors.name && (
                        <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                      )}
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

                    {/* City & State (Auto-fetched from pincode, editable as fallback) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city" className="font-bold">City</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="mt-1 rounded-none"
                          required
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state" className="font-bold">State</Label>
                        <Input
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className="mt-1 rounded-none"
                          required
                          placeholder="State"
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
                        maxLength={12}
                        placeholder="10-12 digit mobile number"
                      />
                      {formErrors.phone && (
                        <p className="text-sm text-red-500 mt-1 font-medium animate-pulse">
                          {formErrors.phone}
                        </p>
                      )}
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
                        maxLength={10}
                        placeholder="10 digit WhatsApp number"
                      />
                      {formErrors.whatsapp ? (
                        <p className="text-sm text-red-500 mt-1 font-medium animate-pulse">
                          {formErrors.whatsapp}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">To receive tracking and order details</p>
                      )}
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
                        required
                        maxLength={12}
                        placeholder="10-12 digit number"
                      />
                      {formErrors.alternatePhone && (
                        <p className="text-sm text-red-500 mt-1 font-medium animate-pulse">
                          {formErrors.alternatePhone}
                        </p>
                      )}
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
                      paymentGateways.filter(gateway => gateway.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((gateway) => (
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
                            src={item.image || item.product.images[0] || "/placeholder.svg"}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-foreground text-background text-xs font-bold rounded-full flex items-center justify-center">
                            {item.quantity}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-extrabold text-black tracking-tight text-sm truncate">{item.product.name}</p>
                          {(item.size || item.color) && (
                            <p className="text-xs text-muted-foreground uppercase">
                              {[item.size, item.color].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <p className="font-extrabold text-[#B91C1C] text-sm mt-1">{formatPrice(item.product.price * item.quantity)}</p>
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
                    {taxUnknown ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-bold">Calculated at checkout</span>
                      </div>
                    ) : taxBreakdown.applies ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatTaxLabel(taxBreakdown)}
                          {taxBreakdown.inclusive && (
                            <span className="text-xs ml-1">(included)</span>
                          )}
                        </span>
                        <span className="font-bold">{formatCheckoutPrice(taxBreakdown.taxAmount)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Total</span>
                      <span className="font-bold">{formatCheckoutPrice(checkoutTotal)}</span>
                    </div>
                    {taxUnknown ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Any applicable tax is added when the order is placed.
                      </p>
                    ) : taxBreakdown.applies && taxBreakdown.inclusive ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Inclusive of {taxBreakdown.label}
                      </p>
                    ) : null}
                  </div>

                  {/* Place Order Button */}
                  <Button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full h-14 mt-6 bg-black text-white hover:bg-black/90 rounded-none font-bold text-base"
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
                      `PLACE ORDER - ${formatCheckoutPrice(checkoutTotal)}`
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
              <p className="mb-4">
                Kindly reconfirm your address and phone number before dispatch. If the parcel is returned due to incorrect or incomplete details, the customer will be responsible for the reshipping charges.
              </p>
              <div className="bg-muted p-4 rounded-md text-sm space-y-1 text-left">
                <p className="font-bold">{formData.name}</p>
                <p>{formData.houseNo}, {formData.street}</p>
                {formData.landmark && <p>{formData.landmark}</p>}
                <p>{formData.city}, {formData.state} - {formData.pincode}</p>
                <div className="mt-2 space-y-1">
                  <p className="font-bold">Phone: {formData.phone}</p>
                  <p className="font-bold">Alternate Phone: {formData.alternatePhone}</p>
                  <p className="font-bold flex items-center gap-1">
                    WhatsApp: {formData.whatsapp}
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="#25D366"
                      className="inline-block"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </p>
                  <p className="font-bold">Email: {formData.email}</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmDialog(false);
              window.scrollTo(0, 0);
            }}>Edit</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOrder} className="bg-black text-white hover:bg-black/90">
              Yes, Place Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Checkout;
