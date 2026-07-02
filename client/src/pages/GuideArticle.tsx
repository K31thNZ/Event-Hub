// GuideArticle.tsx — Individual guide article reader
// Fetches a single guide by slug from /api/guides/:slug and renders body_html.
// Increments view count on load. Breadcrumbs back to /guides.

import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clock, MapPin, Briefcase, Compass, Users, Heart, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Guide {
  id: string;
  title: string;
  slug: string;
  pillar: string;
  category: string;
  summary: string;
  body_html: string;
  author_label: string;
  sources: string;
  is_community: boolean;
  view_count: number;
  createdAt: string;
}

const PILLAR_ICONS: Record<string, React.ElementType> = {
  arrive: MapPin, live: Heart, work: Briefcase, explore: Compass, connect: Users,
};

export default function GuideArticle() {
  const [, params] = useRoute("/guides/:slug");
  const slug = params?.slug ?? "";

  const { data: guide, isLoading, isError } = useQuery<Guide>({
    queryKey: ["guide", slug],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${slug}`);
      if (!res.ok) throw new Error("Guide not found");
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-4">
        <div className="h-8 w-32 rounded-lg bg-muted animate-pulse" />
        <div className="h-12 w-3/4 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (isError || !guide) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold">Guide not found</p>
        <Link href="/guides">
          <button className="mt-4 text-primary text-sm hover:underline">← Back to guides</button>
        </Link>
      </div>
    );
  }

  const PillarIcon = PILLAR_ICONS[guide.pillar] ?? BookOpen;

  return (
    <div className="min-h-screen bg-background">
      {/* Back bar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <Link href="/guides">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to guides
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="outline" className="capitalize flex items-center gap-1">
              <PillarIcon className="w-3 h-3" />
              {guide.pillar}
            </Badge>
            <Badge variant="secondary">{guide.category}</Badge>
            {guide.is_community && <Badge variant="secondary" className="bg-primary/10 text-primary">Community</Badge>}
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">
            {guide.title}
          </h1>
          <p className="text-muted-foreground text-lg mb-6">{guide.summary}</p>

          {/* Author row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pb-6 border-b border-border mb-8">
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{guide.author_label}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(guide.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{guide.view_count} views</span>
          </div>

          {/* Body */}
          <div
            className="prose prose-sm md:prose-base prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground prose-a:text-primary max-w-none"
            dangerouslySetInnerHTML={{ __html: guide.body_html }}
          />

          {/* Sources */}
          {guide.sources && (
            <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground">
              <span className="font-semibold">Sources:</span> {guide.sources}
            </div>
          )}

          {/* Back CTA */}
          <div className="mt-10">
            <Link href="/guides">
              <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                <ArrowLeft className="w-4 h-4" /> View all guides
              </button>
            </Link>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
