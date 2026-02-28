import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useUserOrders, type WooCommerceOrder } from "@/hooks/useWooCommerce";
import { Loader2, Package, Search, LogIn, Clock, Truck, CheckCircle, AlertCircle } from "lucide-react";

const Orders = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<WooCommerceOrder | null>(null);
  const [trackError, setTrackError] = useState(false);

  // Fetch orders if logged in
  const normalizedPhone = user?.phoneNumber
    ? user.phoneNumber.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10)
    : undefined;

  const { data: orders = [], isLoading: ordersLoading } = useUserOrders(
    user?.email,
    normalizedPhone
  );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      processing: "bg-blue-100 text-blue-800",
      "on-hold": "bg-yellow-100 text-yellow-800",
      pending: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
      failed: "bg-red-100 text-red-800",
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed") return <CheckCircle className="h-4 w-4" />;
    if (s === "processing" || s === "on-hold") return <Truck className="h-4 w-4" />;
    if (s === "cancelled" || s === "failed") return <AlertCircle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !email) return;

    setIsTracking(true);
    setTrackedOrder(null);
    setTrackError(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-orders?email=${encodeURIComponent(email)}`,
        {
          method: "GET",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      const found = (data.orders || []).find(
        (o: any) => o.id.toString() === orderId.toString()
      );

      if (found) {
        setTrackedOrder(found);
      } else {
        setTrackError(true);
      }
    } catch {
      setTrackError(true);
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <Layout>
      <div className="bg-gray-50 min-h-[60vh]">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2 text-center">
            My Orders
          </h1>
          <p className="text-gray-500 text-center mb-8">
            {isAuthenticated
              ? "View and track all your orders"
              : "Track your order or login to view order history"}
          </p>

          {/* Logged-in: Show order history */}
          {isAuthenticated && user ? (
            <div>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-16">
                    <Package className="mx-auto h-14 w-14 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                    <p className="text-gray-500 mb-6">
                      You haven't placed any orders. Start shopping to see your orders here.
                    </p>
                    <Button
                      onClick={() => navigate("/collections/all")}
                      className="bg-[#800000] hover:bg-[#600000] text-white"
                    >
                      Start Shopping
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardHeader className="pb-3 bg-white">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                            <CardDescription>{formatDate(order.date_created)}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(order.status)}>
                              <span className="mr-1">{getStatusIcon(order.status)}</span>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          {order.line_items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm py-1">
                              <span className="text-gray-700">
                                {item.name} <span className="text-gray-400">x{item.quantity}</span>
                              </span>
                              <span className="font-medium">
                                {order.currency === "INR" ? "\u20B9" : order.currency}{" "}
                                {item.total}
                              </span>
                            </div>
                          ))}
                          <div className="border-t pt-3 mt-3 flex justify-between items-center">
                            <span className="text-sm text-gray-500">
                              {order.payment_method_title}
                            </span>
                            <span className="text-lg font-bold">
                              {order.currency === "INR" ? "\u20B9" : order.currency}{" "}
                              {order.total}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Not logged in: Track order form + login prompt */
            <div className="space-y-6">
              {/* Track Order Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Track Your Order
                  </CardTitle>
                  <CardDescription>
                    Enter your order ID and billing email to check order status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTrackOrder} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="track-order-id">Order ID</Label>
                        <Input
                          id="track-order-id"
                          placeholder="e.g. 12345"
                          value={orderId}
                          onChange={(e) => setOrderId(e.target.value)}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="track-email">Billing Email</Label>
                        <Input
                          id="track-email"
                          type="email"
                          placeholder="e.g. john@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 bg-[#800000] hover:bg-[#600000] text-white"
                      disabled={isTracking || !orderId || !email}
                    >
                      {isTracking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Tracking...
                        </>
                      ) : (
                        "Track Order"
                      )}
                    </Button>
                  </form>

                  {/* Track Result */}
                  {trackedOrder && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold">Order #{trackedOrder.id}</h4>
                        <Badge className={getStatusColor(trackedOrder.status)}>
                          {trackedOrder.status.charAt(0).toUpperCase() +
                            trackedOrder.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1 text-gray-600">
                        <p>Date: {formatDate(trackedOrder.date_created)}</p>
                        <p>
                          Total: {trackedOrder.currency === "INR" ? "\u20B9" : trackedOrder.currency}{" "}
                          {trackedOrder.total}
                        </p>
                        <p>Payment: {trackedOrder.payment_method_title}</p>
                        <div className="pt-2">
                          <p className="font-medium text-gray-700 mb-1">Items:</p>
                          {trackedOrder.line_items.map((item) => (
                            <p key={item.id}>
                              {item.name} x{item.quantity} -{" "}
                              {trackedOrder.currency === "INR" ? "\u20B9" : trackedOrder.currency}{" "}
                              {item.total}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {trackError && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg text-center">
                      <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                      <p className="font-medium text-red-800">Order not found</p>
                      <p className="text-sm text-red-600 mt-1">
                        Please check your Order ID and Email and try again.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Login Prompt */}
              <Card className="border-dashed">
                <CardContent className="text-center py-8">
                  <LogIn className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <h3 className="font-semibold mb-1">Want to see all your orders?</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Login to view your complete order history
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/account")}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Login / Sign Up
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Orders;
