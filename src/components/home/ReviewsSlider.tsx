import { Star, User } from "@/lib/icons";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

// Add a customer/review photo URL to `image` to show it at the top of the card.
// Leave it empty ("") to fall back to a generic avatar icon.
const reviews = [
    {
        id: 1,
        name: "Priya Sharma",
        rating: 5,
        text: "The quality of the fabric is amazing! Exceeded my expectations. Will definitely shop again.",
        image: ""
    },
    {
        id: 2,
        name: "Anjali Gupta",
        rating: 5,
        text: "Beautiful design and perfect fit. I received so many compliments.",
        image: ""
    },
    {
        id: 3,
        name: "Neha Patel",
        rating: 4,
        text: "Lovely collection. Shipping was fast and packaging was secure.",
        image: ""
    },
    {
        id: 4,
        name: "Sneha Reddy",
        rating: 5,
        text: "Absolutely in love with the ethnic wear collection. Great prices too!",
        image: ""
    },
    {
        id: 5,
        name: "Meera Singh",
        rating: 5,
        text: "Best customer service and returns were hassle-free. Highly recommended.",
        image: ""
    }
];

const ReviewsSlider = () => {
    return (
        <div className="py-12 lg:py-16 bg-[#f3f1ec]">
            <div className="container mx-auto px-4">
                {/* Heading */}
                <div className="flex items-baseline justify-between mb-8 gap-4">
                    <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-wide text-foreground/90">
                        MINIKKI <span className="font-light">x</span> YOU
                    </h2>
                    <span className="text-[11px] sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Happy Minikki Family
                    </span>
                </div>

                <Carousel opts={{ align: "start" }} className="w-full">
                    <CarouselContent>
                        {reviews.map((review) => (
                            <CarouselItem
                                key={review.id}
                                className="basis-[78%] sm:basis-1/2 lg:basis-1/4"
                            >
                                <div className="flex flex-col h-full">
                                    {/* Image */}
                                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted mb-4">
                                        {review.image ? (
                                            <img
                                                src={review.image}
                                                alt={review.name}
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const t = e.target as HTMLImageElement;
                                                    if (t.src !== "/placeholder.svg") t.src = "/placeholder.svg";
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="h-12 w-12 text-muted-foreground/60" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Star rating */}
                                    <div className="flex items-center gap-0.5 mb-2 text-foreground">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`h-4 w-4 ${i < review.rating ? "fill-current" : "text-muted-foreground/30"}`}
                                            />
                                        ))}
                                    </div>

                                    {/* Review */}
                                    <p className="text-sm text-foreground/80 leading-relaxed mb-4">
                                        {review.text}
                                    </p>

                                    {/* Name */}
                                    <p className="mt-auto text-sm font-bold text-foreground">
                                        {review.name}
                                    </p>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex left-2" />
                    <CarouselNext className="right-2" />
                </Carousel>
            </div>
        </div>
    );
};

export default ReviewsSlider;
