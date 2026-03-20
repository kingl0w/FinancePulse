import { Newspaper } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NewsCardProps {
  title: string;
  url: string;
  source: string;
  published_at: string;
  image?: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

const sentimentConfig = {
  bullish: {
    bg: "bg-gain/15",
    text: "text-gain",
    border: "border-gain/30",
    icon: "▲",
  },
  bearish: {
    bg: "bg-loss/15",
    text: "text-loss",
    border: "border-loss/30",
    icon: "▼",
  },
  neutral: {
    bg: "bg-muted-foreground/15",
    text: "text-muted-foreground",
    border: "border-muted-foreground/30",
    icon: "",
  },
} as const;

/** Simple hash to pick a gradient placeholder color */
function sourceGradient(source: string): string {
  const colors = [
    "from-[#f0b429]/20 to-[#f0b429]/5",
    "from-[#818cf8]/20 to-[#818cf8]/5",
    "from-[#38bdf8]/20 to-[#38bdf8]/5",
    "from-[#fb923c]/20 to-[#fb923c]/5",
    "from-[#34d399]/20 to-[#34d399]/5",
  ];
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function NewsCard({
  title,
  url,
  source,
  published_at,
  image,
  sentiment,
}: NewsCardProps) {
  const s = sentimentConfig[sentiment];

  let timeAgo = "";
  try {
    timeAgo = formatDistanceToNow(new Date(published_at), { addSuffix: true });
  } catch {
    timeAgo = published_at;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-md border-l-2 border-transparent hover:border-l-primary hover:bg-card transition-all group"
    >
      {image ? (
        <img
          src={image}
          alt={`${source} article thumbnail`}
          className="w-[80px] h-[60px] rounded-lg object-cover shrink-0 border border-border"
        />
      ) : (
        <div
          className={`w-[80px] h-[60px] rounded-lg bg-gradient-to-br ${sourceGradient(source)} flex items-center justify-center shrink-0 border border-border`}
        >
          <Newspaper className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-sans text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[12px] font-semibold text-muted-foreground truncate max-w-[120px]">{source}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[12px] text-muted-foreground">{timeAgo}</span>
          <span
            className={`text-[11px] capitalize rounded-full px-2 py-0.5 border ${s.bg} ${s.text} ${s.border}`}
          >
            {s.icon} {sentiment}
          </span>
        </div>
      </div>
    </a>
  );
}
