import PromoBar from "./PromoBar";
import Header from "./Header";
import Footer from "./Footer";
import MobileNav from "./MobileNav";
import SocialProofPopup from "./SocialProofPopup";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      <PromoBar />
      <Header />
      <main className="flex-1 lg:pb-0">{children}</main>
      <Footer />
      <MobileNav />
      <SocialProofPopup />
    </div>
  );
};

export default Layout;
