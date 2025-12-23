import { Link } from "react-router-dom";

// Social Icons as inline SVGs for brand accuracy
const IconInstagram = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const IconFacebook = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const IconYoutube = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
);

const IconWhatsapp = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M16.1 13.6c-.4-.5-1.2-1.3-1.6-1.5-.4-.2-1-.2-1.3.1-.3.3-.6.6-1 .6-.3 0-.6-.2-1.2-.5-.6-.3-1.2-.6-1.7-1.1-.5-.5-.8-1.1-1.1-1.7-.3-.6-.5-.9-.5-1.2 0-.3.4-.6.3-.9 0-.4-.4-.8-.9-1.2-.5-.4-.9-.4-1.1-.3-.2.1-.4.4-.6.6-.2.2-.4.6-.4.9 0 .4.4 1.2 1.3 2.1.9.9 2.5 2.5 4.6 3.4.5.2 1 .3 1.4.4.9.2 2 .1 2.5 0 .5-.1 1.1-.4 1.5-1 .4-.6.4-1.1.3-1.3z" />
  </svg>
);

const Footer = () => {
  return (
    <footer className="bg-black text-white pb-24 pt-16 lg:py-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Information */}
          <div>
            <h3 className="font-heading text-xl font-bold mb-6">Information</h3>
            <ul className="space-y-3 text-base text-gray-300">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/shipping" className="hover:text-white transition-colors">Shipping Policy</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/refund" className="hover:text-white transition-colors">Refund & Returns</Link></li>
              <li><Link to="/track" className="hover:text-white transition-colors">Track Your Order</Link></li>
            </ul>
          </div>

          {/* Quick Shop */}
          <div>
            <h3 className="font-heading text-xl font-bold mb-6">Quick Shop</h3>
            <ul className="space-y-3 text-base text-gray-300">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/account" className="hover:text-white transition-colors">My Account</Link></li>
              <li><Link to="/collections/all" className="hover:text-white transition-colors">Shop</Link></li>
              <li><Link to="/orders" className="hover:text-white transition-colors">Orders</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="font-heading text-xl font-bold mb-6">Contact Us</h3>
            <div className="space-y-3 text-base text-gray-300">
              <p>BLACK LOVERS 3076 – B WING, AVADH RUTURAJ</p>
              <p>TEXTILE HUB, BRTS ROAD, Surat Gujarat 395012</p>
              <p className="pt-2 font-semibold">Whatsapp: 8939048873</p>
            </div>
          </div>

          {/* Follow Us */}
          <div>
            <h3 className="font-heading text-xl font-bold mb-6">Follow Us</h3>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/blacklovers__2/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-pink-500 transition-colors"
                aria-label="Instagram"
              >
                <IconInstagram />
              </a>
              <a
                href="https://wa.me/918939048873"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-500 transition-colors"
                aria-label="WhatsApp"
              >
                <IconWhatsapp />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
                aria-label="Facebook"
              >
                <IconFacebook />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-red-600 transition-colors"
                aria-label="YouTube"
              >
                <IconYoutube />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-base text-gray-500">
          <p>© 2025 Black Lovers. All Rights Reserved. Design by Sathishkaruppaiyan</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
