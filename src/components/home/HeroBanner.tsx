import { Link } from "react-router-dom";

const HeroBanner = () => {
  return (
    <section className="relative bg-foreground text-background overflow-hidden">
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="text-center">
          <p className="font-heading text-lg lg:text-xl mb-2 animate-fade-in">
            Click to check
          </p>
          <h2 className="font-heading text-5xl lg:text-7xl font-bold tracking-wide animate-fade-in" style={{ animationDelay: "0.1s" }}>
            BEST
          </h2>
          <h2 className="font-heading text-5xl lg:text-7xl font-bold tracking-wide animate-fade-in" style={{ animationDelay: "0.2s" }}>
            SELLERS
          </h2>
          <Link
            to="/collections/best-sellers"
            className="inline-block mt-8 px-8 py-3 border border-background text-sm uppercase tracking-wider hover:bg-background hover:text-foreground transition-colors animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            Shop Now
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
