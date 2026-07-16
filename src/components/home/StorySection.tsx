import { useState } from "react";
import { ChevronDown, ChevronUp } from "@/lib/icons";

const StorySection = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="py-12 lg:py-20 bg-muted">
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="font-heading text-2xl lg:text-3xl font-semibold text-center mb-10">
          Our Story
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Founder Image */}
          <div className="flex justify-center lg:sticky lg:top-24">
            <div className="relative">
              <img
                src="/founder.jpg"
                alt="Dhanalakshmi - Founder of Minikki"
                className="w-72 md:w-80 lg:w-full max-w-sm rounded-2xl shadow-lg object-cover"
                loading="lazy"
                decoding="async"
                width="384"
                height="512"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl p-4 pt-10">
                <p className="text-white font-heading font-semibold text-lg">Dhanalakshmi</p>
                <p className="text-white/80 text-sm">Founder, Minikki</p>
              </div>
            </div>
          </div>

          {/* Story Content */}
          <div className="text-muted-foreground leading-relaxed space-y-4 text-[15px]">
            <h3 className="font-heading text-lg font-semibold text-foreground">Meet the Founder</h3>
            <p>
              Hi, I'm <strong className="text-foreground">Dhanalakshmi</strong>, Founder of Minikki.
            </p>
            <p>
              I'm not just a business owner — I'm also a proud mother of two. Like every woman, I understand the challenge of balancing family, work, and personal life. Managing everything while finding time for ourselves isn't easy.
            </p>
            <p className="text-foreground font-medium">
              That understanding is what inspired me to start Minikki.
            </p>

            <h3 className="font-heading text-lg font-semibold text-foreground pt-2">Why We Started Minikki</h3>
            <p>
              Today's women lead busy lives. Between work, family, children, and daily responsibilities, spending hours visiting multiple stores for shopping has become difficult. Even after spending an entire day shopping, finding the right design, quality, and price isn't always guaranteed.
            </p>
            <p className="text-foreground font-medium">I believed there had to be a better way.</p>
            <p>
              That's why we created <strong className="text-foreground">Minikki</strong> — a place where every woman can discover the latest trending collections, compare styles, and shop from the comfort of her home in just a few minutes. Fashion should be simple, convenient, and enjoyable.
            </p>

            {/* Expandable section */}
            <div className={`space-y-4 overflow-hidden transition-all duration-500 ${expanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}>
              <h3 className="font-heading text-lg font-semibold text-foreground pt-2">Our Mission</h3>
              <p>
                Our mission is to make premium-quality fashion affordable and accessible for every woman. We carefully select every collection to ensure it is trendy, stylish, comfortable, and budget-friendly. Our goal is to provide a safe and hassle-free online shopping experience that saves your time without compromising on quality.
              </p>

              <h3 className="font-heading text-lg font-semibold text-foreground pt-2">Why Choose Minikki?</h3>
              <p>
                At Minikki, we believe shopping is not just about buying clothes — it's about confidence. That's why we focus on:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Premium Quality Collections</li>
                <li>Latest Trending Designs</li>
                <li>Budget-Friendly Prices</li>
                <li>Fast &amp; Safe Dispatch</li>
                <li>Easy Online Shopping</li>
                <li>Friendly Customer Support</li>
                <li>Carefully Curated Collections</li>
              </ul>
              <p>
                Every outfit is chosen with love so that you receive fashion that makes you look and feel your best.
              </p>

              <h3 className="font-heading text-lg font-semibold text-foreground pt-2">Our Journey</h3>
              <p>
                What started as a small dream has now become the choice of thousands of women across India. For the past 4 years, we have been dedicated to delivering quality fashion with honesty and care.
              </p>

              {/* Milestone stats */}
              <div className="grid grid-cols-3 gap-3 py-2">
                <div className="bg-card rounded-xl p-3 text-center shadow-sm">
                  <p className="font-heading text-lg lg:text-xl font-bold text-primary">1,00,000+</p>
                  <p className="text-xs text-muted-foreground mt-1">Safe Deliveries</p>
                </div>
                <div className="bg-card rounded-xl p-3 text-center shadow-sm">
                  <p className="font-heading text-lg lg:text-xl font-bold text-primary">10,000+</p>
                  <p className="text-xs text-muted-foreground mt-1">Happy Customers</p>
                </div>
                <div className="bg-card rounded-xl p-3 text-center shadow-sm">
                  <p className="font-heading text-lg lg:text-xl font-bold text-primary">500+</p>
                  <p className="text-xs text-muted-foreground mt-1">Orders Every Day</p>
                </div>
              </div>

              <p>
                Every order reminds us that customer trust is our greatest achievement.
              </p>

              <h3 className="font-heading text-lg font-semibold text-foreground pt-2">Our Promise</h3>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Every order is carefully packed.</li>
                <li>Every product is quality checked before dispatch.</li>
                <li>Every customer is treated like family.</li>
              </ul>
              <p>
                At Minikki, we don't just deliver outfits — we deliver trust, happiness, and a shopping experience you'll love to come back to.
              </p>

              <h3 className="font-heading text-lg font-semibold text-foreground pt-2">Thank You, Dear Customer</h3>
              <p>
                Thank you for choosing Minikki and becoming a part of our journey. Your trust motivates us to bring you better collections, better quality, and better service every single day.
              </p>
              <p>
                We are truly grateful for your love and support, and we look forward to being a part of your fashion journey for many more years.
              </p>
              <p className="text-muted-foreground italic">
                With Love,<br />
                Dhanalakshmi<br />
                Founder, Minikki
              </p>
            </div>

            {/* Read More / Less button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors pt-1"
            >
              {expanded ? (
                <>Read Less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Read Full Story <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StorySection;
