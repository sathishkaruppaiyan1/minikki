import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Information */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-4">Information</h3>
            <ul className="space-y-2 text-sm text-background/80">
              <li><Link to="/about" className="hover:text-background transition-colors">About Us</Link></li>
              <li><Link to="/terms" className="hover:text-background transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/shipping" className="hover:text-background transition-colors">Shipping Policy</Link></li>
              <li><Link to="/privacy" className="hover:text-background transition-colors">Privacy Policy</Link></li>
              <li><Link to="/refund" className="hover:text-background transition-colors">Refund & Returns</Link></li>
              <li><Link to="/track" className="hover:text-background transition-colors">Track Your Order</Link></li>
            </ul>
          </div>

          {/* Quick Shop */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-4">Quick Shop</h3>
            <ul className="space-y-2 text-sm text-background/80">
              <li><Link to="/" className="hover:text-background transition-colors">Home</Link></li>
              <li><Link to="/account" className="hover:text-background transition-colors">My Account</Link></li>
              <li><Link to="/collections/all" className="hover:text-background transition-colors">Shop</Link></li>
              <li><Link to="/orders" className="hover:text-background transition-colors">Orders</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-4">Contact Us</h3>
            <div className="space-y-2 text-sm text-background/80">
              <p>BLACK LOVERS 3076 – B WING, AVADH RUTURAJ</p>
              <p>TEXTILE HUB, BRTS ROAD, Surat Gujarat 395012</p>
              <p className="pt-2">Whatsapp: 8939048873</p>
            </div>
          </div>
        </div>

        <div className="border-t border-background/20 mt-8 pt-8 text-center text-sm text-background/60">
          <p>© 2025 Black Lovers. All Rights Reserved. Design by Sathishkaruppaiyan</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
