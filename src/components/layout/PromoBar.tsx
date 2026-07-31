import { Link } from "react-router-dom";
import { useHomeConfig } from "@/hooks/useHomeConfig";
import type { HomeTopbarMessage } from "@/hooks/useHomeConfig";

const FALLBACK_MESSAGES: HomeTopbarMessage[] = [{ text: "Welcome to Minikki", link: "" }];

const MessageContent = ({ message }: { message: HomeTopbarMessage }) => {
  const content = <span className="font-medium tracking-wide">{message.text}</span>;

  if (!message.link) return content;

  if (message.link.startsWith("http")) {
    return (
      <a href={message.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {content}
      </a>
    );
  }

  return (
    <Link to={message.link} className="hover:underline">
      {content}
    </Link>
  );
};

const PromoBar = () => {
  const { data: config } = useHomeConfig();
  const topbar = config?.topbar;

  if (topbar && !topbar.enabled) return null;

  const messages = topbar?.messages?.length ? topbar.messages : FALLBACK_MESSAGES;
  const scrolling = topbar?.mode === "scroll" && messages.length > 1;
  const speed = topbar?.speed || 25;

  const style: React.CSSProperties = {
    ...(topbar?.background ? { backgroundColor: topbar.background } : {}),
    ...(topbar?.color ? { color: topbar.color } : {}),
  };

  if (!scrolling) {
    return (
      <div className="promo-bar py-2 px-4 mb-2 text-center text-sm" style={style}>
        {messages.map((message, index) => (
          <span key={index} className={index > 0 ? "hidden sm:inline" : ""}>
            {index > 0 && <span className="mx-3 opacity-40">•</span>}
            <MessageContent message={message} />
          </span>
        ))}
      </div>
    );
  }

  // Two identical tracks slide left in lockstep; when the first has fully exited,
  // the second sits exactly where the first began, so the loop is seamless.
  const track = (
    <div className="promo-track" aria-hidden={false}>
      {messages.map((message, index) => (
        <span key={index} className="promo-item">
          <MessageContent message={message} />
          <span className="mx-6 opacity-40">•</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="promo-bar py-2 mb-2 text-sm overflow-hidden" style={style}>
      <div className="promo-marquee" style={{ ["--promo-speed" as string]: `${speed}s` }}>
        {track}
        <div className="promo-track" aria-hidden="true">
          {messages.map((message, index) => (
            <span key={index} className="promo-item">
              <MessageContent message={message} />
              <span className="mx-6 opacity-40">•</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .promo-marquee {
          display: flex;
          width: max-content;
          animation: promoScroll var(--promo-speed, 25s) linear infinite;
        }

        .promo-marquee:hover {
          animation-play-state: paused;
        }

        .promo-track {
          display: flex;
          align-items: center;
          white-space: nowrap;
        }

        .promo-item {
          display: inline-flex;
          align-items: center;
        }

        @keyframes promoScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .promo-marquee {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default PromoBar;
